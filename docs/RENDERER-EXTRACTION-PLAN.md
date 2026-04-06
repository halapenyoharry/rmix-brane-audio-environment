# Extraction Plan: Three.js Renderer → `src/visual/renderer.js`

**Date:** 2026-03-27
**Branch:** `refactor/worklet-physics`
**Author:** Architecture review (Claude, Anthropic — via Claude Code)
**Executor:** Claude Code (IDE agent)

---

## Context

The monolith (`brane-with-collectors-websocket.html`, 2992 lines) contains all
Three.js rendering logic inline: scene setup, camera, lighting, shader material,
geometry creation, mesh update (including bilinear upsampling from worklet grid),
orbit controls, resize handling, and the render call itself.

This code is entangled with physics forwarding, actuator/collector visuals, and
UI state — but the core renderer has a clean boundary if you look at it right.
The renderer *consumes* a height snapshot and *produces* a frame. Everything else
is wiring.

This extraction is **Slice 1** from the INTEGRATION-PLAN.md roadmap (line 297).
It reduces the monolith by ~200 lines of pure rendering logic (scene setup,
material, geometry, mesh update, resize) and creates a module that can be tested
independently.

## What We're Extracting

All Three.js code that answers the question: "given a height snapshot, draw the
membrane." Specifically:

1. **Scene setup** — `scene`, `camera`, `renderer`, `controls` (lines 319–343)
2. **Lighting** — ambient + directional (lines 385–391)
3. **Geometry + material** — `PlaneGeometry`, `ShaderMaterial` with HSL vertex
   coloring (lines 393–453)
4. **Mesh update** — the render path inside `updatePhysics()` that writes
   worklet snapshot heights into geometry positions, including bilinear
   upsampling (lines 1716–1778)
5. **Resize handler** — `handleResize()` (lines 2960–2963)
6. **Geometry rebuild** — the Three.js half of `rebuildMesh()` (lines 994–996)

## What We're NOT Extracting (Yet)

- **Actuator/collector sphere creation** (`addActuator` line 1033, `addCollector`
  line 1059) — these create `THREE.Mesh` objects and call `scene.add()`. They
  stay in the monolith for now. The renderer will expose `getScene()` so the
  monolith can still add/remove objects.
- **Raycaster click handling** (lines 1782–1843) — depends on `actuators`,
  `collectors`, and placement logic. Stays in monolith. Uses the exported
  `getCamera()` and `getMembrane()`.
- **Stats/perf monitor** (lines 346–382) — stays in monolith's `animate()`.
- **Heightmap export** (`exportHeightmap`, lines 817–868) — reads `workletSnapshot`
  directly, no Three.js dependency. Stays.

## New Architecture (Target)

```
┌─────────────────────────────────────────────────────────────────┐
│  Monolith (main thread)                                         │
│                                                                  │
│  animate() {                                                     │
│      ...                                                         │
│      updatePhysics()           ← param forwarding only           │
│      renderer.updateMesh(      ← mesh update delegated           │
│          workletSnapshot,                                        │
│          gridSize,                                               │
│          renderGridSize                                          │
│      )                                                           │
│      controls.update()         ← still in monolith (via ref)     │
│      renderer.render()         ← or inlined via refs             │
│  }                                                               │
│                                                                  │
│  addActuator() {                                                 │
│      scene.add(indicator)      ← scene accessed via getScene()   │
│  }                                                               │
└──────────────┬──────────────────────────────────────────────────┘
               │ import
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/visual/renderer.js (ES module)                              │
│                                                                  │
│  Exports:                                                        │
│    init(container) → { scene, camera, renderer, controls,        │
│                        membrane, material }                      │
│    updateMesh(snapshot, workletGridSize, renderGridSize)          │
│                                                                  │
│  Reads from window.paramBus:                                     │
│    - waveHeight from material.uniforms (internal, set at init)   │
│    - wireframe toggle state                                      │
│                                                                  │
│  Owns:                                                           │
│    - Scene, camera, WebGLRenderer, OrbitControls                 │
│    - Lighting (ambient + directional)                            │
│    - PlaneGeometry, ShaderMaterial, membrane Mesh                │
│    - Resize listener                                             │
│    - Geometry rebuild (rebuildGeometry)                           │
└─────────────────────────────────────────────────────────────────┘
```

## Contract

The extracted module is a **plain ES module**. Two exported functions. Not a
class. Not a pod. Not a framework.

