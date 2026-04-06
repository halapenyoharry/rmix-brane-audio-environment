# Architecture Progress Since Contract

**Project:** rmix-BAE
**Date:** 2026-03-17
**Scope:** What has been done since the architecture contract, what is true in
the code now, and the current forward plan.

---

## 1. Why This Document Exists

The architecture contract defines the target rules. This document records the
work completed since that contract was written, the seams already introduced
into the live application, the pod runtime work now present in code, and the
next steps for continuing the migration without losing the thread.

This is the bridge between:

- `research/architecture-contract.md` - the rules
- `research/pod-architecture-spec.md` - the system design
- `brane-with-collectors-websocket.html` - the current live implementation
- `src/pod-runtime.js` and `src/pods/` - the runtime and migrated pods

---

## 2. Architectural Baseline

The current migration is driven by these contract-level constraints:

1. Simulation Purity
2. Single State Ownership
3. Strict Modular Boundaries
4. Explicit Source Contracts
5. Decoupled Simulation Time
6. The Clock/Authority Rule
7. Thread Isolation by Responsibility
8. Zero-Copy High-Frequency Transfer
9. Hot-Path Allocation Ban
10. Persistence Boundary
11. Latency Budget

The implementation work so far has focused on Rules 1 through 4, plus an early
partial cut against Rule 9.

Why Rule 9 is now in scope:

- The old `gridResolution` slider forced runtime mesh and physics
  reallocation.
- That path has now been deleted.
- Grid resolution is now treated as a static boot-time setting rather than a
  live control.

---

## 3. Documentation Produced Since the Contract

The following documents were added or expanded to turn the contract into an
executable plan.

### 3.1 Pod Architecture Specification Expanded

`research/pod-architecture-spec.md` includes a phased migration path.

What it added:

- Phase 0: Freeze the contract
- Phase 1: Establish runtime seams in the existing app
- Phase 2: Introduce the pod runtime on the main thread
- Phase 3: Migrate representative pod types
- Phase 4: Decouple time and move physics off the main thread
- Phase 5: Move audio-rate responsibilities to an AudioWorklet

Why it matters:

- It prevents a rewrite impulse.
- It makes the migration explicitly staged.
- It defines safe slices instead of open-ended refactors.

### 3.2 State Ownership Inventory

`research/state-ownership-inventory.md` documented the live app's state domains
and ownership violations.

What it established:

- Physics parameters had dual authority.
- Audio routing had overlapping ownership.
- Actuators were mutating membrane state directly.
- Tile layout lived outside the persistence boundary.
- Grid-derived actuator and collector coordinates were cached and fragile.

Why it matters:

- It turned the migration from intuition into verified facts.
- It identified the safest first seams to cut.

### 3.3 GitHub Execution Artifacts

Two issue-planning documents now exist:

- `research/pod-migration-issues.md`
- `research/pod-migration-github-issues.md`

What they do:

- Translate the contract and pod spec into epics, issues, acceptance criteria,
  dependencies, and execution order.
- Separate architectural truth from implementation task tracking.

Why they matter:

- The migration can now be driven as bounded work instead of open-ended AI
  refactoring.

---

## 4. Code Changes Completed Since the Contract

The live app has already been changed in meaningful ways. The migration is no
longer only theoretical.

### 4.1 Runtime Parameter Store Introduced

Locations:

- `brane-with-collectors-websocket.html`
- `default-session.json`

What changed:

- `waveSpeed`, `damping`, and `actuatorGain` now live in a
  `runtimeParameterStore`.
- `getControlValue()` and `setControlValue()` route legacy slider and
  inspector interactions through that store.
- Physics reads membrane parameters from the runtime-owned store.
- Parameter IDs are now mapped to runtime values through:
  - `membrane_wave_speed`
  - `membrane_damping`
  - `membrane_actuator_gain`

Why it matters:

- This is the first concrete implementation of Single State Ownership.
- It removed direct dependence on `window.waveSpeed`, `window.damping`, and
  `window.actuatorGain` for the migrated controls.
- It created the seam used by `PodContext.getParameter()` and
  `PodContext.setParameter()`.

Current limitation:

- The parameter store is still runtime-local and not yet session-backed.

### 4.2 Force Gateway Introduced

Location:

- `brane-with-collectors-websocket.html`

What changed:

- A runtime-owned `forceGateway.applyGaussianForce(intent)` exists.
- The actuator path no longer writes directly into membrane state from inside
  the actuator class.
