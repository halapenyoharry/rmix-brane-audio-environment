# Integration Plan: ParamBus + Worklet Wiring Fix

**Date:** 2026-03-27
**Branch:** `refactor/worklet-physics`
**Author:** Architecture review (Claude, Anthropic — via claude.ai)
**Executor:** Claude Code (IDE agent)

---

## Context

This project has two good systems that don't connect:

1. **AudioWorklet physics** (`membrane-worklet-processor.js`) — correct, audio-rate,
   glue-coupled, display-smoothed. This IS the physics engine now.

2. **Pod runtime** (`src/pod-runtime.js`, `src/pods/`) — clean interfaces, proper
   separation, serialization. But **never integrated** into the monolith.
   The monolith still uses legacy tiles from `tiles-config.json` with
   `window[variable] = value` as the entire parameter model.

The current parameter flow is:
```
slider drag → window.waveSpeed = value
                    ↓
          updatePhysics() reads window.waveSpeed every frame
                    ↓
          membraneWorklet.setWaveSpeed(value) — message port
```

This is dual-authority: window globals AND the worklet both "own" the value.
Parameters are forwarded 60x/sec whether they changed or not.

## What We're Fixing

Replace window globals with `ParamBus` as the single parameter authority.
Wire the worklet as the sole physics engine. Kill the zombie main-thread
physics path.

## New Architecture (Target)

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (main thread)                                  │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ WaveSpeed│  │ Damping  │  │  Gain    │  │Smoothing│ │
│  │ Slider   │  │ Slider   │  │ Slider   │  │ Slider  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│       ▼              ▼              ▼              ▼      │
│  ┌──────────────────────────────────────────────────┐    │
│  │               ParamBus (AUTHORITY)                │    │
│  │   .set('membrane_wave_speed', 0.3)               │    │
│  │   .get('membrane_damping')                        │    │
│  │   .on('membrane_actuator_gain', fn)               │    │
│  │   .getDirtyParams() → only changed values         │    │
│  └──────────────┬───────────────────────────────────┘    │
│                 │                                         │
│       ┌─────────┼───────────────────┐                    │
│       │   Frame Loop (animate)      │                    │
│       │   reads dirty params        │                    │
│       │   forwards to worklet       │                    │
│       │   writes window globals *   │                    │
│       │   renders Three.js mesh     │                    │
│       └─────────┬───────────────────┘                    │
│                 │ * legacy bridge, removed later          │
└─────────────────┼────────────────────────────────────────┘
                  │ postMessage (only when dirty)
                  ▼
┌─────────────────────────────────────────────────────────┐
│  AudioWorklet Thread                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  membrane-worklet-processor.js                     │  │
│  │  - Owns physics (wave equation, heights, velocity) │  │
│  │  - Owns glue coupling (actuator sphere geometry)   │  │
│  │  - Owns display smoothing (exponential low-pass)   │  │
│  │  - Sends snapshots at display refresh rate          │  │
│  │  - Audio I/O: inputs → actuators, collectors → out │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Step-by-Step Tasks for Claude Code

### IMPORTANT: Test after every step. Load in browser, confirm no regressions.

### Step 1: Add ParamBus import to the monolith

The monolith is a `<script>` tag (not a module). To use ES module imports,
either:
- (a) Change the monolith's `<script>` to `<script type="module">`, OR
- (b) Add a separate `<script type="module">` that imports ParamBus and
  exposes it as `window.paramBus`

Option (b) is safer — it doesn't require touching the entire script block:

```html
<script type="module">
    import { paramBus } from './src/core/param-bus.js';
    window.paramBus = paramBus;
</script>
```

