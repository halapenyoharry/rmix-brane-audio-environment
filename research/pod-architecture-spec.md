# Pod Architecture Specification

**BAE Research Document — March 2026**
**Harold Patterson, with Claude (Anthropic) — "The Researcher"**

---

## Abstract

BAE's control surface is currently a monolithic tile system: a single JSON
config, a single HTML file containing all tile type implementations, and direct
access to global state. This document specifies a **pod architecture** — a
modular system where each control surface element is a self-contained module
that declares its inputs, outputs, and UI, and communicates with the brane
through a mediated interface rather than reaching into globals.

The design goal is not beauty. It is composability: anyone (human or AI) should
be able to build a new pod without reading or touching the core, and the core
should be able to host pods it has never seen before.

---

## 1. What Is a Pod

A pod is a self-contained control module that lives on the brane's control
surface. It has:

- **Identity**: a unique type name (e.g., `keyboard`, `wave-speed-slider`,
  `spectrum-analyzer`, `microphone-toggle`)
- **Ports**: declared input and output connections to the brane's signal flow
- **UI**: a DOM element it owns and renders into
- **State**: serializable configuration that persists across sessions
- **Lifecycle**: init → connect → run → disconnect → destroy

Pods replace tiles. The word "tile" is retired. The word "pod" reflects
that these are independent organisms attached to the brane, not decorative
squares in a dashboard.

---

## 2. The Current Problem

The tile system has three structural problems:

### 2.1 All Types Live in One File

Every tile type — toggle, slider, keyboard, mini-membrane — is implemented
as a function in `brane-with-collectors-websocket.html`. Adding a new type
means editing a 2,500-line HTML file and adding a case to a switch statement.
No agent (human or AI) should need to understand the whole file to add one
control.

### 2.2 Direct Global Access

Tiles reach into `window.actuatorGain`, `physics.setWaveSpeed()`,
`leftAnalyser`, and `leftAudioData` directly. This means:
- Every tile is coupled to every other tile's naming conventions
- There is no isolation — a bug in one tile can corrupt shared state
- Testing a tile in isolation is impossible
- The DC cone bug existed partly because the byte-domain audio data was a
  shared global that no single component owned or validated

### 2.3 No Port Model

Tiles have no declared inputs or outputs. The keyboard tile "just knows" that
it should call `getByteTimeDomainData` (now `getFloatTimeDomainData`) and
feed forces to the physics engine. This knowledge is implicit in the code,
not declared in a way the system can reason about.

---

## 3. Pod Interface

Every pod implements this interface. No exceptions, no optional methods.
The brane runtime calls these methods; pods never call the runtime directly
except through the context object provided at init.

```javascript
class Pod {
    /**
     * @param {PodContext} ctx — the pod's only connection to the outside world
     * @param {Object} savedState — deserialized state from session, or null
     */
    constructor(ctx, savedState) {}

    /** Return pod type metadata (static — called before instantiation) */
    static manifest() {
        return {
            type: 'my-pod-type',       // unique string, kebab-case
            label: 'My Pod',           // human-readable name
            description: '',           // one-liner for pod browser
            version: '1.0.0',
            category: 'audio-source',  // see §3.1
            defaultSize: { w: 160, h: 90 },
            resizable: true,
            singleton: false,          // true = only one instance allowed
            ports: {                   // see §4
                inputs: [],
                outputs: []
            }
        };
    }

    /**
     * Render the pod's UI into the provided container element.
     * Called once after construction. The pod owns this DOM node.
     * @param {HTMLElement} container — empty div, sized per manifest
     */
    render(container) {}

    /**
     * Called every animation frame while the pod is active.
     * This is where the pod reads inputs, does work, and writes outputs.
     * @param {number} dt — time since last frame in ms
     */
    update(dt) {}

    /**
     * Serialize current state for session save.
     * Must return a plain JSON-serializable object.
     * @returns {Object}
     */
    serialize() {}

    /**
     * Clean up. Remove event listeners, release audio nodes, etc.
     * Called when the pod is removed from the brane or the session ends.
     */
    destroy() {}
}
```

### 3.1 Categories

Pods declare a category so the pod browser can group them and so the runtime
can apply category-specific behavior (e.g., audio-source pods get an analyser
node automatically):

| Category | Purpose | Examples |
|----------|---------|---------|
| `audio-source` | Brings audio into the brane | mic-input, tab-capture, file-player, demo-loops |
| `instrument` | Generates audio from user input | keyboard, drum-pad |
| `physics-control` | Adjusts membrane parameters | wave-speed, damping, grid-size |
| `actuator-control` | Configures actuator behavior | gain, channel-selector |
| `visualization` | Displays data, no side effects | spectrum-analyzer, mini-membrane, waveform |
| `utility` | System functions | fullscreen, wireframe-toggle, clear-all, session-save |
| `modulator` | Modifies parameters over time | LFO, envelope-follower |