```javascript
// src/visual/renderer.js

/**
 * Initialize the Three.js scene, camera, renderer, controls, lighting,
 * geometry, material, and membrane mesh. Appends the canvas to `container`.
 *
 * Returns refs that the monolith needs for things we haven't extracted yet
 * (raycasting, actuator sphere management, stats, etc).
 *
 * @param {HTMLElement} container — the DOM element to append the canvas to
 * @returns {{ scene, camera, renderer, controls, membrane, material }}
 */
export function init(container) { ... }

/**
 * Update geometry vertex positions from a worklet height snapshot.
 * Handles bilinear upsampling when workletGridSize !== renderGridSize.
 * Handles the fallback path (main-thread physics heights as 2D array).
 *
 * @param {Float32Array|null} snapshot — flat array from worklet, or null for fallback
 * @param {number} workletGridSize — grid dimension the worklet operates at
 * @param {number} renderGridSize — grid dimension of the Three.js PlaneGeometry
 * @param {number[][]} [fallbackHeights] — 2D array from main-thread physics (fallback only)
 */
export function updateMesh(snapshot, workletGridSize, renderGridSize, fallbackHeights) { ... }
```

### Why `init` returns refs

The monolith still needs `scene` to call `scene.add(indicator)` for
actuator/collector spheres. It needs `camera` for raycasting. It needs
`membrane` for `raycaster.intersectObject(membrane)`. It needs `material`
for `material.wireframe` toggle and `material.uniforms.waveHeight.value`
reads (actuator visual height, line 1994). It needs `controls` for
`controls.update()` in the animate loop.

These refs are **read-only contracts** — the monolith uses them but doesn't
reconfigure them. When we extract actuator management (Slice 2) and the
animate loop (later), these refs get internalized.

### ParamBus Integration

The renderer reads visual parameters from `window.paramBus`:

- **`visual_wave_height`** — maps to `material.uniforms.waveHeight.value`
  (currently hardcoded to `20.0` at line 401). ParamBus gives the UI a
  future knob for this.
- **`visual_wireframe`** — maps to `material.wireframe` (currently toggled
  by `toggleWireframe()` at line 784). The renderer exposes this as a
  ParamBus-driven value so the monolith's toggle just does
  `paramBus.set('visual_wireframe', !paramBus.get('visual_wireframe'))`.

For the initial extraction, the renderer initializes these ParamBus keys
with the current hardcoded defaults if they don't already exist. This is
additive — no existing ParamBus consumers break.

---

## Step-by-Step Tasks for Claude Code

### IMPORTANT: Test after every step. Load in browser, confirm no regressions.

### Step 1: Create `src/visual/renderer.js` with `init(container)`

Extract into the new module:

**From lines 319–321** (scene setup):
```javascript
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e27);
```

**From lines 323–331** (camera):
```javascript
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 5000);
camera.position.set(0, 120, 60);
camera.lookAt(0, 0, 0);
```

**From lines 333–338** (WebGL renderer):
```javascript
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.createElement('canvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
```

**From lines 340–343** (orbit controls):
```javascript
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);
```

**From lines 385–391** (lighting):
```javascript
const ambientLight = new THREE.AmbientLight(0x1a237e, 0.4);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0x00e5ff, 0.6);
directionalLight.position.set(100, 100, 50);
scene.add(directionalLight);
```

**From lines 393–453** (geometry, shader material, membrane mesh):
- `PlaneGeometry` creation (line 395)
- Full `ShaderMaterial` with vertex/fragment shaders (lines 398–449)
- `membrane` mesh creation and rotation (lines 451–453)

**From lines 2960–2963** (resize handler) — register inside `init()`:
```javascript
function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleResize);
```

The function stores `membrane`, `material`, `geometry` in module-level variables
(for `updateMesh` to access) and returns `{ scene, camera, renderer, controls,
membrane, material }`.

**Acceptance:**
- `src/visual/renderer.js` exists and exports `init`
- Module parses without errors (check browser console)
- No visual changes yet — monolith hasn't switched to it

### Step 2: Create `updateMesh()` in the same module

Extract the mesh-update logic currently at **lines 1716–1778** of `updatePhysics()`.

The function receives `snapshot`, `workletGridSize`, `renderGridSize`, and
optionally `fallbackHeights`. Internally it:

1. Gets `positions` from the module-level `membrane.geometry.attributes.position.array`
2. Gets `waveH` from the module-level `material.uniforms.waveHeight.value`
3. **Same-resolution path** (lines 1728–1735): direct copy when `ws === rs`
4. **Bilinear upsample path** (lines 1736–1764): when worklet grid differs from render grid
5. **Fallback path** (lines 1765–1775): reads from 2D `fallbackHeights` array
6. Marks `needsUpdate = true` and calls `computeVertexNormals()` (lines 1777–1778)

```javascript
export function updateMesh(snapshot, workletGridSize, renderGridSize, fallbackHeights) {
    const positions = _membrane.geometry.attributes.position.array;
    const waveH = _material.uniforms.waveHeight.value;

    if (snapshot) {
        const ws = workletGridSize;
        const wStride = ws + 1;
        const rs = renderGridSize;
        const rStride = rs + 1;

        if (ws === rs) {
            // Direct copy — lines 1728-1735
            ...
        } else {
            // Bilinear upsample — lines 1736-1764
            ...
        }
    } else if (fallbackHeights) {
        // Fallback: main-thread physics — lines 1765-1775
        for (let i = 0; i <= renderGridSize; i++) {
            for (let j = 0; j <= renderGridSize; j++) {
                const index = (i * (renderGridSize + 1) + j) * 3 + 2;
                positions[index] = fallbackHeights[i][j] * waveH;
            }
        }
    }

    _membrane.geometry.attributes.position.needsUpdate = true;
    _membrane.geometry.computeVertexNormals();
}
```

**Acceptance:**
- `updateMesh` is exported alongside `init`
- Both code paths (snapshot, fallback) are present
- Bilinear interpolation logic is byte-identical to monolith lines 1736–1764

### Step 3: Add `rebuildGeometry(newGridSize)` export

Extract the Three.js half of `rebuildMesh()` (lines 994–996):

```javascript
export function rebuildGeometry(newGridSize) {
    _membrane.geometry.dispose();
    _membrane.geometry = new THREE.PlaneGeometry(
        _membraneSize, _membraneSize, newGridSize, newGridSize
    );
}
```

The `membraneSize` constant (200, line 394) lives in the renderer module.
The monolith's `rebuildMesh()` calls this instead of touching geometry directly.

**Acceptance:**
- `rebuildGeometry` is exported
- `membraneSize` (200) is a module constant, not hardcoded in the call

### Step 4: Add module `<script>` tag to import renderer

Same pattern as ParamBus (line 295–298). Add AFTER the ParamBus import,
BEFORE the main `<script>` tag:

```html
<script type="module">
    import { init as initRenderer, updateMesh, rebuildGeometry } from './src/visual/renderer.js';
    window._renderer = { initRenderer, updateMesh, rebuildGeometry };
</script>
```

The underscore prefix signals "internal bridge, remove when monolith becomes
a module." The monolith accesses these via `window._renderer.initRenderer(...)`.

**Acceptance:**
- No console errors on load
- `window._renderer` exists in console
- `window._renderer.initRenderer` is a function

### Step 5: Wire `init()` — replace inline scene setup in monolith

Replace **lines 319–453** (scene, camera, renderer, controls, lighting,
geometry, material, membrane) with a call to the imported `init`:

```javascript
// Scene setup — delegated to renderer module
const { scene, camera, renderer, controls, membrane, material } =
    window._renderer.initRenderer(document.getElementById('canvas-container'));
```

The variables `scene`, `camera`, `renderer`, `controls`, `membrane`, and
`material` remain available as locals in the same scope. Every downstream
reference (raycasting at line 1789, `scene.add` at line 1050, `controls.update`
at line 2006, `renderer.render` at line 2007, `material.wireframe` at line 785,
`material.uniforms` at lines 1717/1994/2004/2664) continues to work unchanged.

Also remove the now-redundant resize handler at **lines 2959–2966** — the
renderer module registers its own.

Keep `gridSize` (line 393) and `membraneSize` (line 394) as module-level
constants inside `renderer.js`. The monolith's `gridSize` variable (line 393)
stays as-is because it's also used by physics, actuators, and collectors — it's
not purely visual.

**Acceptance:**
- Page loads, membrane renders identically (same colors, same camera angle)
- OrbitControls work (drag to rotate, scroll to zoom)
- Resize works (drag browser window edge)
- `material.wireframe` toggle works (keyboard shortcut or button)
- No duplicate canvases or renderers
- Console shows no errors

### Step 6: Wire `updateMesh()` — replace inline render path in monolith

