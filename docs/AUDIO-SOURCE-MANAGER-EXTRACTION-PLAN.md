# Extraction Plan: Audio Source Management → `src/audio/source-manager.js`

**Date:** 2026-04-06
**Branch:** `refactor/worklet-physics`
**Author:** Architecture review (Claude, Anthropic — via Claude Code)
**Executor:** Claude Code (IDE agent)

---

## Context

The monolith (`brane-with-collectors-websocket.html`, ~2500 lines) contains all audio source
management inline: microphone input (via MicrophoneInput helper), tab audio capture (via
getDisplayMedia), file input (via file picker), and demo loops (local audio files). Each
source initializes its own Web Audio graph, creates analysers for visualization and actor
feedback, and routes to the worklet via `connectSourceToWorklet()`.

This code is entangled with UI state (audioEnabled, demoMode, audioFileMode) and audio
context lifecycle — but the core logic has a clean boundary: source management transforms
user gestures (click mic button, select file, etc.) into running audio sources that drive
the membrane physics. Everything else is wiring.

This extraction is **Slice 3** from the INTEGRATION-PLAN.md roadmap (line 307).
It reduces the monolith by ~400 lines of audio source logic and creates a module that can
grow into per-source configuration, effects chains, and source persistence later.

## What We're Extracting

All code that answers: "given a user intent (mic, tab, file, demo), start an audio source
that produces left/right stereo samples."

Specifically:

1. **Audio context and analyser setup** — lazy-init patterns for AudioContext, createAnalyser,
   stereo channel splitting (scattered throughout ~lines 449–480, 773–805, 824–862, etc.)
2. **connectSourceToWorklet()** — routes any source to the worklet (lines 433–435)
3. **Microphone input** — `toggleMic()` with MicrophoneInput helper (lines 823–886)
4. **Tab audio capture** — `captureTabAudio()` + `stopTabAudio()` with getDisplayMedia
   (lines 888–976)
5. **File input** — `initAudioFile()` + `loadAudioFile()` wrapper (lines 746–820)
6. **Demo loops** — `playLoop()` with toggle and round-robin cycling (lines 979–1055)
7. **Demo oscillator** — `toggleDemo()`, `startDemoOscillator()`, `stopDemoOscillator()`
   (lines 1381–1427)
8. **Audio state aggregation** — updateAudioData() reads from analysers, publishes to actor
   system (lines 1211–1216)
9. **Audio state variables** — audioEnabled, demoMode, audioFileMode, tabAudioActive,
   micActive (lines 449–480)

## What We're NOT Extracting (Yet)

- **Audio visualizers** — `drawTileSpectrum()` and tile waveform rendering (lines 1219+).
  These read from analysers but are UI-layer. Stay in monolith. Manager exposes analysers
  via getters so visualizers can still read them.
- **Collector audio output** — `stopAudioOutput()`, ScriptProcessor setup (lines 1325+).
  This is audio synthesis (membrane → audio), not input management. Stays in monolith for now.
- **Keyboard instrument** — `keyboardActive`, note on/off, oscillator pools (lines 1057–1093).
  This is a specialized input source that deserves its own future module. Skip for this slice.
- **ParamBus parameter forwarding** — audio sources don't read/write ParamBus. They just produce
  samples that actors consume. Keep it simple.

## New Architecture (Target)

```
┌─────────────────────────────────────────────────────────────────┐
│  Monolith (main thread)                                         │
│                                                                  │
│  animate() {                                                     │
│      updateAudioData()                                           │
│      sourceManager.updateAnalysers()  ← get current L/R samples │
│      ...                                                         │
│  }                                                               │
│                                                                  │
│  Tile click handlers:                                            │
│      → sourceManager.toggleMic()                                 │
│      → sourceManager.captureTabAudio()                           │
│      → sourceManager.selectFile()                                │
│      → sourceManager.playLoop()                                  │
│      → sourceManager.toggleDemo()                                │
└──────────────┬──────────────────────────────────────────────────┘
               │ import
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/audio/source-manager.js (classic script, IIFE)              │
│                                                                  │
│  Owns:                                                           │
│    - AudioContext lifecycle (lazy-init, resume on gesture)      │
│    - All analysers (left, right, per-source or shared)          │
│    - Source routing (connects audio → worklet)                  │
│    - Audio state (audioEnabled, demoMode, etc.)                 │
│    - Active source tracking (which source is playing)           │
│                                                                  │
│  Exports:                                                        │
│    - toggleMic() → starts/stops microphone                       │
│    - captureTabAudio() → starts browser tab capture              │
│    - selectFile() → opens file picker, loads & plays            │
│    - playLoop() → cycles through demo loops                      │
│    - toggleDemo() → starts/stops demo oscillator                 │
│    - updateAnalysers() → reads current L/R samples              │
│    - getAnalysers() → { left, right } for visualizers            │
│    - getAudioContext() → for direct audio work if needed         │
│    - getAudioState() → { audioEnabled, demoMode, ... }          │
│    - connectSourceToWorklet(sourceNode) → route to physics       │
│                                                                  │
│  Reads from window:                                              │
│    - membraneWorklet (set by monolith)                           │
│    - paramBus (optional, if we add volume control later)         │
│                                                                  │
│  Calls monolith callbacks:                                       │
│    - updateToggleStates() [provided at init]                     │
└─────────────────────────────────────────────────────────────────┘
```