- The gateway validates force intent properties, rejects invalid or negligible
  input, clamps extreme values, and applies Gaussian spread.

Why it matters:

- This is the first concrete implementation of Simulation Purity as an
  architectural boundary.
- Controls now describe force intent; the runtime owns force entry.
- It preserves the PDE while moving responsibility to the correct layer.

Current limitation:

- The gateway still writes into `physics.velocities` internally because the
  physics runtime remains on the main thread.
- The gateway is a seam, not yet a fully decoupled membrane service.

### 4.3 Audio Source Registry Introduced and Consolidated

Location:

- `brane-with-collectors-websocket.html`

What changed:

- A runtime-owned `audioSourceRegistry` manages shared analyser creation and
  active-source tracking.
- File input, mic, tab capture, and demo loops route analyser connection or
  adoption through the registry.
- Shared `leftAnalyser`, `rightAnalyser`, `leftAudioData`, and
  `rightAudioData` are now created or adopted by one runtime-owned place.
- Legacy boolean state for source activity was removed:
  - `audioEnabled`
  - `audioFileMode`
  - `tabAudioActive`
  - `micActive`

Why it matters:

- This is the concrete ownership cut for Explicit Source Contracts.
- Active source state now derives from one runtime-owned registry instead of
  overlapping booleans.
- The registry is now the actual control point for transport/source activity.

Current limitation:

- The registry still does not define full source metadata and contract objects.
- Audio sources themselves have not yet been migrated into standalone pods.

### 4.4 Pod Runtime Implemented on the Main Thread

Locations:

- `src/pod-runtime.js`
- `brane-with-collectors-websocket.html`

What changed:

- `Pod`, `PodContext`, and `PodRegistry` now exist in code.
- The monolith dynamically loads pod modules from `src/pods/`.
- Tile mounting now supports pod-backed controls alongside remaining legacy
  tiles.
- The animation loop updates pod instances and renders pod UI each frame.

Why it matters:

- Phase 2 is no longer theoretical.
- A real runtime boundary now exists between the shell and migrated controls.
- New control migrations can now target `PodContext` instead of reaching into
  monolithic globals.

Current limitation:

- Pods are still main-thread UI/runtime components.
- The session schema now persists pod entries, but the persistence boundary is
  still limited to the currently active pod set rather than the full UI.

### 4.5 Parameter Pod Sweep Completed

Locations:

- `src/pods/parameter-slider-pod-base.js`
- `src/pods/wave-speed-slider.pod.js`
- `src/pods/damping-slider.pod.js`
- `src/pods/actuator-gain-slider.pod.js`

What changed:

- `wave-speed`, `damping`, and `gain` are now standalone slider pods.
- Shared slider pod behavior lives in `parameter-slider-pod-base.js`.
- The monolith mounts those tiles through the pod registry instead of the
  legacy slider path.
- The old special-case waveform/rendering branches for those parameters were
  removed from the monolith.

Why it matters:

- This is the first successful horizontal pod sweep.
- The parameter seam is now exercised through real pod code.
- The monolith owns less direct UI logic for migrated controls.

Current limitation:

- `gridResolution` was intentionally not migrated as a pod.
- Pod persistence exists for the active pod set, but broader session coverage
  is still incomplete.

### 4.6 Grid Resolution Trap Removed

Locations:

- `tiles-config.json`
- `brane-with-collectors-websocket.html`

What changed:

- The legacy `grid-size` slider was deleted from the tile system.
- `gridResolution` is now boot-only through `BOOT_RUNTIME_CONFIG`.
- The runtime mesh rebuild path was deleted.
- There is no remaining mutable `window.gridResolution` path.

Why it matters:

- This is the first direct cut against the Hot-Path Allocation Ban.
- Grid resolution no longer triggers runtime reallocation of geometry or
  physics state.
- The simulation grid is now treated as initialization state instead of a live
  performance hazard.

Current limitation:

- Grid resolution is still a hardcoded boot setting rather than a schema-backed
  session value.

### 4.7 Persistence Boundary Activated For Current Pods

Locations:

- `default-session.json`
- `src/schema/SchemaParser.js`
- `src/pods/parameter-slider-pod-base.js`
- `src/pods/keyboard-instrument.pod.js`
- `src/pod-runtime.js`
- `brane-with-collectors-websocket.html`

What changed:

- The session schema now includes a top-level `pods[]` array.
- Pod entries now use the shape:
  - `{ id, type, position: { x, y }, state: {} }`
- Pod placement for the active pod set is now loaded from session state rather
  than from the legacy default tile layout.
- Pod-local state is now serialized back into runtime session data.
- Parameter slider pods now restore and serialize their live `value` state.
- The keyboard pod now restores and serializes its local state such as octave.

Why it matters:

- Constraint #10 is now partially real in the live code.
- Pod-backed controls no longer depend on hardcoded top-level placement.
- The app can now round-trip current pod position and local state through the
  session schema.

Current limitation:

- Persistence currently covers the active pod set, not the full application.
- The saved session boundary is runtime-backed and downloadable, but not yet a
  complete project-wide state system.

### 4.8 Keyboard Signal Chain Restored To Source -> Actuator -> Membrane

Locations:

- `src/pods/keyboard-instrument.pod.js`
- `brane-with-collectors-websocket.html`

What changed:

- The temporary keyboard `force-out` design was removed.
- The keyboard pod is back to being a pure audio source.
- The keyboard pod now emits `audio-out` as a `Float32Array` block.
- The runtime consumes that audio as a source signal rather than turning the
  keyboard into a direct membrane-force tool.
- Only manually added actuators are allowed to affect the brane.
- The runtime no longer creates a hidden keyboard-owned actuator on the
  membrane.

Why it matters:

- This restores the intended signal chain:
  - source -> actuator -> membrane -> collector
- It re-establishes Explicit Source Contracts by keeping the keyboard in the
  source layer.
- It respects the product rule that actuators are only manually placed on the
  membrane.

Current limitation:

- Keyboard audio is now routed into the shared source path, but the broader
  source/actuator contract is still evolving.
- Documentation outside this file may still describe older keyboard behavior.

---

## 5. Correction: Pod Runtime Was Never Integrated (2026-03-27)

**Sections 4.4, 4.5, and 4.7 above describe work that exists in source files
but was never wired into the live application.**

The pod runtime (`src/pod-runtime.js`), the slider pods (`src/pods/*.pod.js`),
and the session-backed persistence were designed for a pre-worklet architecture.
The monolith (`brane-with-collectors-websocket.html`) never imported or
instantiated the pod runtime. No pod `update()` or `render()` calls exist in
the animation loop. The monolith continued to use legacy tiles from
`tiles-config.json` with `window[variable] = value` as the entire parameter
model throughout.

These files remain in the repo as reference material for a future pod system
redesign. They are not integration targets.

The `runtimeParameterStore`, `getControlValue()`, and `setControlValue()`
described in section 4.1 were similarly never the live parameter path. The
monolith read `window.waveSpeed` etc. directly until the ParamBus integration
on 2026-03-27 (see section 6 below).

The force gateway described in section 4.2 was superseded by glue coupling
in the AudioWorklet (see section 6.1).

---

## 6. AudioWorklet Era (2026-03-21 → 2026-03-27)

The architecture took a significant turn when the physics engine moved from
main-thread JavaScript into an AudioWorklet running at sample rate (48kHz).
This leapfrogged Phases 4 and 5 of the original migration plan.

### 6.1 AudioWorklet Physics Engine (commit 8d5d32b, 2026-03-21)

Locations:

- `src/audio/membrane-worklet-processor.js` (worklet thread)
- `src/audio/membrane-worklet-node.js` (main thread wrapper)
- `brane-with-collectors-websocket.html` (integration)

What changed:

- The wave equation now runs at audio sample rate inside an AudioWorklet.
- The main-thread physics path (`membrane-physics-core.js`) is retained as a
  fallback but is no longer the primary engine.
- The worklet owns heights, velocities, and the Laplacian computation.
- Snapshots of membrane state are sent to the main thread at display refresh
  rate via `postMessage`.

### 6.2 Glue-Coupled Actuators (commit 5f5e2ca, 2026-03-27)

What changed:

- Replaced the Gaussian force-injection model with geometric glue coupling.
- Actuator sphere surfaces enforce membrane height at contact points
  (Dirichlet boundary conditions).
- Waves radiate naturally from footprint edges via the Laplacian.
- The force gateway from section 4.2 is no longer the coupling mechanism.

### 6.3 Display Smoothing and Adaptive Snapshot Rate (commit 5f5e2ca)

What changed:

- Per-sample exponential low-pass filter on display heights (rendering layer).
- Audio output remains raw/unsmoothed (physics layer).
- Snapshot rate adapts to actual monitor refresh rate via `requestAnimationFrame`
  timing.
- Smoothing factor scales inversely with wave speed (adaptive), overridable
  via manual slider.

### 6.4 ParamBus: Single Parameter Authority (commit e3122bb, 2026-03-27)

Locations:

- `src/core/param-bus.js` (new ES module)
- `brane-with-collectors-websocket.html` (integration)

What changed:

- `ParamBus` class introduced as the sole owner of membrane parameters:
  `membrane_wave_speed`, `membrane_damping`, `membrane_actuator_gain`,
  `display_smoothing`.
- Imported into the monolith via a `<script type="module">` wrapper that
  exposes `window.paramBus`.
- Legacy sliders write to both `window[variable]` (bridge) and
  `paramBus.set()` (authority).
- `updatePhysics()` reads from ParamBus with dirty-checking — worklet only
  receives messages when values actually change.
- Freeze button reads/writes through ParamBus.
- Worklet initialization reads from ParamBus.
- `syncFromWindowGlobals()` runs once at boot to capture legacy slider defaults.
- `syncToWindowGlobals()` runs each frame as a legacy bridge (to be removed
  when all consumers migrate).

This is the first concrete implementation of Rule 2 (Single State Ownership)
that is actually live in the running application.

---

## 7. What Is Still Not Done

### Completed (verified in live code)

- Architecture contract written
- Documentation suite (pod spec, state inventory, issue planning)
- AudioWorklet physics engine — running at sample rate
- Glue-coupled actuators — physically correct Dirichlet coupling
- Adaptive display smoothing — separate rendering concern
- ParamBus — single parameter authority, dirty-checked worklet forwarding
- Grid resolution locked to boot-time (Hot-Path Allocation Ban)

### Dormant (exists in source, not integrated)

- Pod runtime (`src/pod-runtime.js`) — designed for pre-worklet architecture
- Slider pods (`src/pods/*.pod.js`) — reference implementations, not mounted
- Session-backed pod persistence — schema exists, not connected
- Audio source registry — introduced but not exercised by current code paths
- Force gateway — superseded by worklet glue coupling

### Not Yet Done

- Three.js renderer extraction (next slice — ~300 lines out of monolith)
- Actuator/collector management extraction (~200 lines)
- Audio source switching extraction (~400 lines)
- Legacy slider tile conversion to ES modules
- Pod system redesign around actual signal flow (ParamBus + worklet)
- Latency measurement harness
- Full hot-path allocation audit

---

## 8. Recommended Next Steps

### Immediate: Extract Three.js Renderer

Pull scene setup, geometry, material, camera, mesh update, and orbit controls
into `src/visual/renderer.js`. The monolith calls `renderer.updateMesh(snapshot)`
each frame. This is the most self-contained chunk — no audio or parameter
dependencies. Reduces monolith by ~300 lines and establishes the pattern for
subsequent extractions.

### Then: Extract Actuator/Collector Management

`src/core/actor-manager.js` — addActuator, addCollector, clearActuators,
syncToWorklet. ~200 lines.

### Then: Extract Audio Source Switching

`src/audio/source-manager.js` — tab capture, mic, file input, demo loops.
Each source returns `{ connect(), disconnect() }`. ~400 lines.

### Then: Convert Legacy Slider Tiles to Modules

Each tile type becomes `src/ui/tiles/wave-speed-slider.js` etc.
Exports `create(container, paramBus)`. Legacy `tiles-config.json` switches
from inline `createSliderTile()` to dynamic import.

### Later: Redesign Pod System

Only after the wiring is clean. Pods declare ports that map to real worklet
messages. Pod state serializes through ParamBus. This is where the
architecture gets beautiful — but not before.

---

## 9. Safe Return Point

If work pauses here, the clean restart point is:

- The architecture contract exists
- AudioWorklet is the live physics engine (48kHz, glue-coupled)
- ParamBus is the live parameter authority (dirty-checked forwarding)
- The monolith still works — all changes are additive with legacy bridges
- The pod runtime is dormant reference code, not live — don't try to integrate it
- The next task is mechanical extraction (renderer → actors → audio → tiles)
- Each extraction slice has clear boundaries defined in `docs/INTEGRATION-PLAN.md`

