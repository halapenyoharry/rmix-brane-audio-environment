# rmix-BAE System State Document
**Date**: 2026-03-15
**Purpose**: Complete system snapshot for external analysis

---

## What This Is

rmix-BAE (Brane Audio Environment) is a web-based audio processor that physically models a 2D membrane driven by audio. Not a reverb plugin, not a visualizer — a physics simulation of the actuator → membrane → microphone chain using the 2D wave equation. Audio goes in through actuators (virtual speaker cones), the membrane responds according to real physics, collectors (virtual microphones) sample it.

The deeper vision: this is a prototype for how people will interact with information when they realize everything is topology at scale. Music is the test signal because it's continuous, real-time, and keeps people looking. But the actuator-membrane-collector paradigm generalizes to any field dynamics.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Rendering | Three.js (local copy, r-latest) | Custom vertex/fragment shaders, PlaneGeometry |
| UI Controls | D3.js v7 (CDN) | Data-driven tile system with drag |
| Physics | Custom `MembranePhysics` class (vanilla JS) | 2D wave equation, 4-point Laplacian |
| Audio | Web Audio API | AnalyserNode, OscillatorNode, MediaElementSource, getDisplayMedia |
| Performance | stats.js (local, 2KB) | FPS/frame time/memory, press P to toggle |
| Schema | Custom JSON session format v1.1 | Not yet wired into live app |
| Mapping | Custom `MappingCurveEngine` class | Size→freq, opacity→Q, height→gain, freq→color |
| Build | None — open HTML directly in browser | No bundler, no transpiler |

---

## File Structure (Active Files Only)

```
brane-with-collectors-websocket.html  — Main application (2497 lines, single file)
membrane-physics-core.js              — Physics engine (305 lines, DO NOT MODIFY)
tiles-config.json                     — UI tile definitions
default-session.json                  — Session schema (not yet wired)
src/audio/MicrophoneInput.js          — Mic input module
src/schema/SchemaParser.js            — Session JSON loader
src/visual/MappingCurveEngine.js      — Property mapping curves
three.min.js                          — Three.js (local)
OrbitControls.js                      — Camera controls (local)
stats.min.js                          — Performance monitor (local, 2KB)
WebAudioFontPlayer.js                 — SoundFont player (local, SET ASIDE — latency issues)
soundfonts/                           — SoundFont instrument files (SET ASIDE)
demo-loops/                           — bass.wav, drums.wav, kick.wav
```

---

## Current Architecture

### The Main Loop (60fps target)

```
animate() {
    stats.begin()
    logFrame(dt)

    updateAudioData()           ← reads from AnalyserNodes into Uint8Arrays
    updateAudioVisualizers()    ← draws spectrum on active audio tile canvases

    actuators.forEach(a => a.apply())  ← each actuator reads audio data, applies force

    updatePhysics()             ← wave equation step + geometry update

    controls.update()           ← OrbitControls
    renderer.render()           ← Three.js draw

    stats.end()
}
```

### Audio Source → Membrane Pipeline

```
Source (tab/mic/file/demo/keyboard)
  → AudioContext
    → ChannelSplitter(2)
      → leftAnalyser (fftSize: 256, smoothing: 0.3)
      → rightAnalyser
        → leftAudioData (Uint8Array, getByteTimeDomainData)
        → rightAudioData
          → Actuator.apply() reads audio data
            → converts to force: ((avg - 128) / 128) * actuatorGain
              → height-dependent coupling: heightGain = 4.0 / (1 + (h/4)²)
                → Gaussian spread across grid cells
                  → physics.velocities[i][j] += force * gaussian * 0.1
```

### The Latency Problem (Critical)

For the keyboard instrument, the signal chain is:

```
Key press
  → OscillatorNode starts (instant, ~0ms)
    → AnalyserNode reads it (next audio callback, ~5ms)
      → smoothingTimeConstant: 0.3 (300ms effective smearing!)
        → Animation frame reads analyser (up to 16ms wait)
          → Actuator reads Uint8Array
            → Physics step
              → Render

TOTAL: 20-50ms minimum, PLUS 300ms of smoothing blur
```

**The AnalyserNode with 0.3 smoothing is the main latency bottleneck.** It was designed for visualization, not real-time instrument response. A truly low-latency instrument would need to bypass the analyser entirely and write force directly to the physics grid.

### The Cone Bug (Known, Unfixed)