## Contract

The extracted module is a **classic script with IIFE**. Standalone functions. Not a class.
Not a pod.

```javascript
// src/audio/source-manager.js
(function() {
    /**
     * Initialize audio source management system.
     * Lazy-inits AudioContext, manages all audio sources.
     *
     * @param {object} options — configuration:
     *        - updateToggleStates: callback fn() to update UI toggle states
     *        - getWorklet: callback fn() returning current membraneWorklet (or null)
     * @returns {{
     *   toggleMic, captureTabAudio, selectFile, playLoop, toggleDemo,
     *   updateAnalysers, getAnalysers, getAudioContext, getAudioState,
     *   connectSourceToWorklet
     * }}
     */
    function init(options = {}) { ... }

    window._sourceManager = { init };
})();
```

### API Contract

**Control methods** (called by tile click handlers):

- `toggleMic()` — async, starts/stops microphone with permission prompt
- `captureTabAudio()` — async, starts/stops browser tab capture
- `selectFile()` — opens file picker, plays selected audio
- `playLoop()` — cycles through demo-loops/, toggle play/pause
- `toggleDemo()` — starts/stops sine wave generator

**State methods** (called by monolith):

- `updateAnalysers()` — reads current L/R samples from analysers, updates audio data buffers
- `getAnalysers()` — returns { left, right } analyser objects for visualizers
- `getAudioData()` — returns { left: Float32Array, right: Float32Array } audio sample buffers (consumed by actor-manager)
- `getAudioContext()` — returns the shared AudioContext (needed for direct audio work)
- `getAudioState()` — returns { audioEnabled, demoMode, audioFileMode, tabAudioActive, micActive }
- `connectSourceToWorklet(sourceNode)` — routes source audio to worklet

### Why this contract

Each source (mic, tab, file, loop) initializes its own stereo analysers and routing. The
manager owns all of them. The monolith reads from analysers for visualization and actor
feedback, but doesn't create or manage them.

The `updateToggleStates()` callback lets the manager signal "state changed" without owning
the UI. Monolith implements it to update button highlights, etc.

The `getWorklet()` getter allows async worklet creation (same pattern as actor-manager).

### Critical: AudioContext Lifecycle Bridge (Thing 1)

The monolith currently has multiple consumers of `audioContext`:
- `initWorklet()` passes audioContext to `new MembraneWorkletNode(audioContext, ...)`
- Keyboard instrument (oscillator pools) reference audioContext directly
- Collector ScriptProcessor output path uses audioContext

After extraction, all audioContext creation happens in source-manager. To avoid requiring
every consumer to call `sourceManager.getAudioContext()`, the manager **sets window.audioContext
as a legacy bridge** (same pattern ParamBus uses with syncToWindowGlobals).

When source-manager creates or resumes the audioContext, it also writes:
```javascript
window.audioContext = audioContext;
```

This allows existing code that references `audioContext` globally to continue working without
modification. It's a temporary bridge — future refactors can migrate to explicit getters.

### Critical: Audio Sample Buffer Consumer (Thing 2)

After `updateAnalysers()` reads from the Web Audio analysers, the buffers (leftAudioData,
rightAudioData) live inside source-manager. The actor-manager's `applyActuators()` method
reads these buffers to compute forces on the membrane.

To pass buffers from source-manager → actor-manager without tight coupling:
- source-manager exposes `getAudioData()` returning `{ left: Float32Array, right: Float32Array }`
- actor-manager calls `sourceManager.getAudioData()` internally (reads from shared scope)
- actor-manager does NOT rely on buffers passed via `updateDeps()` from the monolith

This prevents the audio signal flow bug we fixed in the worklet sync issue: if the monolith
forgets to pass buffers to `updateDeps()`, actuators won't receive audio samples and the
membrane won't move.