---

## 4. Ports

Ports are how pods declare what signals they consume and produce. The brane
runtime wires ports together; pods never reach across to other pods or into
globals.

### 4.1 Port Types

| Port type | Data shape | Direction | Example |
|-----------|-----------|-----------|---------|
| `audio` | Float32Array (per frame) | in or out | mic audio, keyboard audio |
| `force` | `{ gridX, gridY, value, radius }` | out | actuator force into membrane |
| `parameter` | `{ id, value }` | in or out | wave-speed slider output |
| `height-field` | Float32Array (gridSize²) | in | membrane surface for visualization |
| `trigger` | `{ action, payload }` | out | button press, toggle state change |
| `velocity-field` | Float32Array (gridSize²) | in | membrane velocities for collectors |

### 4.2 Port Declaration

Ports are declared in the static manifest:

```javascript
static manifest() {
    return {
        type: 'keyboard-instrument',
        // ...
        ports: {
            inputs: [
                { name: 'audio-feedback', type: 'audio', optional: true }
            ],
            outputs: [
                { name: 'audio-out', type: 'audio' },
                { name: 'force-out', type: 'force' }
            ]
        }
    };
}
```

### 4.3 Reading and Writing Ports

In the `update()` method, pods read inputs and write outputs through the
context object:

```javascript
update(dt) {
    // Read input port (returns null if not connected)
    const audioIn = this.ctx.readPort('audio-feedback');

    // Do work...
    const force = this.calculateForce(audioIn);

    // Write output port
    this.ctx.writePort('force-out', {
        gridX: this.gridX,
        gridY: this.gridY,
        value: force,
        radius: 3
    });
}
```

The runtime collects all `force` outputs after every pod's `update()` runs
and applies them to the physics engine in a single batch. Pods never call
`physics.applyForce()` directly.

This is the key inversion: **pods describe what they want to happen; the
brane decides how to make it happen.** A force output port doesn't mean
"call applyForce on the physics object" — it means "I am producing a force
at this location." The runtime owns the physics; the pod owns the intention.

---

## 5. PodContext

The PodContext is the pod's **only** interface to the outside world. It is
constructed by the runtime and passed to the pod's constructor. It is a
sandbox: it exposes only what the pod is allowed to touch.

```javascript
class PodContext {
    /** Read a connected input port. Returns typed data or null. */
    readPort(portName) {}

    /** Write to an output port. Data must match port type. */
    writePort(portName, data) {}

    /** Get the AudioContext (shared, read-only reference). */
    getAudioContext() {}

    /** Create an AnalyserNode connected to the current audio source. */
    createAnalyser(options) {}

    /**
     * Read a session parameter by ID.
     * Pods should NOT store parameter values locally — always read through
     * context so that external changes (OSC, other pods) are visible.
     */
    getParameter(paramId) {}

    /** Set a session parameter by ID. Emits change event to all listeners. */
    setParameter(paramId, value) {}

    /** Subscribe to parameter changes. Returns unsubscribe function. */
    onParameterChange(paramId, callback) {}

    /** Get membrane grid size (read-only). */
    getGridSize() {}

    /** Get the pod's position on the control surface { x, y }. */
    getPosition() {}

    /** Get the pod's current size { w, h }. */
    getSize() {}

    /** Request the runtime to remove this pod. */
    requestRemove() {}

    /** Log a message attributed to this pod. */
    log(level, message) {}
}
```

### 5.1 What PodContext Does NOT Expose

This list is as important as the API itself:

- **No direct physics access.** Pods cannot call `physics.updatePhysics()`,
  `physics.heights[][]`, or `physics.applyForce()`. They write to force ports;
  the runtime applies forces. They read height-field ports; the runtime
  provides the data. This is what prevents another DC cone bug — the runtime
  can validate, threshold, or transform forces before they enter the PDE.

- **No direct DOM access outside the pod's container.** A pod cannot
  `document.getElementById()` something that belongs to another pod or to
  the brane canvas. It renders into its own container and nowhere else.

- **No access to other pods.** Pods don't know other pods exist. If pod A
  needs data from pod B, they are connected through ports. Pod A reads its
  input port; pod B writes its output port. The runtime wires them.

- **No global state.** `window.actuatorGain` is gone. It becomes a session
  parameter that pods read through `ctx.getParameter()` and write through
  `ctx.setParameter()`.

---

## 6. Pod Registry

The runtime discovers and manages pods through a registry:

```javascript
class PodRegistry {
    /** Register a pod class by its manifest type. */
    register(PodClass) {}

    /** Get all registered pod types. */
    getTypes() {}

    /** Get manifest for a specific type. */
    getManifest(type) {}

    /** Instantiate a pod of the given type. */
    create(type, savedState) {}

    /** Load a pod module from a file path (dynamic import). */
    async loadFromFile(path) {}
}
```

### 6.1 Pod File Convention

Each pod is a single ES module file in `src/pods/`:

```
src/pods/
  keyboard-instrument.pod.js
  wave-speed-slider.pod.js
  mic-input-toggle.pod.js
  spectrum-analyzer.pod.js
  ...
```

The `.pod.js` extension is a convention, not enforced. The registry auto-
discovers files in `src/pods/` at startup and calls `register()` on each
exported class. A pod file looks like:

```javascript
// src/pods/wave-speed-slider.pod.js

export default class WaveSpeedSliderPod {
    static manifest() {
        return {
            type: 'wave-speed-slider',
            label: 'Wave Speed',
            category: 'physics-control',
            defaultSize: { w: 160, h: 90 },
            ports: {
                inputs: [],
                outputs: [
                    { name: 'param-out', type: 'parameter' }
                ]
            }
        };
    }

    constructor(ctx, savedState) {
        this.ctx = ctx;
        this.value = savedState?.value
            ?? ctx.getParameter('membrane_wave_speed')
            ?? 0.15;
    }

    render(container) {
        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = 0.05;
        this.slider.max = 0.3;
        this.slider.step = 0.01;
        this.slider.value = this.value;
        this.slider.addEventListener('input', (e) => {
            this.value = parseFloat(e.target.value);
            this.ctx.setParameter('membrane_wave_speed', this.value);
        });
        container.appendChild(this.slider);
    }

    update(dt) {
        // Sliders are event-driven, nothing per-frame needed.
        // But if an external source (OSC, another pod) changed the param:
        const current = this.ctx.getParameter('membrane_wave_speed');
        if (current !== this.value) {
            this.value = current;
            this.slider.value = current;
        }
    }

    serialize() {
        return { value: this.value };
    }

    destroy() {
        // Slider will be removed when container is destroyed.
    }
}
```

That's a complete pod. 40 lines. No imports from the core. No globals.

---

## 7. Session Integration

The existing session schema (v1.1) already has the right top-level structure:
sources, actuators, collectors, modulators, parameters, mappingCurves,
uiLayout. Pods integrate by adding a `pods` array to the session:

```json
{
    "version": "1.2",
    "pods": [
        {
            "id": "pod_wave_speed_1",
            "type": "wave-speed-slider",
            "position": { "x": 410, "y": 10 },
            "size": { "w": 160, "h": 90 },
            "state": { "value": 0.15 },
            "connections": [
                {
                    "port": "param-out",
                    "target": "membrane_wave_speed"
                }
            ]
        },
        {
            "id": "pod_keyboard_1",
            "type": "keyboard-instrument",
            "position": { "x": 10, "y": 200 },
            "size": { "w": 320, "h": 100 },
            "state": { "octave": 4, "waveform": "sine" },
            "connections": [
                {
                    "port": "force-out",
                    "target": "membrane.physics"
                }
            ]
        }
    ]
}
```

The `connections` array replaces the implicit wiring that currently lives in
procedural code. When a session loads, the runtime reads each pod entry,
instantiates the pod class from the registry, restores its state, and wires
its ports according to the connections list.

`tiles-config.json` is retired. It becomes the `pods` array in the session.

---

## 8. Runtime Loop

The brane runtime's animation frame becomes:

```
1. updateAudioData()          — fill shared Float32Array buffers
2. for each pod: pod.update(dt)  — pods read inputs, write outputs
3. collectForces()            — gather all force-port outputs
4. validateForces()           — threshold, clamp, reject DC (layer 1 defense)
5. physics.updatePhysics()    — the PDE runs, untouched
6. distributeHeightField()    — push height data to height-field input ports
7. for each pod: pod.render() — pods update their DOM (only if needed)
8. renderMembrane()           — Three.js geometry update + draw
```

Steps 3–4 are the **force gateway** — the single point where external forces
enter the PDE. This is where the DC cone fix lives architecturally. If any
pod's force output has a suspicious DC component, the gateway catches it
before it reaches the physics core. The PDE never needs to defend itself.
That's layer discipline enforced by architecture, not by convention.

---

## 9. Migration Path

This architecture should not be implemented as a rewrite. The current system
must remain runnable while the new seams are introduced one by one. The
migration strategy is therefore **vertical and staged**: establish ownership,
insert the runtime boundary, migrate representative controls, then move timing
and concurrency once the contracts are real.