The membrane forms a deep cone under actuators even during silence:

```javascript
// In Actuator.apply():
const memSurface = physics.heights[this.gridX][this.gridY];
const height = Math.max(0.5, 2 + memSurface * 0.8);
const heightGain = 4.0 / (1 + Math.pow(height / 4.0, 2));
```

**The problem**: As the membrane dips negative, `height` decreases, `heightGain` increases, pushing harder, causing more dip. Positive feedback with no brake. `getByteTimeDomainData()` returns values averaging ~127.8 (not exactly 128), creating a sub-pixel DC bias that the feedback loop amplifies into the cone.

**Attempted fix**: DC-blocking high-pass filter on force signal (branch `fix/dc-blocking-actuator`). Removed the cone but also ate initial transients — membrane felt less responsive. Reverted.

**Missing physics**: No stiffness/restoring force term (`ku`) that would pull the membrane back toward zero proportional to displacement. The current equation is `∂²u/∂t² = c²∇²u - γ∂u/∂t`. Should be `∂²u/∂t² = c²∇²u - γ∂u/∂t - ku`.

---

## The Physics Engine

```javascript
// membrane-physics-core.js — THE CORE, do not modify

class MembranePhysics {
    // Wave equation: ∂²u/∂t² = c²∇²u - γ∂u/∂t
    updatePhysics() {
        for (let i = 1; i < this.gridSize; i++) {
            for (let j = 1; j < this.gridSize; j++) {
                // 4-point Laplacian (∇²u) — cardinal neighbors only
                const laplacian = (
                    this.heights[i+1][j] + this.heights[i-1][j] +
                    this.heights[i][j+1] + this.heights[i][j-1] -
                    4 * this.heights[i][j]
                );

                this.velocities[i][j] += this.waveSpeed * this.waveSpeed * laplacian;
                this.velocities[i][j] *= (1 - this.damping);
                newHeights[i][j] = this.heights[i][j] + this.velocities[i][j];
            }
        }
    }
}
```

**Key properties:**
- Grid: 2D array, default 100x100 (10,201 cells)
- 4-point stencil → numerical anisotropy (wavefronts are slightly square, not circular)
- Fixed boundary conditions (Dirichlet: edges = 0)
- Also supports free, infinite (absorbing), and circular boundaries
- Allocates new height array every frame (`new Array(gridSize+1).fill(0).map(...)`)
- Performance: O(gridSize²) per frame, ~10K iterations at default resolution

---

## The Shader (Fragment)

```glsl
// HSL spectrum sweep — the "creamy visuals"
vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
    float t = (vHeight + 10.0) / 20.0;  // normalize displacement to 0-1
    t = clamp(t, 0.0, 1.0);

    // Full spectrum: cyan at rest, rainbow as displacement increases
    float hue = mod(0.5 + (t - 0.5) * 0.75, 1.0);
    vec3 color = hsl2rgb(hue, 1.0, 0.5);

    // Simple diffuse lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(vNormal, lightDir), 0.0);
    color *= (0.7 + diff * 0.3);

    gl_FragColor = vec4(color, opacity);
}
```

---

## The Actuator (Force Application)

```javascript
// In Actuator.apply() — called once per actuator per frame
apply() {
    let force = 0;

    if (demoMode) {
        force = Math.sin(time * 2 + this.demoPhase) * 2;
    } else if (audioEnabled && leftAudioData && rightAudioData) {
        // Average time-domain samples from assigned channel
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i];  // Uint8Array, 0-255, 128 = silence
        }
        const avg = sum / audioData.length;
        force = ((avg - 128) / 128) * window.actuatorGain;
    }

    // Height-dependent coupling (causes cone bug)
    const memSurface = physics.heights[this.gridX][this.gridY];
    const height = Math.max(0.5, 2 + memSurface * 0.8);
    const heightGain = 4.0 / (1 + Math.pow(height / 4.0, 2));
    const scaledForce = force * heightGain;

    // Gaussian spread (size-dependent radius)
    const fRadius = Math.max(2, Math.round(this.baseSize * 1.5));
    for (let i = -fRadius; i <= fRadius; i++) {
        for (let j = -fRadius; j <= fRadius; j++) {
            const gaussian = Math.exp(-(i*i + j*j) / (fRadius * fRadius * 0.5));
            physics.velocities[gi][gj] += scaledForce * gaussian * 0.1;
        }
    }

    // Piston tracking — actuator rides the membrane surface
    this.visual.position.y = 2 + memHeight * 0.8;
}
```