---

## Step-by-Step Tasks for Claude Code

### IMPORTANT: Test after every step. Load in browser, confirm no regressions.

### Step 1: Create `src/audio/source-manager.js` with class structure

Extract into the new module:

**Audio context setup** (lazy-init pattern, currently scattered):

- Global `audioContext` variable
- `AudioContext` or `webkitAudioContext` creation
- Resume on gesture (for browser autoplay policy)
- **IMPORTANT**: Module must set `window.audioContext` whenever the context is created or resumed (legacy bridge per Thing 1)

**Analyser setup** (currently scattered across each source init):

- Left and right analysers (fftSize 256, smoothingTimeConstant 0.3)
- Left and right audio data buffers (Float32Array)
- Stereo channel splitter setup

**connectSourceToWorklet()** (lines 433–435):

- Move as-is into module

**Audio state variables** (currently global):

- `audioEnabled`, `demoMode`, `audioFileMode`, `tabAudioActive`, `micActive`
- Move to module scope

**MicrophoneInput reference**:

- `let micInput = null` and management

**Demo state**:

- `demoOscillator`, `demoOscGain`, `demoLoops` array, `currentLoopIndex`

**File/tab/loop state**:

- `audioElement`, `audioElementSource`, `audioFileMode`
- `audioStream`, `tabAudioActive`
- `loopAudioElement`, `loopAudioSource`

**Acceptance:**
- `src/audio/source-manager.js` exists
- All state variables captured
- Module parses without errors

### Step 2: Create `init()` function with mic, tab, file, loop, demo exports

In the same module, implement:

```javascript
function init(options = {}) {
    const _updateToggleStates = options.updateToggleStates || (() => {});
    const _getWorklet = options.getWorklet || (() => null);

    // Lazy-init audioContext
    function ensureAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000
            });
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return audioContext;
    }

    // Lazy-init analysers
    function ensureAnalysers() {
        if (!leftAnalyser) {
            const ctx = ensureAudioContext();
            leftAnalyser = ctx.createAnalyser();
            leftAnalyser.fftSize = 256;
            leftAnalyser.smoothingTimeConstant = 0.3;
            leftAudioData = new Float32Array(leftAnalyser.fftSize);

            rightAnalyser = ctx.createAnalyser();
            rightAnalyser.fftSize = 256;
            rightAnalyser.smoothingTimeConstant = 0.3;
            rightAudioData = new Float32Array(rightAnalyser.fftSize);
        }
    }

    // Return public API
    return {
        toggleMic,
        captureTabAudio,
        selectFile,
        playLoop,
        toggleDemo,
        updateAnalysers,
        getAnalysers: () => ({ left: leftAnalyser, right: rightAnalyser }),
        getAudioData: () => ({ left: leftAudioData, right: rightAudioData }),
        getAudioContext: () => audioContext,
        getAudioState: () => ({ audioEnabled, demoMode, audioFileMode, tabAudioActive, micActive }),
        connectSourceToWorklet
    };
}
```

**Functions to implement:**

- `toggleMic()` (lines 823–886) — async, prompts for permission
- `captureTabAudio()` (lines 888–966) — async, getDisplayMedia
- `stopTabAudio()` (lines 968–976) — helper
- `selectFile()` / `initAudioFile()` (lines 753–820) — file picker
- `loadAudioFile()` wrapper (lines 746–748) — simple proxy
- `playLoop()` (lines 979–1055) — toggle + round-robin
- `toggleDemo()` (lines 1381–1395) — starts/stops demo osc
- `startDemoOscillator()` (lines 1397–1415) — creates sine wave
- `stopDemoOscillator()` (lines 1417–1427) — cleanup
- `updateAnalysers()` — reads L/R from analysers, updates buffers, and updates window.audioContext (Thing 1)
- `getAudioData()` — returns { left, right } buffers for actor-manager consumption (Thing 2)
- `connectSourceToWorklet(sourceNode)` (lines 433–435) — as-is

**Acceptance:**
- `init()` is exported
- All control methods present
- All state getters present
- Module parses without errors

### Step 3: Add classic script tag to load source-manager

Load `src/audio/source-manager.js` as a classic script (synchronously), AFTER actor-manager,
BEFORE the main `<script>` tag:

```html
<script src="src/audio/source-manager.js"></script>
```

**Acceptance:**
- No console errors on load
- `window._sourceManager` exists in console
- `window._sourceManager.init` is a function

### Step 4: Wire `init()` — initialize in monolith

