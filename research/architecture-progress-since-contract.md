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

## 5. What Is Still Not Done

The architecture contract is still not fully implemented, but the system is no
longer in early Phase 1. Runtime seams and a working pod runtime now exist.

Not yet done:

- No fixed-step simulation loop yet
- No Worker-owned membrane state yet
- No AudioWorklet-owned audio path yet
- No latency measurement harness yet
- No full hot-path allocation audit yet

Still structurally messy:

- Collectors still read membrane state directly.
- Actuator and collector grid coordinates are still cached derived state.
- Tile layout is still not inside the session boundary.
- Audio source, microphone, file player, and visualizer tiles are still on the
  legacy side of the shell.

---

## 6. Current Migration Status

### Completed

- Contract written
- Pod architecture specification expanded
- State ownership inventory written
- GitHub issue planning documents written
- Runtime parameter store introduced
- Force gateway introduced
- Audio source registry introduced
- Legacy source-state booleans removed
- Pod runtime implemented
- Parameter slider pods implemented and mounted
- Dynamic grid slider deleted
- Session-backed persistence added for the active pod set
- Keyboard restored as a pure audio source
- Manually placed actuators remain the only membrane-coupling points

### In Progress

- Replacing remaining monolith-owned control paths with runtime-owned seams
- Reducing remaining derived-state and persistence-boundary violations
- Tightening the source/actuator contract around the final signal chain

### Not Started in Code

- Session-backed pod persistence
- Time decoupling
- Thread isolation
- AudioWorklet migration
- Latency instrumentation

---

## 7. Recommended Next Steps

The next work should continue to narrow ambiguity before introducing Workers or
audio-rate architecture.

### Immediate Next Step

Verify the restored keyboard-to-manual-actuator behavior in a real browser
session.

Specifically:

1. Confirm keyboard input does nothing unless at least one actuator is manually
  placed.
2. Confirm manually placed actuators respond to keyboard audio.
3. Confirm deleting a manual actuator stops its response and does not cause the
  runtime to recreate a hidden replacement.
4. Confirm pod position and slider values still round-trip through
  `serializeSessionState()`.

Why this is next:

- The structural correction is in place.
- The remaining risk is behavioral integration between keyboard source output,
  manual actuators, and persistence.

### After That

Extend persistence and source contracts beyond the current pod set.

Recommended order:

1. Persist the remaining relevant UI layout state
2. Clarify source contract handling for keyboard versus file/mic/tab sources
3. Keep collapsing legacy shell behavior into explicit runtime-owned seams

Why this is next:

- The current pod boundary is now real.
- The next gap is consistency across the remaining non-pod subsystems.

### Later Phases

Only after the above is real:

1. Move simulation to a fixed-step loop
2. Add render interpolation
3. Move membrane state into a Worker
4. Move audio-rate work into an AudioWorklet
5. Measure latency and audit hot-path allocations

---

## 8. Safe Return Point

If work pauses here, the clean restart point is:

- the contract exists
- the migration docs exist
- the live app has real runtime seams for:
  - parameter ownership
  - force entry
  - audio source ownership
- the main-thread pod runtime exists
- the first horizontal pod sweep is complete
- the persistence boundary is active for the current pod set
- the keyboard is back in the source layer rather than acting as direct force

That means the project can safely resume from this exact spot without needing
to rediscover the architecture from scratch.

---

## 9. Working Tree Note

At the time of writing, this migration work is present in the working tree and
not yet committed as a single architecture milestone.

Relevant modified or new files currently include:

- `brane-with-collectors-websocket.html`
- `tiles-config.json`
- `src/pod-runtime.js`
- `src/pods/parameter-slider-pod-base.js`
- `src/pods/wave-speed-slider.pod.js`
- `src/pods/damping-slider.pod.js`
- `src/pods/actuator-gain-slider.pod.js`
- `src/pods/keyboard-instrument.pod.js`
- `research/pod-architecture-spec.md`
- `research/state-ownership-inventory.md`
- `research/pod-migration-issues.md`
- `research/pod-migration-github-issues.md`
- `README.md`
- `SYSTEM-STATE.md`

This document is a status summary, not a commit boundary.
