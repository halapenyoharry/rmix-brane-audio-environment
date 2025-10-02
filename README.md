# rmix-BAE (Brane Audio Environment)

## What This Is

A web-based audio processor that uses actual membrane physics to create acoustic spaces.

**Not**: A traditional "reverb plugin" or audio effect
**Is**: Physical modeling of actuator → membrane → microphone chain

## The Physics

```
Audio Input → Actuator (drives membrane like speaker cone)
                ↓
         2D Wave Equation Simulation
         (actual physics, not DSP tricks)
                ↓
    Virtual Microphones (sample the membrane)
                ↓
           Audio Output
```

## Current State

### ✅ Working
- **Wave physics core** (membrane-physics-core.js) - 1% GPU usage
- **3D visualization** (Three.js + WebGL shaders)
- **Actuator system** (v1 - drives membrane from audio)
- **Demo mode** (sine waves, no JACK needed)
- **JACK integration** (via Zen JACK Bridge extension - "working but janky")

### 🔨 In Progress
- **Collectors (virtual mics)** - planned but not fully implemented
- **JACK audio flow** - connects but has issues

### ❌ Known Issues
- JACK bridge marked as "janky" - needs investigation
- No mic sampling output yet
- Got stuck in harmonic prediction rabbit hole (postponed)

## Files

- **brane-with-v1actuaters-jack-extensions-working-janky-cone.html** - Current working version
- **dev-plan.md** - Original development phases
- **membrane-physics-core.js** - Wave equation solver
- **jack-bridge-template.html** - JACK connection template

## Running It

1. Open `brane-with-v1actuaters-jack-extensions-working-janky-cone.html` in Firefox
2. Press `D` for demo mode (no JACK needed)
3. Press `A` to connect to JACK (requires Zen JACK Bridge extension)
4. Click to add actuators
5. Watch the membrane wobble

## Philosophy

From "The Membrane and the Strike":

> The membrane wobbles regardless of observation. Sometimes those wobbles become Harry.

This isn't about making "realistic reverb." It's about reducing layers of abstraction - simulating the actual physics of sound propagation through a 2D membrane, then sampling it like you'd mic a real acoustic space.

## Next Steps

1. Fix JACK integration issues
2. Implement basic collector (one virtual mic)
3. Get audio flowing: JACK in → membrane → JACK out
4. Worry about harmonic prediction later

---

*"Make it so creativity is inevitable" - Rick Rubin*