Replace all audio state variable declarations (lines 449–480) with nothing — they move to
the module.

In the monolith's setup section (after actorManager init), call:

```javascript
const sourceManager = window._sourceManager.init({
    updateToggleStates: updateToggleStates,
    getWorklet: () => membraneWorklet
});
```

**CRITICAL IMPLEMENTATION DETAIL (Thing 1):**
When the source-manager's `ensureAudioContext()` function creates or resumes the audioContext,
it MUST set `window.audioContext = audioContext;`. This legacy bridge allows existing consumers
(initWorklet, keyboard, collector) to continue referencing audioContext without modification.

**CRITICAL IMPLEMENTATION DETAIL (Thing 2):**
When updateAnalysers() reads from the analysers and populates leftAudioData and rightAudioData,
the actor-manager needs access to these buffers. Rather than relying on monolith to call
updateDeps() with the buffers (error-prone), the source-manager MUST expose getAudioData()
which returns `{ left: leftAudioData, right: rightAudioData }`. The actor-manager will read
from this getter internally.

**Acceptance:**
- Page loads identically
- No console errors
- `sourceManager` variable exists in monolith scope
- `window.audioContext` is set after first user gesture

### Step 5: Wire audio tile click handlers

Replace calls to `loadAudioFile()`, `toggleMic()`, `captureTabAudio()`, `playLoop()`,
`toggleDemo()` in tile button handlers with:

```javascript
if (tileData.action === 'micInput') {
    sourceManager.toggleMic();
} else if (tileData.action === 'tabCapture') {
    sourceManager.captureTabAudio();
} else if (tileData.action === 'loadFile') {
    sourceManager.selectFile();
} else if (tileData.action === 'playLoop') {
    sourceManager.playLoop();
} else if (tileData.action === 'toggleDemo') {
    sourceManager.toggleDemo();
}
```

**Acceptance:**
- Click mic button — permission prompt appears, mic starts/stops
- Click tab button — tab audio capture dialog, audio flows
- Click file button — file picker, loads and plays
- Click loop button — plays demo loops, cycles on click
- Click demo button — sine wave starts/stops

### Step 6: Wire `updateAnalysers()` in animate loop

In `animate()`, replace the old `updateAudioData()` call:

**BEFORE**:
```javascript
function updateAudioData() {
    if (audioEnabled && leftAnalyser && rightAnalyser && leftAudioData && rightAudioData) {
        leftAnalyser.getFloatTimeDomainData(leftAudioData);
        rightAnalyser.getFloatTimeDomainData(rightAudioData);
    }
}
updateAudioData();
```

**AFTER**:
```javascript
sourceManager.updateAnalysers();
```

The manager now owns the analysers and updates them.

**Acceptance:**
- Waveform visualizers on tiles still show (tile visualizer code reads from analysers)
- Audio flows through system normally

### Step 7: Update audio visualizer code

The tile visualizer functions (drawTileSpectrum, etc.) currently reference global analysers.
They need to be updated to get analysers from the manager:

Replace references like:
```javascript
drawTileSpectrum(canvas, leftAnalyser, color);
```

With:
```javascript
const analysers = sourceManager.getAnalysers();
drawTileSpectrum(canvas, analysers.left, color);
```

Or, pass the manager reference to visualizer functions.

**Acceptance:**
- Waveform visualizers still render when audio is playing
- No console errors about undefined analysers

### Step 8: Remove dead code from monolith

After Steps 4–7, the following monolith code is dead:

- **Audio state variables** (was lines 449–480): audioContext, audioElement, audioFileMode,
  tabAudioActive, micInput, micActive, demoOscillator, demoOscGain, demoLoops, currentLoopIndex,
  loopAudioElement, loopAudioSource, and all related flags
- **Analyser setup** (scattered, now in module)
- **connectSourceToWorklet()** function (was lines 433–435)
- **loadAudioFile()** wrapper (was lines 746–748)
- **initAudioFile()** function (was lines 753–820)
- **toggleMic()** function (was lines 823–886)
- **captureTabAudio()** function (was lines 888–966)
- **stopTabAudio()** function (was lines 968–976)
- **playLoop()** function (was lines 979–1055)
- **toggleDemo()** function (was lines 1381–1395)
- **startDemoOscillator()** function (was lines 1397–1415)
- **stopDemoOscillator()** function (was lines 1417–1427)
- **updateAudioData()** function (was lines 1211–1216)

Verify with:
```bash
grep -n "function toggleMic\|function captureTabAudio\|function playLoop\|function toggleDemo\|function initAudioFile" brane-with-collectors-websocket.html
```
Should return zero hits.