---

## The Keyboard Instrument (Current State)

Currently using raw Web Audio API OscillatorNodes (replaced WebAudioFont due to latency):

```javascript
// Waveforms: sine, triangle, sawtooth, square
function keyboardNoteOn(pitch) {
    const osc = audioContext.createOscillator();
    osc.type = waveforms[currentWaveformIndex];
    osc.frequency.setValueAtTime(midiToFreq(pitch), audioContext.currentTime);

    const noteGain = audioContext.createGain();
    noteGain.gain.setValueAtTime(0, audioContext.currentTime);
    noteGain.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + 0.01);

    osc.connect(noteGain);
    noteGain.connect(keyboardGainNode);  // → speakers + analysers
    osc.start();
}
```

**Problem**: Even with instant oscillators, the signal still goes through the AnalyserNode pipeline (see latency chain above). The keyboard SOUNDS instantly through speakers, but the MEMBRANE responds 20-300ms later because it reads from the analyser.

**The fundamental tension**: All other sources (tab, mic, file) use the analyser pathway because they need frequency analysis for visualization. The keyboard doesn't need analysis — it already knows its frequency. But it's forced through the same pipe because that's the only way actuators read audio.

---

## Mapping Curves (Schema, Not Yet Wired)

```javascript
// MappingCurveEngine.js — converts spatial properties to audio properties
sizeToFrequency(size_mm)    // Power law: freq = fmax * (size/smax)^-2
opacityToQ(opacity)         // Linear: transparent = wide Q, opaque = narrow
zToGain(z)                  // Inverse square: height above membrane = coupling
sizeToSpread(size_mm)       // Linear: bigger dot = wider Gaussian footprint
frequencyToColor(freq_hz)   // Log: low freq = red/warm, high freq = blue/cool
```

These exist in code but are only partially connected. The schema defines the curves and the engine computes them, but most actuator properties are still hardcoded in the HTML.

---

## Session Schema (v1.1, Not Yet Wired)

`default-session.json` defines:
- Sources (file, mic, tab, demo loops) with analysis config
- Actuators and collectors (empty arrays — no persistence yet)
- Parameters with min/max/default, smoothing, UI hints
- Mapping curves
- OSC protocol mappings (for external control)
- UI layout hints

None of this is loaded by the live app except the mapping curves.

---

## Performance Profile

**Per-frame work at default settings (100x100 grid, 1 actuator):**

| Step | Complexity | Notes |
|------|-----------|-------|
| `updateAudioData()` | O(1) | Two `getByteTimeDomainData` calls |
| `updateAudioVisualizers()` | O(tiles) | Canvas draws for active audio tiles |
| `actuator.apply()` | O(r²) per actuator | r=3 → 49 cells, includes `Math.exp()` per cell |
| `physics.updatePhysics()` | O(n²) | 10,000 iterations, allocates new array each frame |
| Geometry update | O(n²) | 10,000 vertex position writes |
| Three.js render | GPU | Shader execution, vertex upload |

**Known issues:**
- Physics allocates `new Array()` every frame (GC pressure)
- `Math.exp()` in Gaussian spread is expensive per-cell
- No frame budget throttling — if physics is slow, everything is slow
- Stats/perf log available: press P for visual, Shift+P for console dump

---

## Open Issues (33 created, 30 open)

### Bugs
- **#7** Actuator balls hard to interact with when bouncing
- **#34** Fix the cone (asymmetric coupling runaway)

### Architecture Decisions
- **#18** Audio source problem: where is people's sound?
- **#20** Flip the model: membrane as PiP
- **#21** Mobile audio routing
- **#31** The dot IS the UI: direct manipulation vs properties panel
- **#32** Source assignment UX: dots switch sources
- **#37** MIDI + synth engine architecture

### Enhancements (Ready to Build)
- **#2** Controls resizable
- **#3** Input source icons redesign
- **#4** Wireframe toggle redesign
- **#5** Slider colors meaningful
- **#6** Right-click/force-click config
- **#13** Equation control: mini-simulations per physics term
- **#14** Document PiP
- **#19** Tab capture live video thumbnail
- **#26** Membrane color transitions
- **#27** Per-actuator frequency bands
- **#29** Accept stream URLs
- **#30** Per-actuator control wiring
- **#33** Playable instrument source
- **#35** Wire session schema into app