In `updatePhysics()`, replace **lines 1716–1778** with:

```javascript
if (membraneWorklet && workletSnapshot) {
    window._renderer.updateMesh(workletSnapshot, workletGridSize, gridSize);
} else {
    physics.updatePhysics();
    window._renderer.updateMesh(null, 0, gridSize, physics.heights);
}
membrane.geometry.attributes.position.needsUpdate = true;
membrane.geometry.computeVertexNormals();
```

Wait — `needsUpdate` and `computeVertexNormals` are already inside
`updateMesh()`. So the monolith call is just:

```javascript
if (membraneWorklet && workletSnapshot) {
    window._renderer.updateMesh(workletSnapshot, workletGridSize, gridSize);
} else {
    physics.updatePhysics();
    window._renderer.updateMesh(null, 0, gridSize, physics.heights);
}
```

The `waveH` read (`material.uniforms.waveHeight.value`, line 1717) moves inside
the module — the monolith no longer touches it.

**Acceptance:**
- Membrane animates from worklet physics (waves propagate from actuators)
- Bilinear upsampling works (worklet grid 32, render grid 100 — smooth surface)
- Fallback path works (disable worklet, membrane still renders from main-thread physics)
- No visual difference from before extraction

### Step 7: Wire `rebuildGeometry()` — update `rebuildMesh()`

In `rebuildMesh()` (line 989), replace **lines 994–996**:

```javascript
// BEFORE:
membrane.geometry.dispose();
membrane.geometry = new THREE.PlaneGeometry(membraneSize, membraneSize, gridSize, gridSize);

// AFTER:
window._renderer.rebuildGeometry(gridSize);
```

Note: `membrane` ref (from `init()` return) may be stale after geometry rebuild
since it's the same object — `Mesh.geometry` is reassigned, not the mesh itself.
This is fine; the ref still points to the same mesh.

**Acceptance:**
- Grid resolution slider (if present) still works
- `rebuildMesh(50)` in console produces a coarser mesh; `rebuildMesh(100)` restores it
- No geometry leaks (old geometry is `.dispose()`d inside the module)

### Step 8: Clean up — remove dead code from monolith

After Steps 5–7, the following monolith code is dead:

- Scene setup block (replaced in Step 5): was lines 319–453
- `handleResize()` function and `window.addEventListener('resize', ...)`: was lines 2959–2966
- Inline mesh update in `updatePhysics()`: was lines 1716–1778

Verify none of these lines remain. The monolith's `animate()` function
(line 1963) should now look like:

```javascript
function animate() {
    const now = performance.now();
    logFrame(now - lastFrameTime);
    lastFrameTime = now;
    stats.begin();
    requestAnimationFrame(animate);

    updateAudioData();
    updateAudioVisualizers();

    // Actuator visual updates (still in monolith)
    if (!membraneWorklet) {
        actuators.forEach(actuator => actuator.apply());
    } else {
        actuators.forEach(actuator => { ... });  // visual height sync
    }

    updatePhysics();  // param forwarding + delegated mesh update

    material.uniforms.time.value = Date.now() * 0.001;

    controls.update();
    renderer.render(scene, camera);
    stats.end();
}
```

Note: `material.uniforms.time.value` (line 2004), `controls.update()` (line
2006), and `renderer.render(scene, camera)` (line 2007) remain in the monolith.
They use the refs returned by `init()`. This is intentional — the animate loop
itself is not being extracted in this slice.

**Acceptance:**
- No duplicate or orphaned code
- `grep -n "PlaneGeometry\|ShaderMaterial\|AmbientLight\|DirectionalLight"` in
  the monolith returns zero hits (all moved to module)
- `handleResize` only exists in `src/visual/renderer.js`

### Step 9: Commit checkpoint

```bash
git add src/visual/renderer.js brane-with-collectors-websocket.html
git commit -m "refactor: extract Three.js renderer into src/visual/renderer.js

Moves scene setup, camera, lighting, shader material, geometry, membrane
mesh, resize handling, and mesh-update logic (including bilinear upsampling)
into a standalone ES module. The monolith imports it via a <script type=module>
bridge and calls init(container) + updateMesh(snapshot, ...) each frame.

No visual or behavioral changes. All existing references (raycasting, actuator
spheres, wireframe toggle, orbit controls) use refs returned by init().

Architecture contract: Slice 1 of INTEGRATION-PLAN.md"
```

---

## What NOT to Do