**Acceptance:**
- No stray audio source functions remain
- No orphaned audio state variables
- Monolith is ~400 lines shorter

### Step 9: Commit checkpoint

```bash
git add src/audio/source-manager.js brane-with-collectors-websocket.html
git commit -m "refactor: extract audio source management into src/audio/source-manager.js

Moves microphone input (via MicrophoneInput), tab audio capture (via
getDisplayMedia), file input (via file picker), demo loops, and demo
oscillator into a standalone module.

AudioContext is lazy-initialized and shared across all sources. Analysers
are created on first use and exposed via getters for visualizers. All audio
routing (source → worklet) is centralized.

Audio state (audioEnabled, demoMode, tabAudioActive, micActive) is now
encapsulated in the manager. Monolith calls updateAnalysers() each frame
to read L/R samples.

Tile click handlers delegate to manager methods (toggleMic, captureTabAudio,
selectFile, playLoop, toggleDemo). Callback pattern for UI state updates.

No visual or behavioral changes. All existing functionality (mic, tab, file,
loop, demo) preserved and working identically.

Architecture contract: Slice 3 of INTEGRATION-PLAN.md"
```

---

## What NOT to Do

1. **Do NOT make source-manager.js an ES module.** Use classic script + IIFE (same as
   actor-manager). Async timing issues with module scripts would complicate initialization.

2. **Do NOT forget the audioContext legacy bridge (Thing 1).** When ensureAudioContext() creates
   or resumes the context, MUST set `window.audioContext = audioContext;`. Without this,
   initWorklet, keyboard oscillators, and collector output will fail with undefined audioContext.

3. **Do NOT forget the audio sample buffer consumer (Thing 2).** Must expose `getAudioData()`
   returning `{ left: leftAudioData, right: rightAudioData }`. Actor-manager will call this
   internally to get audio samples for force computation. Without this, actuators won't receive
   audio and the membrane won't move.

4. **Do NOT remove analysers.** Even though we're extracting source setup, analysers are
   the interface between sources and visualizers. Keep them as public getters.

4. **Do NOT add ParamBus integration yet.** Audio sources don't read or write ParamBus.
   Volume control, source balancing, etc. are future enhancements. Keep this slice focused.

5. **Do NOT move keyboard instrument.** The keyboard (oscillator pools, note on/off) is
   a specialized input source that deserves its own future module. It shares AudioContext
   but has separate logic. Skip it for now.

6. **Do NOT refactor visualizer code beyond the minimum.** Change the getAnalysers() calls,
   but leave drawTileSpectrum as-is. Visualizers are owned by UI layer, not by this module.

7. **Do NOT change the worklet input routing.** All sources connect via connectSourceToWorklet(),
   which is unchanged. The worklet still receives audio on the same channels.

8. **Do NOT touch MicrophoneInput.js or demo-loops folder.** These are external resources.
   We only manage their lifecycle, not their implementation.

---

## After This Is Done

The next slices (in order, unchanged from INTEGRATION-PLAN.md):

1. **Convert legacy slider tiles to module-based components**
   - Each tile type becomes `src/ui/tiles/<name>.js`
   - Exports `create(container, paramBus)` — no manifest/lifecycle overhead

2. **Redesign pod system around actual signal flow**
   - Pods declare ports that map to real worklet messages
   - Pod state serializes through ParamBus

---

## Verification Checklist (for Harold)

After Claude Code completes Steps 1–9:

- [ ] Load page — all tiles visible, no console errors
- [ ] Click mic button — permission prompt, mic starts, visualizer shows audio
- [ ] Click tab capture — dialog appears, select tab, audio flows
- [ ] Click file button — file picker, select audio, plays and drives membrane
- [ ] Click loop button — demo loops cycle, audio plays, waves propagate
- [ ] Click demo button — sine wave oscillator starts, membrane oscillates
- [ ] Stop each source — visualizers go silent, audio stops
- [ ] Start multiple sources together — all feed into worklet, effects combine
- [ ] Waveform visualizers on tiles — show audio spectrum while source is playing
- [ ] Play audio + click to add actuators — waves propagate from actuators
- [ ] No console errors related to audio, analysers, or audioContext
- [ ] `grep "function toggleMic\|function captureTabAudio\|function playLoop"` returns zero hits
- [ ] `grep "let audioEnabled\|let demoMode\|let tabAudioActive"` returns zero hits (outside module)
- [ ] Monolith is ~400 lines shorter (verify with `wc -l`)
