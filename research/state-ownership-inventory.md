# State Ownership Inventory

This document is the starting artifact for Phase 1 of the pod migration. It
describes the major state buckets in the live application, the current owner
or owners, the ownership problems, and the first low-risk moves that bring the
runtime closer to the architecture contract.

## Purpose

The pod architecture depends on one hard rule: every meaningful piece of state
has exactly one owner. The current live application is functional, but several
state domains overlap across UI code, audio routing, and physics mutation.
This inventory makes that overlap explicit before refactor work begins.

## Current State Buckets

| Bucket | Current owner(s) | Ownership quality | Notes |
|---|---|---|---|
| Physics parameters | `physics` plus `window.waveSpeed`, `window.damping`, `window.actuatorGain` | Overlapping | Parameters are mirrored between the physics object and globals. |
| Physics grid state | `physics.heights`, `physics.velocities`, plus cached actuator and collector grid indices | Overlapping | Grid state is owned by `physics`, but actors cache coordinates derived from `gridSize`. |
| Runtime audio routing | `audioContext`, `leftAnalyser`, `rightAnalyser`, source-specific setup code | Overlapping | Multiple sources can assign shared analyser state. |
| Runtime audio sample buffers | `leftAudioData`, `rightAudioData` | Single buffer, shared readers | Buffers are global and consumed directly by actuators and visualizers. |
| Actuator state | `actuators[]` plus each `Actuator` instance | Mostly single owner | State is centralized in the array, but each actuator still mutates physics directly. |
| Collector state | `collectors[]` plus each `Collector` instance | Mostly single owner | Collectors read physics directly and own local sampling config. |
| Session and schema state | `default-session.json`, `SchemaParser`, initial bootstrap code | Weak single owner | Session data is loaded once but is not the live source of truth during runtime. |
| Tile layout state | `tilePositions` plus DOM/D3 position styles | Overlapping | Layout is tracked in JS and DOM but is not session-backed. |
| Render state | Three.js scene, material uniforms, membrane geometry | Single owner on main thread | This is one of the cleaner boundaries already. |
| UI mode and transport flags | `audioEnabled`, `demoMode`, `audioFileMode`, `tabAudioActive`, `micActive`, `audioOutputEnabled` | Overlapping booleans | Behavior depends on combinations of flags instead of a small authoritative state model. |

## Concrete Ownership Violations

### 1. Physics parameters have dual authority

The live app initializes globals from the physics object, then later writes
those values back into physics during the frame loop. That means the globals
are acting like shadow owners rather than simple UI bindings.

Relevant anchors:

- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L454)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L455)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L456)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1355)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1356)

Implication:

- There is no clear source of truth for membrane parameters.
- A pod runtime cannot safely observe or set these values until ownership is
  centralized.

### 2. Actuators read shared audio buffers and mutate physics directly

The `Actuator` class selects from global audio buffers, computes force, reads
membrane height directly, and writes into `physics.velocities` directly.

Relevant anchors:

- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L474)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L476)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L547)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L588)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L602)

Implication:

- The future force gateway does not exist yet.
- Audio ownership, actuator intent, and physics mutation are collapsed into one
  class.

### 3. Multiple source initializers compete for analyser ownership

Several code paths create or assign `leftAnalyser`, `rightAnalyser`, and the
shared float buffers. This creates overlapping ownership in the live audio
path.

Relevant anchors:

- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L809)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L958)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1035)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1090)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1225)

Implication:

- The current app has shared analyser state but no authoritative audio routing
  owner.
- Any pod or source contract built on top of this would inherit ambiguity.

### 4. Grid-derived actor coordinates become stale on resize

Actuators and collectors cache `gridX` and `gridY` from `gridSize`. When the
mesh is rebuilt, the code clears all actors rather than recalculating their
derived coordinates.

Relevant anchors:

- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L511)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L631)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L697)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L708)

Implication:

- Grid ownership is split between the physics core and cached actor state.
- Clearing actors is a workaround, not a durable ownership model.

### 5. Tile layout exists outside the session boundary

Tile position is tracked in `tilePositions` and also expressed in DOM styles,
but it is not persisted through the session schema.

Relevant anchors:

- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1556)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1599)
- [brane-with-collectors-websocket.html](/Users/harold/Projects/rmix-brane-audio-environment/brane-with-collectors-websocket.html#L1647)

Implication:

- The persistence boundary in the architecture contract is not yet true.
- Layout state will need a session-backed owner before tiles can become pods.

## Recommended Target Owners

| State domain | Recommended owner |
|---|---|
| Membrane wave parameters | Runtime parameter store, later session-backed |
| Physics grid and membrane arrays | Physics runtime only |
| External force events | Runtime-owned force gateway |
| Audio routing and analyser lifecycle | Runtime audio router |
| Source metadata and source contract | Session schema plus runtime source registry |
| Pod configuration and layout | Session `pods[]` entries |
| Ephemeral drag state and hover state | Main-thread UI layer only |

## First Low-Risk Fixes

### 1. Centralize parameter ownership

Create a runtime parameter store that owns wave speed, damping, and actuator
gain. Existing controls can still bind to it while the live app remains in one
file.

Why first:

- It removes the current dual-authority pattern.
- It prepares the path for `PodContext.getParameter()` and
  `PodContext.setParameter()`.

### 2. Introduce a force gateway without changing the PDE

Actuators should stop writing directly into `physics.velocities`. Instead,
their computed intent should be submitted to a runtime function that validates
and applies force.

Why first:

- It makes Simulation Purity operational.
- It creates the exact seam later needed for pod output ports and worker
  migration.

### 3. Create a runtime audio router or source registry

The app needs one owner for analyser nodes, shared sample buffers, and active
source selection.

Why first:

- It removes overlapping source ownership.
- It creates a place for explicit source contracts to live before pods arrive.

### 4. Recompute actor grid coordinates on resize

Make grid coordinates derived state that can be refreshed when `gridSize`
changes, instead of clearing actors and collectors as a workaround.

Why first:

- It is low risk.
- It turns a hidden coupling bug into an explicit derived-state rule.

## Suggested First Vertical Slice

The smallest slice that advances the architecture without pulling in audio or
thread complexity is:

1. Introduce a runtime parameter store.
2. Route membrane wave speed through that owner.
3. Convert the existing wave-speed slider path to use the store.
4. Define the future `wave-speed-slider` pod against that same interface.

That slice proves state ownership before the project touches Workers,
AudioWorklets, or the keyboard path.
