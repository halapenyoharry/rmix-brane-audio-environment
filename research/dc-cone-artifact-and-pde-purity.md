# Don't Patch the PDE: DC Cone Artifacts in Browser-Based Membrane Simulation

**BAE Research Note — March 2026**
**Harold Patterson, with Claude (Anthropic)**

---

## Abstract

A persistent cone-shaped displacement artifact appears in BAE's membrane
physics simulation when audio actuators are connected but no audio is playing.
The intuitive fix — adding a restoring-force term (−ku) to the wave equation —
eliminates the cone but fundamentally changes what the simulation *is*. This
paper identifies the actual cause (a DC offset introduced by the Web Audio
API's byte-domain silence representation), argues that the wave equation must
remain unmodified, and specifies the correct fix at the actuator input boundary.

---

## 1. The Phenomenon

BAE simulates a 2D membrane governed by the wave equation with viscous damping:

$$\frac{\partial^2 u}{\partial t^2} = c^2 \nabla^2 u - \gamma \frac{\partial u}{\partial t}$$

Discretized via finite differences:

```
v[i][j] += c² * (u[i+1][j] + u[i-1][j] + u[i][j+1] + u[i][j-1] - 4*u[i][j])
v[i][j] *= (1 - γ)
u[i][j] += v[i][j]
```

When actuators are connected via the piano widget but no keys are pressed, the
membrane develops a static cone depression at each actuator position within
approximately two seconds. The cone deepens monotonically and does not
self-correct.

---

## 2. The Tempting Fix (and Why It's Wrong)

The obvious remedy is to add a restoring-force term to the PDE:

$$\frac{\partial^2 u}{\partial t^2} = c^2 \nabla^2 u - \gamma \frac{\partial u}{\partial t} - ku$$

This is the **membrane-on-elastic-foundation** equation (sometimes called the
Klein-Gordon equation in wave mechanics). The −ku term acts as a spring pulling
every point back toward u = 0 proportional to displacement, which does kill the
cone.

**But it changes the physics.** Specifically:

### 2.1 Dispersion

The plain wave equation is **non-dispersive**: all frequencies travel at speed
c. Adding −ku introduces a dispersion relation:

$$\omega^2 = c^2 k^2 + k_{\text{stiffness}}$$

Now phase velocity depends on frequency. Low-frequency components travel faster
than high-frequency components. A sharp impulse — which should propagate as a
clean expanding ring — instead smears into a chirp. This is observable in the
simulation at any non-trivial value of k.

### 2.2 Frequency-Dependent Attenuation

The restoring force acts as a high-pass filter on the *physics itself*. Slow,
large-scale membrane motions — exactly the ones that look most dramatic and
informative in the visualization — get suppressed hardest. The simulation
becomes biased toward showing you high-frequency ripples while eating the bass.

### 2.3 It Solves a Problem That Doesn't Exist in the PDE

This is the key point. The wave equation with damping is *stable under zero
input*. Feed it no force, and damping brings the membrane to rest at u = 0.
There is no mechanism in the PDE that produces a static cone from nothing.

The cone comes from *outside* the equation. Adding a term *inside* the equation
to compensate for an error *outside* it is a category error — like adding a
gravitational constant to Maxwell's equations because your voltmeter has a
stuck needle.

### 2.4 The "DC Blocker" Framing Is a Trap

Audio engineers are trained to think in terms of DC blockers — high-pass
filters that remove the zero-frequency component from a signal. The −ku term
does function as a DC blocker. This makes it *feel* correct if you're thinking
about BAE as an audio processor.

But BAE's membrane is not an audio processor. It is a wave propagation
simulator that *receives* audio as input. The DC component must be removed from
the input signal *before* it enters the PDE, not compensated for *inside* the
PDE. The simulation's job is to propagate whatever it receives faithfully. If
it receives garbage, the correct response is to stop feeding it garbage, not to
build garbage collection into the laws of physics.

---

## 3. The Actual Cause

The Web Audio API's `AnalyserNode.getByteTimeDomainData()` returns sample
values as unsigned 8-bit integers in the range [0, 255], where 128 represents
silence. Due to quantization, a silent input does not return exactly 128 for
every sample. Empirically, a connected but silent analyser returns values
averaging approximately 127.8.

BAE's actuator code converts byte-domain audio to force:

```javascript
const avg = sum / audioData.length;          // ≈ 127.8 for silence
const force = ((avg - 128) / 128) * gain;    // ≈ -0.0016 * gain
```

This produces a small constant negative force at each actuator position every
frame. Crucially:

1. **Damping cannot counteract a constant force.** Damping is proportional to
   velocity (−γv), not displacement. It reduces the *rate* of cone growth but
   cannot reverse it. The system reaches a steady state only when the laplacian
   term exactly balances the applied force — which, for a point source on a
   finite membrane, means a logarithmic cone.

2. **The feedback loop deepens it.** BAE's actuator applies a height-dependent
   gain adjustment:
   ```javascript
   const memSurface = physics.heights[this.gridX][this.gridY];
   const height = Math.max(0.5, 2 + memSurface * 0.8);
   const heightGain = 4.0 / (1 + Math.pow(height / 4.0, 2));
   ```
   As the membrane dips negative, heightGain increases, amplifying the already-
   nonzero DC force. Positive feedback accelerates the cone.

---

## 4. The Correct Fix

The fix belongs entirely in the actuator input layer. Three options, in order
of preference:

### 4.1 Use Float-Domain Audio Data (Preferred)

Replace `getByteTimeDomainData()` with `getFloatTimeDomainData()`. The float
API returns samples centered on 0.0, not 128. Silence is 0.0, not ≈127.8.
The DC offset disappears at the source.

```javascript
// Before (byte domain — silence ≈ 127.8, produces DC offset)
analyser.getByteTimeDomainData(dataArray);
const avg = sum / dataArray.length;
const force = ((avg - 128) / 128) * gain;

// After (float domain — silence = 0.0, no DC offset)
analyser.getFloatTimeDomainData(floatArray);
const avg = floatArray.reduce((a, b) => a + b, 0) / floatArray.length;
const force = avg * gain;
```

This is the cleanest fix. It eliminates the quantization error entirely rather
than working around it. The force calculation becomes a direct scaling of the
audio signal with no magic constants.

### 4.2 Epsilon Threshold

If byte-domain data must be used for compatibility, apply a dead zone:

```javascript
const force = Math.abs(raw) < 0.005 ? 0.0 : raw * gain;
```

Simple, but introduces a discontinuity at the threshold boundary that can
produce its own artifacts on transient edges.

### 4.3 Running Mean Subtraction

Subtract the exponential moving average from each sample before force
calculation:

```javascript
this.dcEstimate = this.dcEstimate * 0.999 + avg * 0.001;
const force = (avg - this.dcEstimate) * gain;
```

This is the standard DC-blocking technique from audio engineering, applied
where it belongs: at the signal boundary, not inside the physics.

---

## 5. Design Principle: Simulation Purity

BAE's value proposition is that it shows you *how waves actually propagate on a
2D membrane*. Not an approximation tuned to look good. Not a visualization
metaphor. The actual physics, abstraction-free, rendered in real time.

This imposes a hard constraint: **the update loop implements the wave equation
and nothing else.** Every term in the PDE must correspond to a physical force
that acts on a real membrane:

| Term | Physical meaning | Present in BAE? |
|------|-----------------|-----------------|
| c²∇²u | Tension / wave propagation | Yes |
| −γ∂u/∂t | Viscous damping (air resistance, internal friction) | Yes |
| −ku | Elastic foundation (membrane glued to springs) | **No — not a free membrane** |
| f(x,y,t) | External forcing (actuators, strikes) | Yes, via input layer |

If a term doesn't correspond to a real force on the membrane, it doesn't go in
the PDE. If an artifact appears that isn't produced by the PDE, the cause is in
the input or the rendering, and that's where the fix goes.

This is the same principle that keeps physics engines honest in other domains:
you don't add fictional forces to Newton's laws to compensate for bad collision
detection. You fix the collision detection.

---

## 6. Broader Lesson: Layer Discipline

The cone bug is an instance of a general antipattern: **compensating for an
error at layer N by modifying layer N−1.** The layer stack in BAE is:

```
Layer 3: Rendering (Three.js — heights → geometry)
Layer 2: Physics    (wave equation — forces → heights)
Layer 1: Input      (actuators — audio API → forces)
Layer 0: Source     (Web Audio API — samples → byte/float arrays)
```

The error originates at Layer 0 (byte quantization) and propagates through
Layer 1 (actuator force calculation). The tempting fix modifies Layer 2 (the
PDE). The correct fix addresses Layer 1 or Layer 0.

Modifying a lower layer to compensate for a higher layer's error is always
wrong in simulation, because the lower layer is the *ground truth* that
everything above depends on. Corrupting it may fix one symptom but undermines
every future feature that depends on the physics being correct — collectors
reading membrane velocity, frequency analysis of propagated waves, multi-
actuator interference patterns, anything.

---

## 7. Summary

| | PDE fix (−ku) | Input fix (float API) |
|---|---|---|
| Eliminates cone | Yes | Yes |
| Preserves non-dispersive propagation | **No** | Yes |
| Preserves low-frequency fidelity | **No** | Yes |
| Adds parameters to tune | Yes (k) | No |
| Changes what the simulation is | **Yes** | No |
| Correct layer for the fix | No | **Yes** |

The membrane physics core implements the wave equation. The wave equation is
correct. The cone artifact is caused by a DC offset in the Web Audio API's
byte-domain silence representation leaking through the actuator layer as a
constant force. The fix is to switch actuators to `getFloatTimeDomainData()` or
apply DC rejection at the input boundary. The PDE stays clean.

---

## Appendix: When −ku *Is* Appropriate

The restoring-force term is physically correct for membranes stretched over an
elastic medium — a drumhead resting on foam, a diaphragm in a sealed cavity
where air pressure provides the restoring force. If BAE ever models these
specific physical configurations, −ku belongs in a subclass or configuration
mode, not in the base wave equation. The base equation should model the
simplest physical case (free membrane with damping) and additional forces
should be opt-in, documented, and named for what they physically represent.

---

*Filed under: research/dc-cone-artifact-and-pde-purity.md*
*Repository: rmix-brane-audio-environment*
