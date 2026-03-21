# Pod Migration GitHub Issue Drafts

These issue bodies are derived from the architecture contract, the pod
specification, and the current state inventory. They are written to be pasted
directly into GitHub Issues with minimal editing.

## Epic: Runtime Seams and State Ownership

### Issue: Produce a State Ownership Inventory

Title:
`Produce a state ownership inventory for the live app`

Body:

```md
## Purpose

Document every major state bucket in the live application and assign exactly
one owner so Phase 1 refactor work has a factual starting point.

## Scope

- Runtime audio state
- Physics state
- Session/schema state
- Ephemeral UI state
- Derived render state

## Non-goals

- No runtime behavior changes
- No pod migration yet
- No worker or worklet changes

## Acceptance Criteria

- Every major state bucket in `brane-with-collectors-websocket.html` is listed.
- Each bucket has one current owner or an explicit ownership conflict noted.
- Known ownership violations are called out with file anchors.
- The document includes low-risk first fixes for Phase 1.

## References

- `research/architecture-contract.md`
- `research/pod-architecture-spec.md`
- `research/state-ownership-inventory.md`
```

### Issue: Introduce a Runtime-Owned Force Gateway

Title:
`Introduce a runtime-owned force gateway for membrane input`

Body:

```md
## Purpose

Create the only legal entry point for external forces entering the membrane so
controls stop mutating physics state directly.

## Scope

- Add a runtime function or object that accepts force intents.
- Move the first actuator path through that gateway.
- Preserve current behavior for valid force events.

## Non-goals

- No PDE changes
- No worker migration yet
- No full pod runtime yet

## Acceptance Criteria

- No control path writes directly into `physics.velocities` or equivalent.
- The gateway can validate, clamp, or reject suspicious force input.
- Valid force events still produce the same visible membrane behavior.
- The membrane physics core remains untouched.

## Dependencies

- State ownership inventory completed

## References

- `research/architecture-contract.md`
- `research/dc-cone-artifact-and-pde-purity.md`
- `research/state-ownership-inventory.md`
```

### Issue: Route Membrane Parameters Through a Single Owner

Title:
`Replace global membrane parameter writes with a runtime parameter store`

Body:

```md
## Purpose

Replace ad hoc globals for membrane parameters with a single runtime-owned
parameter store so the future pod runtime has a stable control boundary.

## Scope

- Centralize `waveSpeed`, `damping`, and `actuatorGain`
- Update existing slider controls to read and write through that store
- Keep current UI behavior intact

## Non-goals

- No pod module implementation yet
- No session persistence changes yet

## Acceptance Criteria

- A first set of membrane parameters is readable from one authoritative store.
- Existing controls no longer mutate those parameters through globals.
- Physics consumes parameter values from the new owner.
- The live app still renders and sliders still work.

## Dependencies

- State ownership inventory completed

## References

- `research/architecture-contract.md`
- `research/state-ownership-inventory.md`
- `default-session.json`
```

## Epic: Pod Runtime on the Main Thread

### Issue: Define Pod Base Contract

Title:
`Implement the base Pod lifecycle contract`

Body:

```md
## Purpose

Introduce the runtime-facing pod lifecycle so controls can begin migrating out
of the monolithic HTML file.

## Scope

- Define the `Pod` interface or base class
- Match the lifecycle in the spec
- Support construction with context and saved state

## Acceptance Criteria

- The lifecycle matches `research/pod-architecture-spec.md`.
- The runtime can instantiate a pod with `ctx` and `savedState`.
- The contract is documented in code comments or adjacent docs.

## References

- `research/pod-architecture-spec.md`
```

### Issue: Define PodContext Sandbox

Title:
`Implement PodContext as the only cross-boundary pod interface`

Body:

```md
## Purpose

Expose only the legal pod API for ports, parameters, and runtime services.

## Scope

- Parameter read/write access
- Port read/write access
- Controlled runtime utility access

## Non-goals

- No raw physics mutation
- No direct access to other pods or globals

## Acceptance Criteria

- PodContext can read and write declared ports.
- PodContext can read and write owned parameters.
- PodContext does not expose direct physics mutation or global state.

## References

- `research/pod-architecture-spec.md`
- `research/architecture-contract.md`
```

### Issue: Implement PodRegistry and Module Loading

Title:
`Load pod modules from src/pods via a runtime registry`

Body:

```md
## Purpose

Make pod discovery and instantiation explicit so controls no longer depend on
switch statements inside the monolithic app file.

## Scope

- Register pod classes by manifest type
- Instantiate from saved state
- Load one real pod module from `src/pods/`

## Acceptance Criteria

- Registry can register and return pod manifests.
- Registry can instantiate a pod from type and saved state.
- One real pod module loads successfully.

## Dependencies

- Pod base contract
- PodContext

## References

- `research/pod-architecture-spec.md`
```

### Issue: Extend Session Schema With Pods

Title:
`Add a pods array to the session schema`

Body:

```md
## Purpose

Make pod instances declarative and persistent so layout and configuration live
in the session boundary instead of runtime-only UI state.

## Scope

- Add `pods[]` to the session format
- Support position, size, state, and connections
- Round-trip save and load

## Acceptance Criteria

- Session data supports a `pods` array.
- Pod position, size, state, and connections round-trip through save/load.
- The format aligns with `research/pod-architecture-spec.md`.

## References

- `default-session.json`
- `research/pod-architecture-spec.md`
```

## Epic: Representative Pod Migration

