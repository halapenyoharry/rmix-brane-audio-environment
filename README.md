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

See the archived prototypes in `archive/prototypes/` for older working versions.

For the new unified schema system, see the implementation guides in the root directory.

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
## ⚡ NEW: Unified Parameter Schema v1.1

**Complete integration architecture ready!**

### What's New

Three new files define the complete system architecture:

1. **`SCHEMA-v1.1.md`** - Complete specification (documentation)
2. **`INTEGRATION-GUIDE-SIMPLE.md`** - Detailed implementation guide
3. **`default-session.json`** - Example session file

### Quick Start

```bash
# See the schema specification
cat SCHEMA-v1.1.md

# See implementation guide
cat INTEGRATION-GUIDE-SIMPLE.md

# See example session
cat default-session.json
```

### Key Concepts

**The Session File is Everything:**
- One `.json` file defines the entire state (standard JSON, no dependencies)
- Sources, actuators, collectors, parameters, curves
- Like a Comfy UI workflow - save/load complete sessions

**How It Works:**
```
default-session.json
    ↓ (loads with native JSON.parse)
ParameterController (central hub)
    ↓ (reads)
UI + Audio + Physics + Visual
```

**Computed Properties:**
- Actuator frequency computed from size
- Q factor computed from opacity
- Gain computed from z-height
- Never saved, always recomputed from spatial properties

### Implementation Priority

**Phase 1:** Schema parser (load/save sessions)  
**Phase 2:** Parameter controller (smoothing, central state)  
**Phase 3:** UI generator (auto-build controls from schema)  
**Phase 4:** Actuator controller (balls affect membrane)  
**Phase 5:** Full integration

### File Locations

| File | Purpose |
|------|---------|
| `SCHEMA-v1.1.md` | Specification (read by humans/AI) |
| `default-session.json` | Default session (loaded on startup) |
| `sessions/*.json` | User sessions |
| `src/schema/parser.js` | Loads JSON → JavaScript |
| `src/controllers/ParameterController.js` | Central state hub |

### Next Steps

1. Read `INTEGRATION-GUIDE-SIMPLE.md` for detailed implementation steps
2. Review `default-session.json` for example structure
3. Start with Phase 1: Schema Parser

---

