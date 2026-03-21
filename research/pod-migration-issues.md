# Pod Migration Issue Breakdown

This document translates the architecture contract and pod specification into
bounded execution slices suitable for GitHub Issues or a project board. It is
not a replacement for the research docs. It exists to make the migration
executable.

## Epic 1: Runtime Seams and State Ownership

### Issue 1.1: Produce a state ownership inventory

Purpose:
Document every major state bucket in the current app and assign exactly one
owner.

Scope:

- Runtime audio state
- Physics state
- Session/schema state
- Ephemeral UI state
- Derived render state

Acceptance criteria:

- Every state bucket in `brane-with-collectors-websocket.html` is listed.
- Each bucket has one owner and known readers.
- Ownership violations are called out explicitly.

### Issue 1.2: Introduce a runtime-owned force gateway

Purpose:
Create the only legal entry point for external forces entering the membrane.

Acceptance criteria:

- No control writes directly to `physics.applyForce()` or equivalent.
- Force validation can clamp, reject, or threshold suspicious input.
- The gateway preserves current behavior for valid force events.

### Issue 1.3: Route membrane parameters through a single owner

Purpose:
Replace ad hoc globals with runtime or session-owned parameter access.

Acceptance criteria:

- A first set of membrane parameters is readable from one authoritative store.
- Existing controls no longer mutate those parameters through globals.

## Epic 2: Pod Runtime on the Main Thread

### Issue 2.1: Define Pod base contract

Purpose:
Implement the runtime-facing pod lifecycle and manifest interface.

Acceptance criteria:

- `Pod` lifecycle matches the spec.
- Runtime can instantiate a pod with `ctx` and saved state.

### Issue 2.2: Define PodContext sandbox

Purpose:
Expose only the legal cross-boundary API to pods.

Acceptance criteria:

- PodContext can read/write ports and read/write parameters.
- PodContext does not expose raw physics mutation or global state.

### Issue 2.3: Implement PodRegistry and module loading

Purpose:
Load pod classes from `src/pods/` via ES modules.

Acceptance criteria:

- Registry can register a pod class by manifest type.
- Registry can instantiate a pod from session data.
- One real pod module loads successfully.

### Issue 2.4: Extend session schema with `pods`

Purpose:
Make pod instances persistent and declarative.

Acceptance criteria:

- Session file supports a `pods` array.
- Pod position, size, state, and connections can round-trip through save/load.

## Epic 3: Representative Pod Migration

### Issue 3.1: Migrate one parameter pod

Recommended target:
`wave-speed-slider`

Acceptance criteria:

- The control exists as an ES module in `src/pods/`.
- It changes behavior only through PodContext and runtime parameter routing.
- Legacy inline implementation can be disabled without regression.

### Issue 3.2: Migrate one visualization pod

Recommended target:
`mini-membrane` or a spectrum analyzer

Acceptance criteria:

- Visualization pod consumes declared inputs instead of globals.
- No direct reads from unrelated UI or physics internals.

### Issue 3.3: Migrate one utility pod

Recommended target:
`wireframe-toggle` or `clear-all`

Acceptance criteria:

- Action flows through declared trigger or parameter interfaces.
- No direct cross-pod mutation.

### Issue 3.4: Migrate one instrument or source pod

Recommended target:
`keyboard-instrument` or `microphone-toggle`

Acceptance criteria:

- Source contract is explicitly declared.
- Runtime can identify whether it is force-driving, audible-output,
  visualization-only, or hybrid.

## Epic 4: Timing and Physics Isolation

### Issue 4.1: Move physics to fixed-step simulation

Acceptance criteria:

- Simulation ticks use fixed-step logic.
- Render pacing does not determine physics progression.

### Issue 4.2: Add render interpolation

Acceptance criteria:

- Rendering can interpolate between simulation snapshots.
- Visual smoothness no longer depends on simulation tick rate.

### Issue 4.3: Move membrane state into a Web Worker

Acceptance criteria:

- Worker owns authoritative physics state.
- Main thread no longer mutates grid state directly.

## Epic 5: Audio Clock and Latency

### Issue 5.1: Timestamp control changes against the AudioContext clock

Acceptance criteria:

- Runtime can associate control events with audio time.
- Simulation and render layers can consume those timestamps consistently.

### Issue 5.2: Move audio-rate generation or analysis into AudioWorklet

Acceptance criteria:

- Selected hot audio path no longer depends on animation-frame cadence.
- Audio-rate code does not allocate per callback.

### Issue 5.3: Add latency measurement harness

Acceptance criteria:

- Project can report source-event to visible-membrane-response latency.
- Measurement conditions are documented.

## Epic 6: Performance Guardrails

### Issue 6.1: Audit hot-path allocations

Acceptance criteria:

- Audio, physics, and render hot paths are identified.
- Per-tick and per-callback allocations are listed or removed.

### Issue 6.2: Introduce high-frequency transfer strategy

Acceptance criteria:

- The design identifies which paths require zero-copy or bounded-copy.
- `SharedArrayBuffer` use is documented along with host requirements.

## Suggested Project Board Columns

- Contracted
- Ready
- In Progress
- Review
- Verified

## Immediate Next Execution Order

1. Complete the state ownership inventory.
2. Introduce the force gateway.
3. Route a first parameter through a single owner.
4. Implement the first pod module.
5. Extend the session schema with `pods`.

## After That

Once those five items are real, the next safe move is a small vertical slice:
convert the wave-speed slider into a pod and remove its legacy direct-global
path. Only after that should the migration widen toward visualization pods,
instrument pods, and thread separation.