Place this BEFORE the main `<script>` tag. The main script can then use
`window.paramBus` (or just `paramBus` since it's on window).

**Acceptance:** `paramBus.get('membrane_wave_speed')` returns `0.3` in console.

### Step 2: Boot-sync from legacy sliders into ParamBus

After `createTiles()` runs and sets `window.waveSpeed` etc., call:

```javascript
paramBus.syncFromWindowGlobals();
```

This captures the legacy slider defaults into the bus. After this line,
the bus is the authority.

**Acceptance:** After page load, `paramBus.get('membrane_wave_speed')` matches
the wave speed slider's default value.

### Step 3: Make legacy sliders write to ParamBus

In `createSliderTile()`, the `updateSlider(value)` function currently does:
```javascript
window[tileData.variable] = value;
```

Add a ParamBus write alongside it. The variable names map:
- `waveSpeed` → `membrane_wave_speed`
- `damping` → `membrane_damping`
- `actuatorGain` → `membrane_actuator_gain`
- `displaySmoothing` → `display_smoothing`

```javascript
const PARAM_MAP = {
    waveSpeed: 'membrane_wave_speed',
    damping: 'membrane_damping',
    actuatorGain: 'membrane_actuator_gain',
    displaySmoothing: 'display_smoothing'
};
// Inside updateSlider:
const paramId = PARAM_MAP[tileData.variable];
if (paramId && window.paramBus) {
    window.paramBus.set(paramId, value);
}
```

Keep `window[tileData.variable] = value` for now — that's the legacy bridge.
We'll remove it in a later step.

**Acceptance:** Dragging wave speed slider → `paramBus.get('membrane_wave_speed')`
updates in real time. Window global also updates (legacy bridge).

### Step 4: Make `updatePhysics()` read from ParamBus with dirty-checking

Replace the current every-frame forwarding:

```javascript
// BEFORE (runs every frame, always forwards):
function updatePhysics() {
    physics.waveSpeed = Number(window.waveSpeed);
    physics.damping = Number(window.damping);
    window.actuatorGain = Number(window.actuatorGain);
    if (membraneWorklet) {
        membraneWorklet.setWaveSpeed(physics.waveSpeed);
        membraneWorklet.setDamping(physics.damping);
        membraneWorklet.setActuatorGain(window.actuatorGain);
        if (window.displaySmoothing > 0) {
            membraneWorklet.setSmoothing(window.displaySmoothing);
        }
    }
    // ... render code follows
}
```

```javascript
// AFTER (only forwards when values actually changed):
function updatePhysics() {
    if (window.paramBus && membraneWorklet) {
        const dirty = paramBus.getDirtyParams();
        if (dirty.size > 0) {
            if (dirty.has('membrane_wave_speed'))
                membraneWorklet.setWaveSpeed(dirty.get('membrane_wave_speed'));
            if (dirty.has('membrane_damping'))
                membraneWorklet.setDamping(dirty.get('membrane_damping'));
            if (dirty.has('membrane_actuator_gain'))
                membraneWorklet.setActuatorGain(dirty.get('membrane_actuator_gain'));
            if (dirty.has('display_smoothing'))
                membraneWorklet.setSmoothing(dirty.get('display_smoothing'));
            paramBus.markAllForwarded();
        }
    }
    // Legacy bridge — keep main-thread physics object in sync for
    // any code still reading it (e.g. non-worklet fallback)
    if (window.paramBus) {
        physics.waveSpeed = paramBus.get('membrane_wave_speed');
        physics.damping = paramBus.get('membrane_damping');
        paramBus.syncToWindowGlobals();
    }
    // ... render code continues unchanged
}
```

**Acceptance:** Dragging wave speed slider → worklet receives new value.
No change when slider is idle (verify with console.log in setWaveSpeed).
Freeze button still works (it writes to ParamBus, not window.waveSpeed).

### Step 5: Fix freeze button to use ParamBus

The freeze button currently reads/writes `window.waveSpeed` directly.
Update `window.freezePhysics`:

```javascript
window.freezePhysics = function() {
    physicsFrozen = !physicsFrozen;
    if (physicsFrozen) {
        frozenWaveSpeed = paramBus.get('membrane_wave_speed');
        paramBus.set('membrane_wave_speed', 0);
    } else {
        paramBus.set('membrane_wave_speed', frozenWaveSpeed || 0.3);
    }
    updateToggleStates();
};
```

**Acceptance:** Freeze button stops wave propagation. Unfreeze restores
previous wave speed. Heightmap export captures frozen state.

### Step 6: Wire worklet init to read from ParamBus

`initWorklet()` currently reads `Number(window.waveSpeed)` etc.
Change to read from ParamBus:

```javascript
membraneWorklet = new MembraneWorkletNode(audioContext, {
    gridSize: workletGridSize,
    waveSpeed: paramBus.get('membrane_wave_speed'),
    damping: paramBus.get('membrane_damping'),
    actuatorGain: paramBus.get('membrane_actuator_gain'),
    boundaryType: 'fixed',
    collectorCount: 2
});
```

**Acceptance:** Worklet initializes with correct values from ParamBus.

### Step 7: Commit checkpoint

```bash
git add src/core/param-bus.js brane.html
git commit -m "feat: introduce ParamBus as single parameter authority

Replaces window globals (waveSpeed, damping, actuatorGain, displaySmoothing)
with a centralized parameter bus. Legacy window globals maintained as a
bridge during migration. Worklet forwarding is now dirty-checked (only
sends messages when values actually change).

Architecture contract: Rule 2 (Single State Ownership)"
```

---

## What NOT to do

1. **Do NOT import or integrate `src/pod-runtime.js`** — The pod system was
   designed for a pre-worklet architecture. It will be redesigned later around
   the actual signal flow (ParamBus + worklet). The existing pod files are
   reference material, not integration targets.

2. **Do NOT remove `membrane-physics-core.js`** yet — It serves as the
   non-worklet fallback. The `if (membraneWorklet && workletSnapshot)` branch
   in the render path is correct: if the worklet fails to init (e.g., no
   COOP/COEP headers for SharedArrayBuffer), main-thread physics still works.
   We'll remove it later when we have proper feature detection.

3. **Do NOT move the monolith to ES modules** yet — The `<script type="module">`
   wrapper for ParamBus is the minimal intrusion. Converting the entire 2900-line
   script block to a module changes load timing, variable scoping, and breaks
   the D3/Three.js script-tag assumptions. That's a separate task.

4. **Do NOT refactor the slider tile system** — Sliders work. They're ugly
   inside but they produce correct values. The ParamBus integration is additive
   (write to bus alongside window global), not a rewrite.

5. **Do NOT change the worklet processor** — `membrane-worklet-processor.js`
   is correct and tested. The wiring fix is entirely on the main thread side.

---

## After This Is Done

The next slices (in order) are:

1. **Extract Three.js renderer** into `src/visual/renderer.js`
   - Scene setup, material, geometry, mesh update, camera
   - The monolith calls `renderer.updateMesh(snapshot)` each frame
   - Reduces monolith by ~300 lines

2. **Extract actuator/collector management** into `src/core/actor-manager.js`
   - addActuator, addCollector, clearActuators, syncToWorklet
   - The monolith calls `actorManager.add(point, channel)`
   - Reduces monolith by ~200 lines

3. **Extract audio source switching** into `src/audio/source-manager.js`
   - Tab capture, mic, file input, demo loops
   - Each source is a function that returns `{ connect(), disconnect() }`
   - Reduces monolith by ~400 lines

4. **Convert legacy slider tiles to module-based components**
   - Each tile type becomes `src/ui/tiles/wave-speed-slider.js` etc.
   - Exports `create(container, paramBus)` — no manifest/lifecycle overhead
   - The tiles-config.json switches from inline `createSliderTile()` to
     dynamic import of the tile module

5. **Redesign pod system around actual signal flow**
   - Now that we know what the worklet needs, pods can declare ports
     that map to real worklet messages (not the old force-gateway model)
   - Pod state serializes through ParamBus, not through window globals
   - This is where the architecture gets beautiful — but only after the
     wiring is clean

Each slice is a bounded task with clear acceptance criteria that can be
handed to Claude Code independently.

---

## Verification Checklist (for Harold)

After Claude Code completes Steps 1-7:

- [ ] Load page, open console, run `paramBus.get('membrane_wave_speed')` — returns 0.3
- [ ] Drag wave speed slider — `paramBus.get('membrane_wave_speed')` updates
- [ ] Click membrane to add actuator, play audio — waves propagate correctly
- [ ] Freeze button works — waves stop, heightmap export captures frozen state
- [ ] Unfreeze — waves resume at previous speed
- [ ] Damping slider works — membrane rings longer at low damping
- [ ] Gain slider works — louder input = bigger waves
- [ ] Smoothing slider works — visual goes from creamy to crispy
- [ ] No console errors related to paramBus, worklet, or undefined
- [ ] Keyboard (if connected) produces sound that couples through actuators
