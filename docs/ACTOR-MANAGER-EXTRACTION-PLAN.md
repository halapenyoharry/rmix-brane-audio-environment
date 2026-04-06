# Extraction Plan: Actuator/Collector Management → `src/core/actor-manager.js`

**Date:** 2026-03-27
**Branch:** `refactor/worklet-physics`
**Author:** Architecture review (Claude, Anthropic — via Claude Code)
**Executor:** Claude Code (IDE agent)

---

## Context

The monolith (`brane-with-collectors-websocket.html`, ~3000 lines) contains all
actuator and collector management inline: class definitions, add/clear operations,
grid-space synchronization to the worklet, visual sphere creation, raycaster click
handling for placement and removal, and two-way updates with the mini-membrane
visualizer.

This is entangled with Three.js scene management and DOM state — but the core
logic has a clean boundary: the actuator/collector system *transforms* spatial
click events and membranes state into synchronized worklet messages and visual
updates. Everything else is wiring.

This extraction is **Slice 2** from the INTEGRATION-PLAN.md roadmap (line 302).
It reduces the monolith by ~200 lines of pure actor management and creates a
module that can grow into full source-aware force simulation later (pods,
channels, frequency mapping).

## What We're Extracting

All code that answers: "given a click on the membrane, place an actuator/collector.
Given a worklet, keep it aware of all placements. Given a removal, clean up both
visuals and worklet state."

Specifically:

1. **Actuator class** — constructor, `apply()`, `updateVisual()` (lines 518–634)
2. **Collector class** — constructor, `sample()` (lines 637–689)
3. **Add operations** — `addActuator()`, `addCollector()` with sphere creation
   (lines 947–995)
4. **Clear operations** — `clearActuators()`, `clearCollectors()` (lines 922–936)
5. **Worklet synchronization** — `syncActuatorsToWorklet()`,
   `syncCollectorsToWorklet()` (lines 436–458)
6. **Click handling** — raycaster setup, mouse coordinates, click listener with
   placement/removal logic (lines 1638–1700)

## What We're NOT Extracting (Yet)

- **Mini-membrane visualizer** (`updateMiniMembrane` at line 2775+) — stays in
  monolith for now. The actor-manager calls `updateMiniMembrane()` as a callback.
  Later, when we extract the visualizer system, it becomes a proper event emitter.
- **Demo mode oscillator** (lines 1719–1749) — stays in monolith. It uses
  `audioContext` and `demoMode` state that belongs to audio source management
  (Slice 3). The actuator/collector system doesn't drive the demo; the demo
  drives sources.
- **Physics integration** (`Actuator.apply()` and `Collector.sample()`) —
  these read `physics.heights` and `physics.velocities` directly, which is
  correct. They stay as-is. When the pod system is redesigned (Slice 5), pods
  will own their own physics readers.

## New Architecture (Target)