### 9.1 Phase 0: Freeze the Contract

Goal: stop architectural drift before writing migration code.

Deliverables:

- `research/architecture-contract.md` is treated as the top-level constraint
    document.
- This pod specification is treated as the implementation-level design for the
    control surface runtime.
- The DC cone note remains the authoritative case study for simulation purity
    and force-boundary discipline.
- A tracked issue tree exists before major refactor work begins.

Exit criteria:

- The team can answer, in writing, who owns state, where forces enter the
    PDE, what persists, and which clock is authoritative.

### 9.2 Phase 1: Establish Runtime Seams in the Existing App

Goal: keep `brane-with-collectors-websocket.html` operational while creating
the first architecture boundaries inside it.

Deliverables:

- A state ownership inventory covering runtime audio state, physics state,
    session/schema state, and ephemeral UI state.
- A runtime-owned **force gateway** that becomes the only legal path for
    external forces entering the membrane.
- The first removal of direct control-to-physics mutation.
- Parameter access routed through one owner instead of ad hoc globals.

Non-goals:

- No Worker migration yet.
- No AudioWorklet migration yet.
- No visual redesign.

Exit criteria:

- At least one existing control writes intent into the runtime boundary rather
    than touching physics directly.

### 9.3 Phase 2: Introduce the Pod Runtime on the Main Thread

Goal: make the pod model real before introducing cross-thread complexity.

Deliverables:

- `Pod`, `PodContext`, and `PodRegistry` base contracts implemented.
- `src/pods/` established as the canonical pod module location.
- Session schema extended with a `pods` array.
- One low-risk control migrated into a real pod module.

Recommended first pod:

- `wave-speed-slider` or `damping-slider`, because it exercises state
    ownership and parameter routing without depending on audio timing.

Exit criteria:

- The app can instantiate at least one pod from an ES module without breaking
    the existing membrane renderer.

### 9.4 Phase 3: Migrate Representative Pod Types

Goal: prove that the model works across categories instead of only for simple
sliders.

Deliverables:

- One parameter pod.
- One visualization pod.
- One utility pod.
- One instrument or audio-source pod.

Why this matters:

- If the architecture only works for sliders, it is not a pod architecture.
- If the keyboard or microphone path resists migration, that resistance is a
    design signal, not a pod failure.

Exit criteria:

- At least four pods from distinct categories run through the runtime without
    direct global access.

### 9.5 Phase 4: Decouple Time and Move Physics Off the Main Thread

Goal: make the timing contract true.

Deliverables:

- Fixed-step simulation loop independent of animation frame pacing.
- Render interpolation between simulation snapshots.
- Web Worker ownership of membrane state.
- Main-thread rendering consumes worker-produced state instead of owning the
    simulation.

Dependencies:

- State ownership and force gateway must already exist.
- Pod contracts must already be real on the main thread.

Exit criteria:

- Render jitter does not alter the number or timing of physics ticks.

### 9.6 Phase 5: Move Audio-Rate Responsibilities to an AudioWorklet

Goal: make the clock and latency rules true where timing matters most.

Deliverables:

- Audio-rate generation and analysis moved into an AudioWorklet where needed.
- Runtime timestamps parameter changes against the `AudioContext` clock.
- Source-to-membrane latency measurement harness added.
- Hot-path allocation audit completed for audio, physics, and render loops.

Exit criteria:

- Local instrumentation can report measured end-to-end response latency.
- The system either meets the under-20ms target or reports a specific gap.

### 9.7 Phase Ordering Rule

Do not start with Workers or Worklets. Moving undisciplined state to another
thread does not solve architecture; it makes it harder to debug. Ownership,
contracts, and the force gateway come first. Time decoupling comes second.
Concurrency comes third.

### 9.8 First Vertical Slice

The recommended first end-to-end slice is:

1. Define a session-owned parameter for membrane wave speed.
2. Implement a `wave-speed-slider` pod as an ES module.
3. Route its output through `PodContext.setParameter()`.
4. Apply the resulting parameter through the runtime-owned membrane boundary.
5. Verify the old slider path can be removed without behavior regression.

This slice is deliberately narrow. It proves modular boundaries, state
ownership, session integration, and runtime mediation without dragging audio
timing complexity into the first refactor.

### 9.9 Work Allocation Guidance

Different tools or agents can help, but only inside bounded scopes.

- Use architecture documents to define invariants and acceptance criteria.
- Use implementation agents to execute one issue at a time.
- Use search or analysis agents to inventory globals, ownership violations,
    or hot-path allocations.
- Do not delegate multi-layer redesign as a single prompt.

The architecture contract defines truth. Issue slices define work. Agents and
models only operate safely inside those slices.
