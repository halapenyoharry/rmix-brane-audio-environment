# Future Enhancements for rmix-BAE

## Audio File Controls (NEXT)

### Scrubbing & Selection
**Current**: Basic file loading with loop playback
**Goal**: Fine control over audio file playback

**Libraries to Consider**:
- **WaveSurfer.js** - Visual waveform with click-to-seek, region selection
  - Displays audio as waveform
  - Click anywhere to jump
  - Select regions to loop
  - Zoom in/out
  - https://wavesurfer-js.org/

- **Peaks.js** (BBC) - Professional audio waveform UI
  - Similar to DAW timeline
  - Multi-track support
  - Segment/region markers
  - https://github.com/bbc/peaks.js

- **Tone.js Player** - Built-in transport controls
  - Play/pause/stop/loop
  - Seek to position
  - Playback rate control
  - https://tonejs.github.io/

**Minimum Features Needed**:
- Play/pause button
- Seek bar (scrub through audio)
- Loop region selection (A-B loop)
- Visual waveform display
- Current time / duration display

**UI Placement**:
- Bottom panel (slides up when file loaded)
- Or side panel with waveform
- Minimal - don't cover membrane view

### Implementation Notes

```javascript
// Example with WaveSurfer
const wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#00e5ff',
    progressColor: '#ff00ff',
    backend: 'WebAudio',
    height: 80
});

wavesurfer.load('audio.mp3');

// Connect to analyser for actuators
const analyserNode = wavesurfer.backend.analyser;
// Use this instead of creating new analyser
```

---

## Multiple Input Sources Per Actuator

**Goal**: Each actuator can have different audio source

**Example Use Cases**:
- Kick drum file on left actuator
- Live vocals on center actuator
- Synth from JACK on right actuator
- All affecting membrane simultaneously

**Implementation**:
```javascript
class Actuator {
    constructor(x, y, config = {}) {
        this.inputSource = config.source || 'demo';
        // 'demo', 'jack', 'file', 'mic', 'oscillator'
    }
}
```

**UI**:
- Right-click actuator → Choose source menu
- Or properties panel when actuator selected

---

## Advanced Collector Features

### 1. Microphone Models
**Goal**: Different transducer characteristics

**Options**:
- Condenser (displacement, bright)
- Dynamic (velocity, balanced)
- Ribbon (velocity, warm)
- Contact (acceleration, harsh)
- Piezo (high-freq emphasis)

### 2. Polar Patterns
**Goal**: Directional sensitivity

**Patterns**:
- Omni (360°, current default)
- Cardioid (front-facing)
- Figure-8 (front & back)
- Shotgun (narrow front)

**Implementation**:
- Sample multiple grid points
- Weight by angle to "front" direction
- Visualize with oriented cone/arrow

### 3. Frequency Response Curves
**Goal**: Color the sound

**Presets**:
- Flat (true physics)
- Bright (high-shelf boost)
- Warm (low-shelf boost)
- Presence (midrange boost)
- Custom (user EQ curve)

### 4. Non-Linearities
**Goal**: Saturation, distortion, character

**Options**:
- Soft clipping (tape saturation)
- Hard clipping (distortion)
- Transformer saturation
- Valve/tube warmth

---

## Performance Optimizations

### WebAssembly Physics
**Goal**: Faster membrane simulation

**Benefits**:
- 10-100x faster than JavaScript
- Higher grid resolution possible
- Multiple membranes in real-time

**Tools**:
- Emscripten (C/C++ → WASM)
- AssemblyScript (TypeScript-like)
- Rust → WASM

### Web Workers
**Goal**: Audio processing off main thread

**Use Cases**:
- Sample rate conversion in worker
- FFT analysis in worker
- WebSocket send/receive in worker

### SharedArrayBuffer
**Goal**: Zero-copy data sharing

**Benefits**:
- Physics → Audio without copying
- Lower latency
- Higher throughput

---

## Creative Tools

### Save/Load Presets
**Data to Save**:
- Actuator positions and settings
- Collector positions and settings
- Membrane properties (tension, damping)
- Audio source configurations
- Boundary conditions

**Format**: JSON file
**UI**: Preset dropdown menu

### Parameter Automation
**Goal**: Change parameters over time

**Examples**:
- Sweep collector position around membrane
- Automate damping for evolving reverb
- LFO on actuator gain
- Envelope on wave speed

### Multiple Membranes
**Goal**: Serial/parallel processing

**Use Cases**:
- Membrane 1 output → Membrane 2 input (cascaded reverb)
- Send/return architecture (like DAW)
- Different materials (drum, guitar, water)

### Visual Customization
**Current**: Cyan/magenta height coloring
**Options**:
- Color schemes (fire, ocean, monochrome)
- Displacement amplitude visualization
- Energy/velocity heatmap
- Particle trails following waves

### Boundary Condition Editor
**Goal**: Change membrane shape/constraints

**Options**:
- Fixed (current)
- Free (no boundaries)
- Periodic (wraps around)
- Custom shapes (circular, polygonal)
- Obstacles (pillars in membrane)

---

## Integration Features

### MIDI Input
**Goal**: Musical control

**Mappings**:
- Note on → Strike membrane at position
- Note velocity → Actuator force
- CC knobs → Membrane parameters
- Pitch bend → Collector position sweep

### OSC Support
**Goal**: Control from other software

**Use Cases**:
- TouchOSC mobile control
- Max/MSP integration
- VCV Rack control
- Live coding (SuperCollider, Sonic Pi)

### Recording & Export
**Goal**: Capture performances

**Features**:
- Record collector output to WAV
- Record video of membrane + audio
- Export preset configurations
- Render offline (faster than real-time)

---

## Priority Order (My Suggestion)

1. **WaveSurfer integration** - Makes file playback actually usable
2. **JACK output completion** - Get sound working end-to-end
3. **Save/load presets** - Don't lose good setups
4. **Multiple input sources** - Unlock creative potential
5. **Collector polar patterns** - More interesting spatial capture
6. Everything else - Nice to have

---

**Note**: Don't build these until you need them. Get JACK output working first!