The integration plan (`docs/INTEGRATION-PLAN.md`) contains the step-by-step
contract for each slice, including acceptance criteria and explicit "What NOT
to do" constraints.

---

## 10. Current State (2026-04-06)

Since 2026-03-27, three major extraction slices have been completed. The
monolith is now ~2100 lines (down from ~3000). All legacy bridges remain intact;
the app is fully functional.

### 10.1 Mechanical Extraction Pattern Established

Locations:

- `src/visual/renderer.js` (extracted 2026-04-02)
- `src/core/actor-manager.js` (extracted 2026-04-04)
- `src/audio/source-manager.js` (extracted 2026-04-06)

What changed:

- **Renderer**: Scene, camera, lighting, shader material, geometry. Exports
  `init(container)` returning scene/camera/renderer/controls/membrane/material.
  Mesh updates via `updateMesh(snapshot, workletGridSize, monolithGridSize)` with
  bilinear upsampling. Handles resize. Classic script + IIFE pattern.

- **Actor Manager**: Actuator/Collector classes, add/remove/sync operations.
  Raycaster click handling. Exports control methods (handleClick, updateDeps,
  applyActuators, sampleAllCollectors) and getters (getActuators, getCollectors).
  Auto-syncs to worklet on structural change. Uses getter pattern for async
  worklet reference. Classic script + IIFE.

- **Audio Source Manager**: Mic input, tab capture, file input, demo loops, demo
  oscillator. Owns AudioContext lifecycle (lazy-init), analyser creation,
  sample buffers. Exports control methods (toggleMic, captureTabAudio, selectFile,
  playLoop, toggleDemo) and state getters (getAudioContext, getAnalysers,
  getAudioData, getAudioState). **CRITICAL FIXES**: (1) Sets `window.audioContext`
  as legacy bridge so initWorklet/keyboard/collector continue working without
  modification. (2) Exposes `getAudioData()` returning { left, right } buffers;
  actor-manager reads from sourceManager internally instead of relying on
  monolith to pass buffers via updateDeps(). Classic script + IIFE.

Why it matters:

- Three extraction slices are now verified and working.
- The pattern (classic script + IIFE, module-scoped state, simple public API,
  getter pattern for async references) is proven and repeatable.
- Actor manager's internal `getAudioData()` consumption prevents the
  error-prone pattern of the monolith forgetting to pass buffers.
- AudioContext bridge allows existing code to continue referencing
  `window.audioContext` without requiring massive downstream refactors.

Current state of monolith:

- ~2100 lines (was ~3000, -30% reduction)
- Contains: tile layout (D3 binding), keyboard instrument (MIDI key capture,
  oscillator pools), collector audio output (ScriptProcessor fallback),
  visualizer drawing (spectrum canvas), animate loop, misc UI setup/cleanup.
- No longer owns: renderer, actor system, audio sources.
- All legacy bridges intact (window.paramBus, window.audioContext,
  window.waveSpeed etc. as mirrors).

### 10.2 Pod Runtime Remains Dormant (Not Integrated)

Locations:

- `src/pod-runtime.js`
- `src/pods/`

Current status:

- The pod runtime and slider pods exist in source but are not wired into
  brane.html.
- They remain as reference implementations for the future pod redesign.
- No pod `update()` or `render()` calls exist in the animation loop.
- No pod persistence path is live.

Why this is OK:

- Slices 0–2 (Renderer, Actors, Audio) are mechanical extractions with clear
  boundaries — they required no pod rethinking.
- Slices 3–5 (Tiles, Pod Redesign, Pod Integration) require architectural
  decisions about how pods declare their io (ParamBus params, worklet ports) and
  state serialization.
- Extracting tiles and pods before deciding how they fit in the
  ParamBus + worklet model would create technical debt.

### 10.3 File Rename: brane-with-collectors-websocket.html → brane.html

What changed:

- Main HTML file renamed via `git mv` (git tracks it as a proper rename).
- All references updated in docs, README, and config files.
- `index.html` redirect updated.

Why it matters:

- The filename now reflects the maturity of the system (no longer describing a
  temporary architecture experiment).
- Cleaner URLs and cleaner mental model.

---

## 11. Commit History (Architecture Milestones)

- `8d5d32b` — AudioWorklet physics engine: membrane simulation at sample rate
- `5f5e2ca` — Glue-coupled actuators, adaptive display smoothing, physics controls
- `e3122bb` — ParamBus as single parameter authority (dirty-checked worklet forwarding)