```
┌─────────────────────────────────────────────────────────────────┐
│  Monolith (main thread)                                         │
│                                                                  │
│  animate() {                                                     │
│      ...                                                         │
│      updateAudioData()                                           │
│      updateAudioVisualizers()                                    │
│                                                                  │
│      // Actuator visuals updated by callback inside manager     │
│      actorManager.updateVisualsFromSnapshot(                     │
│          workletSnapshot, workletGridSize, gridSize              │
│      )                                                           │
│                                                                  │
│      updatePhysics()                                             │
│      ...                                                         │
│  }                                                               │
│                                                                  │
│  mouse click event listener:                                     │
│      → actorManager.handleClick(raycaster, membrane, event)      │
└──────────────┬──────────────────────────────────────────────────┘
               │ import
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/core/actor-manager.js (ES module)                           │
│                                                                  │
│  Classes:                                                        │
│    - Actuator                                                    │
│    - Collector                                                   │
│                                                                  │
│  Exports:                                                        │
│    init(scene, camera, membrane) → { api }                       │
│                                                                  │
│  API methods (returned by init):                                 │
│    - addActuator(x, y, channel) → Actuator                       │
│    - addCollector(x, y, config) → Collector                      │
│    - clearActuators() → void                                     │
│    - clearCollectors() → void                                    │
│    - handleClick(raycaster, event) → void                        │
│    - updateVisualsFromSnapshot(snapshot, wGridSize, rGridSize)   │
│    - syncActuatorsToWorklet(worklet) → void                      │
│    - syncCollectorsToWorklet(worklet) → void                     │
│    - getActuators() → Array                                      │
│    - getCollectors() → Array                                     │
│                                                                  │
│  Reads from monolith:                                            │
│    - window.paramBus for parameter reads                         │
│    - physics object for heights/velocities (passed at init)      │
│                                                                  │
│  Calls monolith callbacks:                                       │
│    - updateMiniMembrane() [provided at init]                     │
│    - mapper for color/frequency mapping [provided at init]       │
│                                                                  │
│  Owns:                                                           │
│    - Actuators and Collectors arrays                             │
│    - Raycaster and mouse tracking                                │
│    - Sphere creation and removal logic                           │
│    - Worklet sync protocol                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Contract

The extracted module is a **classic script with IIFE**. One function. Not an ES
module (to avoid async timing issues). Not a class. Not a pod.

```javascript
// src/core/actor-manager.js
(function() {
    /**
     * Initialize the actuator/collector management system.
     * Sets up raycaster, click handlers, and owns the arrays of actors.
     *
     * @param {THREE.Scene} scene — the Three.js scene for adding/removing spheres
     * @param {THREE.Camera} camera — the camera for raycasting
     * @param {THREE.Mesh} membrane — the membrane mesh for raycasting
     * @param {object} physicsRef — reference to physics object { heights, velocities }
     * @param {object} options — configuration:
     *        - updateMiniMembrane: callback fn() to update mini-membrane visualizer
     *        - mapper: MappingCurveEngine instance (optional, for color/frequency)
     *        - getWorklet: callback fn() that returns current membraneWorklet (or null)
     *        - gridSize: current render grid size
     *        - membraneSize: membrane spatial size
     * @returns {{ 
     *   addActuator, addCollector, clearActuators, clearCollectors,
     *   handleClick, updateVisualsFromSnapshot, getActuators, getCollectors
     * }}
     */
    function init(scene, camera, membrane, physicsRef, options = {}) { ... }

    // Export via window (synchronous, no async timing issues)
    window._actorManager = { init };
})();
```

### Why this contract

The monolith owns `scene`, `camera`, and `membrane` (raycasting depends on
camera state changes, resize/orbit). The actor-manager receives these as
parameters and uses them.

The `updateMiniMembrane()` callback allows the actor-manager to declare "the set
of actors changed" without knowing about mini-membrane internals. The monolith
implements this callback.

The `getWorklet` getter function solves the chicken-and-egg: worklet is created
asynchronously and may not exist (fallback mode). The manager calls this getter
whenever it needs to sync, and auto-syncs if a worklet is available. No
manual sync calls needed in the monolith.

The `mapper` object is optional — if not provided, actors fall back to hardcoded
colors.

### ParamBus Integration

The actor-manager reads parameter values from `window.paramBus` but does NOT
write to it. Specifically:

- **`membrane_actuator_gain`** — read in `Actuator.apply()` (currently reads
  `window.actuatorGain`, which is synced to ParamBus)
- **`membrane_damping`** and other physics params — delegated to the worklet;
  the monolith's `updatePhysics()` already forwards these via ParamBus dirty-check

For the initial extraction, the actor-manager inherits all current ParamBus
behaviors without change. No new keys are added in this slice.

---

## Step-by-Step Tasks for Claude Code

### IMPORTANT: Test after every step. Load in browser, confirm no regressions.

### Step 1: Create `src/core/actor-manager.js` with class definitions

Extract into the new module:

**From lines 518–634** (Actuator class):
```javascript
class Actuator {
    constructor(x, y, channel = 'mono') { ... }
    apply() { ... }
    updateVisual() { ... }
}
```

**From lines 637–689** (Collector class):
```javascript
class Collector {
    constructor(x, y, config = {}) { ... }
    sample() { ... }
}
```

Both classes stay as-is. Byte-identical extraction.

The Actuator class references `window.actuatorGain` and `physics` object —
both will be passed in via the `init()` call's `physicsRef` parameter.

**Acceptance:**
- `src/core/actor-manager.js` exists
- Both class definitions are present
- Module parses without errors (check browser console)
- No visual changes yet

### Step 2: Create `init()` function with worklet sync and auto-sync

In the same module, implement:

```javascript
function init(scene, camera, membrane, physicsRef, options = {}) {
    const _scene = scene;
    const _camera = camera;
    const _membrane = membrane;
    const _physics = physicsRef;
    const _gridSize = options.gridSize;
    const _membraneSize = options.membraneSize;
    const _updateMiniMembrane = options.updateMiniMembrane || (() => {});
    const _mapper = options.mapper || null;
    const _getWorklet = options.getWorklet || (() => null);

    const actuators = [];
    const collectors = [];

    // Raycaster setup — moved from monolith lines 1638-1639
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Helper: map render-grid actuator to worklet-grid coords
    // Called internally after add/remove — worklet ref is fetched dynamically
    function syncActuatorsToWorklet() {
        const worklet = _getWorklet();
        if (!worklet) return;
        const scale = worklet.gridSize / _gridSize;
        worklet.setActuators(actuators.map(a => ({
            gridX: Math.round(a.gridX * scale),
            gridY: Math.round(a.gridY * scale),
            radius: Math.max(3, Math.round(a.baseSize * 1.5 * scale)),
            channel: a.channel
        })));
    }

    function syncCollectorsToWorklet() {
        const worklet = _getWorklet();
        if (!worklet) return;
        const scale = worklet.gridSize / _gridSize;
        worklet.setCollectors(collectors.map(c => ({
            gridX: Math.round(c.gridX * scale),
            gridY: Math.round(c.gridY * scale),
            mode: c.mode
        })));
    }

    // Add/clear operations — auto-sync to worklet after each change
    function addActuator(x, y, channel = 'mono') {
        const actuator = new Actuator(x, y, channel);
        actuators.push(actuator);
        // ... create sphere, add to scene ...
        syncActuatorsToWorklet();  // Auto-sync if worklet exists
        _updateMiniMembrane();
        return actuator;
    }

    function addCollector(x, y, config = {}) {
        const collector = new Collector(x, y, config);
        collectors.push(collector);
        // ... create sphere, add to scene ...
        syncCollectorsToWorklet();  // Auto-sync if worklet exists
        _updateMiniMembrane();
        return collector;
    }

    function clearActuators() {
        actuators.forEach(act => {
            if (act.visual) _scene.remove(act.visual);
        });
        actuators.length = 0;
        syncActuatorsToWorklet();  // Notify worklet of empty set
        _updateMiniMembrane();
    }

    function clearCollectors() {
        collectors.forEach(col => {
            if (col.visual) _scene.remove(col.visual);
        });
        collectors.length = 0;
        syncCollectorsToWorklet();
        _updateMiniMembrane();
    }

    // Click handler — raycaster event processing
    // Called by monolith's click event listener (see Step 5)
    function handleClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, _camera);
        
        // ... hit test logic for add/remove ...
    }

    // Visual update from worklet snapshot
    function updateVisualsFromSnapshot(snapshot, workletGridSize, renderGridSize) {
        // ... update actuator sphere positions from snapshot ...
    }

    // Return public API (no click listener attachment here)
    return {
        addActuator,
        addCollector,
        clearActuators,
        clearCollectors,
        handleClick,
        updateVisualsFromSnapshot,
        getActuators: () => [...actuators],
        getCollectors: () => [...collectors]
    };
}
```

**Key design decisions:**
- `getWorklet` is a getter function (not a reference) — called whenever sync is needed
- Auto-sync happens inside `addActuator()`, `addCollector()`, `clearActuators()`,
  `clearCollectors()` — every structural change syncs to worklet if one exists
- Worklet may not exist (fallback mode) — getter returns null, sync is a no-op
- Worklet may be created later (async) — getter always checks current state
- Click listener is NOT attached here — monolith owns the event source

**Acceptance:**
- `init()` is exported
- Both sync functions are present
- Both add/clear pairs are present
- Module parses without errors

### Step 3: Add classic script tag to load actor-manager

Load `src/core/actor-manager.js` as a classic script (synchronously), AFTER the
renderer script, BEFORE the main `<script>` tag:

```html
<script src="src/core/actor-manager.js"></script>
```

The file uses an IIFE to set `window._actorManager` synchronously, ensuring the
main script can call it without timing issues.

**Acceptance:**
- No console errors on load
- `window._actorManager` exists in console (set synchronously)
- `window._actorManager.init` is a function
- Main script can call it without undefined errors

### Step 4: Wire `init()` — replace inline class definitions and setup in monolith

Replace **lines 518–689** (both class definitions) with nothing — they're gone.

Replace **lines 1638–1639** (raycaster and mouse setup) with nothing — moved to
module.

In the monolith's script setup section (after ParamBus/renderer init, after
`initWorklet()` function is defined), call:

```javascript
// Initialize actuator/collector management
const actorManager = window._actorManager.init(
    scene,
    camera,
    membrane,
    physics,
    {
        updateMiniMembrane: updateMiniMembrane,
        mapper: mapper,
        gridSize: gridSize,
        membraneSize: membraneSize,
        getWorklet: () => membraneWorklet  // Getter for async worklet ref
    }
);
```

Now `actuators`, `collectors`, and all sync/add/clear functions are owned by
the manager. The monolith no longer declares these.

**Note:** All downstream references to `actuators` and `collectors` change:
- `actuators` → `actorManager.getActuators()`
- `collectors` → `actorManager.getCollectors()`

OR, for efficiency, store a local ref after init:
```javascript
const { getActuators, getCollectors } = actorManager;
```

Then use `getActuators()` and `getCollectors()` in loops. This keeps arrays
encapsulated in the manager.

**Acceptance:**
- Page loads identically
- No console errors
- Click on membrane — actuator sphere appears
- Shift+click — collector sphere appears
- Click on sphere — it disappears

### Step 5: Wire click handler — monolith owns the listener, delegates to manager

This is the ONLY place where the click event listener is attached (not in Step 2).

Replace **lines 1641–1700** (the click event listener) with:

```javascript
renderer.domElement.addEventListener('click', (event) => {
    actorManager.handleClick(event);
});
```

The monolith owns the event source (`renderer.domElement`). The actor-manager's
`handleClick(event)` method does all the work: raycaster setup, hit testing,
placement/removal, and callbacks to `updateMiniMembrane()`.

**Acceptance:**
- Click on membrane → actuator appears
- Click on actuator → it disappears
- Shift+click on membrane → collector appears
- Shift+click on collector → it disappears

### Step 6: Wire the getWorklet getter and visual updates

In the monolith's initialization (after `actorManager = window._actorManager.init(...)`),
ensure `actorManager` has the current worklet reference. The manager calls
`_getWorklet()` internally whenever it needs to sync (after add/remove operations).

The worklet is created asynchronously in `initWorklet()`. The getter will return
null until the worklet exists, then return the worklet instance. The manager
auto-syncs whenever a worklet becomes available.

In the monolith's `animate()` loop (line ~1834–1854), replace the visual update
logic:

**BEFORE** (lines 1840–1853):
```javascript
actuators.forEach(actuator => {
    if (!actuator.visual || !workletSnapshot) return;
    const ws = workletGridSize;
    const wStride = ws + 1;
    const scale = ws / gridSize;
    const wi = Math.round(actuator.gridX * scale);
    const wj = Math.round(actuator.gridY * scale);
    if (wi >= 0 && wi <= ws && wj >= 0 && wj <= ws) {
        const memHeight = workletSnapshot[wi * wStride + wj];
        const waveH = material.uniforms.waveHeight.value;
        actuator.visual.position.y = memHeight * waveH;
    }
});
```

**AFTER**:
```javascript
actorManager.updateVisualsFromSnapshot(workletSnapshot, workletGridSize, gridSize);
```

**Acceptance:**
- Click to place actuator
- Play audio (or enable demo mode)
- Membrane deforms, actuator sphere follows the surface height
- Raycaster still works (click on sphere removes it)
- No manual sync calls needed in monolith — manager auto-syncs on add/remove

### Step 7: Update grid-change logic in `rebuildMesh()`

When the grid size changes (line ~900–920), `clearActuators()` and
`clearCollectors()` are called. Change:

**BEFORE**:
```javascript
clearActuators();
clearCollectors();
```

**AFTER**:
```javascript
actorManager.clearActuators();
actorManager.clearCollectors();
```

Behavior is identical (actors are cleared when grid changes, grid coords are
stale).

**Acceptance:**
- Drag grid-size slider
- All actuators/collectors disappear
- Can place new ones at new grid resolution

### Step 8: Update keyboard shortcuts

In the keyboard event listener (line ~1776–1780), change:

**BEFORE**:
```javascript
} else if (e.key === 'c' || e.key === 'C') {
    clearActuators();
} else if (e.key === 'm' || e.key === 'M') {
    clearCollectors();
}
```

**AFTER**:
```javascript
} else if (e.key === 'c' || e.key === 'C') {
    actorManager.clearActuators();
} else if (e.key === 'm' || e.key === 'M') {
    actorManager.clearCollectors();
}
```

Also update the 'clear-all' tile action (line ~2120–2121):

**BEFORE**:
```javascript
clearActuators();
clearCollectors();
```

**AFTER**:
```javascript
actorManager.clearActuators();
actorManager.clearCollectors();
```

**Acceptance:**
- Press 'C' key — all actuators disappear
- Press 'M' key — all collectors disappear
- 'Clear All' button on controls — both cleared

### Step 9: Remove dead code from monolith

After Steps 4–8, the following monolith code is dead:

- **Actuator class definition** (was lines 518–634)
- **Collector class definition** (was lines 637–689)
- **`syncActuatorsToWorklet()` function** (was lines 436–445) — now internal to manager
- **`syncCollectorsToWorklet()` function** (was lines 450–458) — now internal to manager
- **`clearActuators()` function** (was lines 922–929)
- **`clearCollectors()` function** (was lines 931–936)
- **`addActuator()` function** (was lines 947–969)
- **`addCollector()` function** (was lines 972–995)
- **Raycaster and mouse setup** (was lines 1638–1639)
- **Click event listener** (was lines 1641–1700)
- **Actuator visual update block in animate()** (was lines 1840–1853)

Verify none of these remain. The monolith's `animate()` function should now
look like:

```javascript
function animate() {
    const now = performance.now();
    logFrame(now - lastFrameTime);
    lastFrameTime = now;
    stats.begin();
    requestAnimationFrame(animate);

    updateAudioData();
    updateAudioVisualizers();

    // Actuator visual updates delegated to manager
    actorManager.updateVisualsFromSnapshot(workletSnapshot, workletGridSize, gridSize);

    updatePhysics();

    material.uniforms.time.value = Date.now() * 0.001;

    controls.update();
    renderer.render(scene, camera);
    stats.end();
}
```

**Acceptance:**
- `grep -n "class Actuator\|class Collector\|function addActuator\|function addCollector\|function syncActuators\|function syncCollectors" brane-with-collectors-websocket.html` returns zero hits
- `grep -n "const raycaster\|const mouse" brane-with-collectors-websocket.html` returns zero hits (moved to manager)

### Step 10: Commit checkpoint

```bash
git add src/core/actor-manager.js brane-with-collectors-websocket.html
git commit -m "refactor: extract actuator/collector management into src/core/actor-manager.js