### Issue: Migrate the Wave-Speed Slider to a Real Pod

Title:
`Migrate the wave-speed slider into the first real pod module`

Body:

```md
## Purpose

Prove the pod architecture with the narrowest safe vertical slice: one
parameter pod backed by the runtime parameter store.

## Scope

- Implement `wave-speed-slider` in `src/pods/`
- Route changes through runtime parameter ownership
- Preserve current behavior

## Acceptance Criteria

- The control exists as an ES module in `src/pods/`.
- It changes behavior only through pod context and runtime parameter routing.
- The legacy inline slider path can be disabled without regression.

## Dependencies

- Runtime parameter store
- Pod base contract
- PodContext
- PodRegistry

## References

- `research/pod-architecture-spec.md`
- `research/state-ownership-inventory.md`
```

### Issue: Migrate One Visualization Pod

Title:
`Migrate one visualization control into a pod`

Body:

```md
## Purpose

Verify that the pod model works for read-only or display-oriented controls, not
just parameter sliders.

## Recommended Target

- `mini-membrane` or spectrum analyzer

## Acceptance Criteria

- The visualization consumes declared inputs instead of globals.
- No direct reads from unrelated physics or UI internals remain.
```

### Issue: Migrate One Utility Pod

Title:
`Migrate one utility control into a pod`

Body:

```md
## Purpose

Verify that discrete system actions can flow through the same runtime contract.

## Recommended Target

- `wireframe-toggle` or `clear-all`

## Acceptance Criteria

- The action flows through declared trigger or parameter interfaces.
- No direct cross-pod mutation remains.
```

### Issue: Migrate One Instrument or Source Pod

Title:
`Migrate one instrument or source control into a pod with an explicit source contract`

Body:

```md
## Purpose

Prove that the pod model can express source semantics, not just UI behavior.

## Recommended Target

- `keyboard-instrument` or `microphone-toggle`

## Acceptance Criteria

- The source contract is explicitly declared.
- The runtime can identify whether the source is force-driving,
  audible-output, visualization-only, or hybrid.
```

## Epic: Timing and Isolation

### Issue: Move Physics to a Fixed-Step Simulation Loop

Title:
`Decouple physics progression from render frame pacing`

Body:

```md
## Purpose

Make the simulation timing rule true before moving the physics core off the
main thread.

## Acceptance Criteria

- Simulation ticks use fixed-step logic.
- Render pacing does not determine physics progression.
- The membrane still behaves correctly under frame jitter.
```

### Issue: Add Render Interpolation

Title:
`Interpolate render frames between simulation snapshots`

Body:

```md
## Purpose

Keep rendering visually smooth after physics is decoupled from the frame loop.

## Acceptance Criteria

- Rendering interpolates between simulation snapshots.
- Visual smoothness no longer depends on simulation tick rate.
```

### Issue: Move Membrane State Into a Web Worker

Title:
`Move authoritative membrane state into a Web Worker`

Body:

```md
## Purpose

Enforce thread isolation by moving physics state ownership off the main thread.

## Acceptance Criteria

- The Worker owns authoritative physics state.
- The main thread no longer mutates membrane grid state directly.
- Existing rendering still consumes valid membrane state.
```

## Epic: Audio Clock and Latency

### Issue: Timestamp Control Changes Against AudioContext Time

Title:
`Use AudioContext time as the authoritative clock for control changes`

Body:

```md
## Purpose

Make the clock and authority rule operational before latency optimization work.

## Acceptance Criteria

- Runtime can associate control events with audio time.
- Simulation and render layers can consume those timestamps consistently.
```

### Issue: Move Audio-Rate Work Into an AudioWorklet

Title:
`Move selected audio-rate generation or analysis into an AudioWorklet`

Body:

```md
## Purpose

Remove animation-frame timing from the hottest audio path.

## Acceptance Criteria

- The selected hot audio path no longer depends on requestAnimationFrame.
- Audio-rate code does not allocate per callback.
```

### Issue: Add a Latency Measurement Harness

Title:
`Measure source-event to visible-membrane latency`

Body:

```md
## Purpose

Make the latency budget measurable instead of aspirational.

## Acceptance Criteria

- The project can report source-event to visible-membrane-response latency.
- Measurement conditions are documented.
- Results can be compared against the under-20ms target.
```

## Epic: Performance Guardrails

### Issue: Audit Hot-Path Allocations

Title:
`Audit and remove allocations in audio, physics, and render hot paths`

Body:

```md
## Purpose

Support the hot-path allocation ban with actual evidence.

## Acceptance Criteria

- Audio, physics, and render hot paths are identified.
- Per-tick and per-callback allocations are listed or removed.
```

### Issue: Define the High-Frequency Transfer Strategy

Title:
`Define zero-copy or bounded-copy transfer for high-frequency data`

Body:

```md
## Purpose

Specify how high-frequency state moves safely once physics and rendering are
split across threads.

## Acceptance Criteria

- High-frequency transfer paths are identified.
- `SharedArrayBuffer` use and host requirements are documented.
- The design is consistent with the architecture contract.
```

## Recommended First Creation Order

1. Produce a state ownership inventory for the live app.
2. Replace global membrane parameter writes with a runtime parameter store.
3. Introduce a runtime-owned force gateway for membrane input.
4. Implement the base Pod lifecycle contract.
5. Implement PodContext as the only cross-boundary pod interface.
6. Load pod modules from `src/pods` via a runtime registry.
7. Migrate the wave-speed slider into the first real pod module.
