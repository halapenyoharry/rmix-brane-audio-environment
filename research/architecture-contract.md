# The BAE Architecture Contract

**Authored by: Gemini Architecture Manager + IDE Agent (Claude Code)**
**Filed: March 2026**

---

## 1. Simulation Purity

The wave equation (PDE) implements only actual physical forces. Input errors
(such as DC offsets from byte-domain conversion) are corrected at the input
boundary, never by adding compensatory math to the physics engine.

*See also: research/dc-cone-artifact-and-pde-purity.md*

## 2. Single State Ownership

At any moment, each piece of state has exactly one owner. Runtime audio state,
physics grid state, and schema/UI state do not overlap.

## 3. Strict Modular Boundaries

All cross-module interaction occurs through explicit imports and typed
interfaces. No module may read or mutate another module's internal state
except through its public contract.

## 4. Explicit Source Contracts

Source contracts must be declared in code and in the schema. Every source must
explicitly define its output type (force-driving, audible-output,
visualization-only, or hybrid) and identify exactly which systems consume
each stream.

## 5. Decoupled Simulation Time

The physics engine operates on a fixed simulation tick independent of the
rendering frame rate. Render frames interpolate between simulation states;
they do not dictate physics progression.

## 6. The Clock/Authority Rule

The `AudioContext` clock is the absolute temporal source of truth. All UI
interactions, parameter changes, and external inputs are timestamped against
the audio timeline. The physics simulation and rendering loops calculate their
current state relative to this master clock to prevent asynchronous drift.

## 7. Thread Isolation by Responsibility

The main thread strictly owns DOM updates and rendering orchestration. A Web
Worker owns the physics state. An AudioWorklet owns audio generation and
analysis at the audio rate.

## 8. Zero-Copy High-Frequency Transfer

High-frequency data paths must use zero-copy or bounded-copy transfer
mechanisms. `SharedArrayBuffer` is the designated implementation for state
transfer between the physics worker and the main thread, conditional on the
host environment supporting cross-origin isolation headers.

## 9. Hot-Path Allocation Ban

Zero dynamic memory allocation is permitted inside the hot paths. There will
be no allocations inside audio callbacks, physics ticks, or render-critical
loops.

## 10. Persistence Boundary

Session data is strictly separated from ephemeral UI states. Ephemeral derived
state must always be reconstructible from the schema plus runtime inputs.

## 11. Latency Budget

The system must achieve under 20ms of latency from a source event to a visible
membrane response. This is measured on local hardware under normal processing
load.

---

## Intellectual Conclusion

This specification eliminates structural ambiguity. It defines strict rules for
state ownership, data mutation, time synchronization, and performance
measurement. Supplying this contract to an implementation AI forces it to
evaluate every syntax decision against a complete, deterministic system
architecture.

---

## Cross-References

This contract sits above and constrains two implementation-level specs:

- **research/dc-cone-artifact-and-pde-purity.md** — The case study that
  motivated Rule 1. Documents the DC cone bug, why the PDE fix was wrong,
  and the layer-discipline principle.

- **research/pod-architecture-spec.md** — The modular pod system that
  implements Rules 2, 3, 4, and 10. Defines the Pod interface, PodContext
  sandbox, port model, registry, session integration, and force gateway.

The contract is the *why*. The specs are the *how*.