Moves Actuator and Collector class definitions, add/clear/sync operations,
and raycaster click handling into a standalone ES module. The monolith imports
it via a <script type=module> bridge and calls actorManager.init(scene, camera,
membrane, physics, options).

Visual updates from worklet snapshots are delegated to manager via
updateVisualsFromSnapshot(). Click handling is fully encapsulated within the
manager and called via handleClick(event).

No visual or behavioral changes. All existing functionality (placement, removal,
worklet sync, mini-membrane callbacks) preserved.

Architecture contract: Slice 2 of INTEGRATION-PLAN.md"
```

---

## What NOT to Do

1. **Do NOT make `actor-manager.js` a class.** One function (`init`). Module-level
   state. The API is the returned object. No constructors, no `this`, no
   inheritance.

2. **Do NOT move demo mode into the manager.** Demo oscillator state is audio
   source management, not actor management. Actors are spatial; sources are
   temporal. Different responsibilities.

3. **Do NOT change Actuator.apply() or Collector.sample() physics logic.** These
   are correct. They read from `physics.heights` and `physics.velocities`, which
   is the right place. When the pod system is redesigned (Slice 5), pods will own
   their own readers.

4. **Do NOT create getters that return copies of actuators/collectors arrays.**
   Return the actual arrays (or bound methods that read them). The animate loop
   needs to iterate efficiently.

5. **Do NOT pass `membrane` as part of `options`.** It's a required parameter —
   raycasting depends on it. Keep it as a direct argument.

6. **Do NOT add ParamBus persistence for actor positions yet.** Actors are
   ephemeral — when you reload the page, they disappear. This is correct for now.
   Later, when we implement session save/restore, actors can serialize through
   ParamBus. Not this slice.

7. **Do NOT move mini-membrane logic into the manager.** The manager calls a
   callback (`updateMiniMembrane`) when the actor set changes. The monolith
   implements it. This keeps them decoupled — mini-membrane can be extracted
   later without touching actor-manager.

8. **Do NOT change the shader or material uniforms.** The actor-manager reads
   `material.uniforms.waveHeight.value` (passed from monolith if needed) but
   doesn't own the material. Keep it in the renderer.

9. **Do NOT touch `membrane-physics-core.js`, `membrane-worklet-processor.js`,
   or `membrane-worklet-node.js`.** Physics and worklet are correct. This slice
   is pure management.

---

## After This Is Done

The next slices (in order, unchanged from INTEGRATION-PLAN.md):

1. **Extract audio source switching** into `src/audio/source-manager.js`
   - Tab capture, mic, file input, demo loops
   - Each source returns `{ connect(), disconnect() }`
   - Reduces monolith by ~400 lines

2. **Convert legacy slider tiles to module-based components**
   - Each tile type becomes `src/ui/tiles/<name>.js`
   - Exports `create(container, paramBus)`

3. **Redesign pod system around actual signal flow**
   - Pods declare ports that map to real worklet messages
   - Pod state serializes through ParamBus

---

## Verification Checklist (for Harold)

After Claude Code completes Steps 1–10:

- [ ] Load page — membrane renders, control tiles visible
- [ ] Click on membrane — actuator sphere appears (solid colored sphere)
- [ ] Shift+click on membrane — collector sphere appears (green wireframe)
- [ ] Click on actuator sphere — it disappears
- [ ] Shift+click on collector sphere — it disappears
- [ ] Play audio with actuators placed — audio drives worklet, membrane deforms
- [ ] Actuator spheres follow membrane surface height in real time
- [ ] Press 'C' key — all actuators disappear
- [ ] Press 'M' key — all collectors disappear
- [ ] 'Clear All' button — both actuators and collectors disappear
- [ ] Drag grid-size slider — actors are cleared (grid coords become stale)
- [ ] Freeze button works (waves stop, geometry is static)
- [ ] No console errors related to actors, raycasting, or undefined
- [ ] `grep "class Actuator\|class Collector\|function addActuator" brane-with-collectors-websocket.html` returns zero hits
- [ ] `src/core/actor-manager.js` contains class defs, init(), and API exports
- [ ] Monolith is ~200 lines shorter (verify with `wc -l`)