1. **Do NOT make `renderer.js` a class.** Two functions. Module-level state.
   The `init` / `updateMesh` contract is the entire API. No constructors, no
   `this`, no inheritance, no lifecycle methods.

2. **Do NOT move the `animate()` loop into the renderer.** The animate loop
   orchestrates audio, physics forwarding, actuator updates, tile visualizers,
   and rendering. It's the monolith's heartbeat. Extracting it requires
   extracting everything it calls — that's the final step, not this one.

3. **Do NOT move actuator/collector sphere creation into the renderer.** Those
   spheres depend on `Actuator`/`Collector` class instances, channel assignment
   logic, and `syncActuatorsToWorklet()`. That's Slice 2 (actor-manager). The
   renderer exposes `scene` via the returned refs so the monolith can still
   `scene.add()` and `scene.remove()`.

4. **Do NOT import Three.js as an ES module.** The monolith loads Three.js via
   `<script src="three.min.js">` (line 283) which puts `THREE` on the global.
   The renderer module uses `THREE.Scene`, `THREE.PerspectiveCamera`, etc. from
   the global. Converting to ES module imports (`import * as THREE from 'three'`)
   requires a bundler or import map — separate task.

5. **Do NOT add new ParamBus parameters in this slice** (beyond
   `visual_wave_height` and `visual_wireframe` noted in the contract). The
   renderer reads `waveHeight` from its own `material.uniforms` and wireframe
   from `material.wireframe`. These are already working. Adding ParamBus keys
   is additive and optional — do it only if the wiring is trivial. If it's not,
   skip it and note it for the next pass.

6. **Do NOT change the shader code.** The vertex and fragment shaders (lines
   404–443) move byte-for-byte. No "improvements," no refactoring, no adding
   uniforms. The shader works and Harold chose those colors.

7. **Do NOT touch `membrane-worklet-processor.js` or `membrane-worklet-node.js`.**
   The worklet is correct. This slice is purely visual-layer extraction.

8. **Do NOT remove the main-thread physics fallback.** The `else` branch at
   line 1765 (reading `physics.heights`) must survive in `updateMesh()` as
   the `fallbackHeights` path. Some environments can't run AudioWorklet.

---

## After This Is Done

The next slices (in order, unchanged from INTEGRATION-PLAN.md):

1. **Extract actuator/collector management** into `src/core/actor-manager.js`
   - `addActuator`, `addCollector`, `clearActuators`, `clearCollectors`
   - Sphere creation (lines 1039–1051, 1063–1076) moves here
   - Raycaster click handling (lines 1782–1843) moves here
   - Uses `scene` ref from renderer's `init()` return

2. **Extract audio source switching** into `src/audio/source-manager.js`
   - Tab capture, mic, file input, demo loops
   - Each source returns `{ connect(), disconnect() }`
   - Reduces monolith by ~400 lines

3. **Convert legacy slider tiles to module-based components**
   - Each tile type becomes `src/ui/tiles/<name>.js`
   - Exports `create(container, paramBus)` — no manifest overhead

4. **Redesign pod system around actual signal flow**
   - Pods declare ports that map to real worklet messages
   - Pod state serializes through ParamBus

---

## Verification Checklist (for Harold)

After Claude Code completes Steps 1–9:

- [ ] Load page — membrane renders with same midnight-blue background and cyan color ramp
- [ ] Camera starts at elevated centered view (0, 120, 60)
- [ ] Orbit controls work — drag to rotate, scroll to zoom
- [ ] Click membrane — actuator sphere appears (solid colored sphere)
- [ ] Shift+click — collector sphere appears (green wireframe sphere)
- [ ] Play audio with actuators placed — waves propagate, membrane deforms
- [ ] Bilinear upsampling visible: smooth surface despite worklet grid being 32x32
- [ ] Wireframe toggle works (button or 'W' key if mapped)
- [ ] Resize browser window — canvas and camera aspect update correctly
- [ ] Freeze button stops waves; unfreeze restores them
- [ ] Damping, gain, smoothing sliders all still work
- [ ] `rebuildMesh(50)` in console → coarser geometry; `rebuildMesh(100)` → back to normal
- [ ] No console errors related to renderer, THREE, or undefined
- [ ] `src/visual/renderer.js` is the only file containing `PlaneGeometry`, `ShaderMaterial`, `AmbientLight`, `DirectionalLight`
- [ ] Monolith is ~200 lines shorter (verify with `wc -l`)