### Ideas (Captured, Not Actionable Yet)
- **#1** Why the visual leap works
- **#8** Rethink naming ("tile" too constraining)
- **#10** Control physics: grouping, snapping, floating
- **#17** Universal topology interface vision
- **#22** Curated audio streams
- **#23** Radio stations
- **#24** User accounts without cookies
- **#25** Mobile: membrane as full screen
- **#28** Generative camera fly-throughs
- **#36** First-time UX

### Physics Notebook
- **#15** Wavefront wobble (grid anisotropy from 4-point stencil)
- **#16** The cone (DC offset from asymmetric coupling)

---

## Key Tensions / Superpositions

### 1. Analyser Pipeline vs Direct Force
All audio sources go through `AnalyserNode → Uint8Array → actuator.apply()`. This works for passive sources (tab capture, files) but adds unacceptable latency for interactive instruments. A keyboard or touch instrument needs to write force directly to the physics grid, bypassing the analyser entirely. But then it's a different code path from every other source. Do we have two force application modes, or redesign the pipeline?

### 2. Professional Audio Tool vs Beautiful Visualizer
The membrane looks incredible. The physics is honest. But professional audio requires sample-accurate timing, sub-10ms latency, and consistent frame rates. The current architecture runs at animation frame rate (60fps = 16ms resolution) and reads audio through analysers designed for visualization, not processing. To be a real audio tool, we'd need AudioWorklet for sample-rate processing, which is a fundamentally different architecture than the current requestAnimationFrame loop.

### 3. Single HTML File vs Modular Architecture
Everything is in one 2497-line HTML file. This makes it easy to open and hack but hard to maintain and impossible to test in isolation. The schema, mapping engine, and mic input are already separated into modules, but the actuator class, keyboard, tile system, and audio routing are all inline. The session schema defines a clean separation but isn't wired in.

### 4. Physics Core Sanctity vs Needed Improvements
`membrane-physics-core.js` is marked "DO NOT MODIFY" because it's stable. But it:
- Allocates new arrays every frame (GC pressure)
- Uses only 4-point Laplacian (anisotropic wavefronts)
- Has no stiffness term (needed for cone fix)
- Uses nested JS arrays, not TypedArrays (slower)
A performance-critical rewrite could use Float32Arrays, pre-allocate, add 8-point stencil, and add the stiffness term. But touching it risks breaking the stable physics.

### 5. Desktop-First vs Mobile-First
Desktop has tab capture, keyboard/mouse, plenty of screen space. Mobile has touch, limited audio routing, small screens. The confirmed strategy is: desktop = full creative tool, mobile = curated streams + files + touch instrument. But the mobile UX (#25: membrane as screen, Google Maps style) is potentially the more compelling product.

### 6. WebAudioFont vs Raw Oscillators vs Direct Force
Three approaches to the keyboard instrument, each with trade-offs:
- **WebAudioFont**: Rich instrument sounds (piano, strings). High latency from sample decoding. Set aside.
- **Raw Oscillators**: Zero-latency sound generation. Still goes through analyser pipeline for membrane response. Current state.
- **Direct Force**: Bypass audio entirely. Key press → compute waveform mathematically → write to physics grid on same frame. Zero latency for membrane response, but no audio output through speakers unless we add a separate audio synthesis path.

### 7. Cone: Bug or Physics?
The cone IS physically realistic (asymmetric coupling creates DC offset, like a weighted speaker on a membrane). But it's also unwanted behavior that degrades the visual experience. The "fix" (stiffness term) is actually "more complete physics." But adding it to the actuator code is a hack; it belongs in the physics core. And the physics core is sacred.

---

## Tagged Version

`v0.1-creamy-visuals` (commit `1423c25`) — the known-good visual state before keyboard/stats additions. HSL spectrum shader, Gaussian actuator spread, piston-tracking actuators. This is the shippable baseline.

---

## Platform Strategy (Confirmed)

- **Desktop**: Full creative tool — tab capture, PiP, multi-source, keyboard instrument, deep control
- **Mobile web**: Curated streams, loop library, files, touch instrument — best effort within browser constraints
- **iOS**: Best effort browser. Don't fight Apple's restrictions.
- **Target browser**: Chrome/Chromium (getDisplayMedia, Web MIDI, Document PiP)
