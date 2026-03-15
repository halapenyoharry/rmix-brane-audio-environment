# RMIX File Architecture - Quick Reference

## Where Files Live

```
rmix-brane-audio-environment/
│
├── SCHEMA-v1.1.md              ← DOCUMENTATION (read this)
├── INTEGRATION-GUIDE.md        ← IMPLEMENTATION GUIDE (follow this)
├── default-session.json5       ← RUNTIME DATA (app loads this)
│
└── sessions/                   ← USER SESSIONS (save/load here)
    ├── my-ambient-patch.json5
    └── drum-texture.json5
```

## How UI Connects to Schema

### 1. Session File = The Truth

**`default-session.json5`** contains everything:
- Audio sources (where sound comes from)
- Actuators (balls on membrane)
- Parameters (membrane physics, visual settings)
- Mapping curves (size → frequency, opacity → Q, etc.)

**The UI reads this file on startup.**

### 2. The Flow

```
User clicks "Open" 
    ↓
Parser reads session.json5
    ↓
ParameterController stores all values
    ↓
UI reads from ParameterController
Audio reads from ParameterController  
Physics reads from ParameterController
    ↓
User drags slider
    ↓
UI writes to ParameterController
    ↓
Physics/Audio update automatically
```

### 3. One Hub, Many Readers

**ParameterController = Central Hub**
- Stores current value of EVERY parameter
- Handles smoothing
- Notifies everyone when values change

**Everyone subscribes to it:**
```javascript
paramCtrl.subscribe('membrane_wave_speed', (value) => {
  membrane.setWaveSpeed(value);  // Physics updates
});
```

## What Gets Saved vs Computed

### Saved in Session File ✅
- Actuator position (x, y, z)
- Actuator size (radius_mm)
- Actuator opacity
- Parameter values
- Source configurations

### Computed at Runtime 🔄
- Actuator frequency (from size)
- Actuator Q factor (from opacity)
- Actuator gain (from z-height)
- Actuator color (from frequency)
- FFT bin ranges

**Why?** So you can tweak the mapping curves globally and all balls update.

## Key Files to Create

### Phase 1: Loading/Saving
```javascript
src/schema/parser.js          // Loads .json5 files
src/schema/validator.js       // Checks references, ranges
```

### Phase 2: State Management
```javascript
src/controllers/ParameterController.js  // Central hub
src/schema/mapper.js                    // Computes derived values
```

### Phase 3: UI Generation
```javascript
src/ui/UIGenerator.js         // Builds controls from schema
src/ui/Toolbar.js            // Bottom toolbar
```

### Phase 4: Actuators
```javascript
src/controllers/ActuatorController.js   // Manages balls
src/physics/ForceApplicator.js         // Couples audio → membrane
```

## Example: Adding a New Actuator

### In Code
```javascript
// User clicks on membrane
const newActuator = {
  id: "ball_" + Date.now(),
  sourceId: "source_guitar",  // Must exist in session.sources
  position: { x: clickX, y: 0, z: 5 },
  size: { radius_mm: 15 },
  appearance: { opacity: 0.7 }
  // ... rest from template
};

session.actuators.push(newActuator);
actuatorController.createActuator(newActuator);
```

### In Session File
```json5
actuators: [
  {
    id: "ball_bass",
    sourceId: "source_guitar",  // ← Must match a source
    position: { x: -10, y: 0, z: 5 },
    size: { radius_mm: 25 },     // ← Bigger = lower freq
    appearance: { opacity: 0.9 }  // ← More opaque = narrower Q
  }
]
```

## The Magic: Computed Properties

**You drag ball horizontally:**
```
size changes: 15mm → 20mm
    ↓
mapper.sizeToFrequency(20)
    ↓
frequency: 1500Hz → 800Hz
    ↓
FFT bins: [60-70] → [35-45]
    ↓
Ball responds to different frequencies!
```

**All automatic. No manual recalculation needed.**

## Common Questions

**Q: Where do I change membrane bounciness?**  
A: Edit `parameters.membrane.damping.value` in session file, OR drag the damping slider (UI writes to ParameterController, which writes to session on save)

**Q: How do I add a new audio source?**  
A: Add to `sources[]` array in session file with unique ID, OR click "Add Source" button (UI creates entry and updates session)

**Q: What happens when I drag a ball?**  
A: UI updates `actuator.position` → mapper recomputes frequency/Q/gain → physics applies new force profile

**Q: Can I edit the session file manually?**  
A: Yes! It's JSON5, supports comments. Just validate it with parser before loading.

## File Format

**JSON5 = JSON + Comments + Trailing Commas**

```json5
{
  // This is a comment
  value: 0.5,  // Trailing comma OK
  list: [1, 2, 3,]  // This too
}
```

Browser support: Needs `json5` library (small, fast)

## Where to Start

1. Read `INTEGRATION-GUIDE.md` (detailed steps)
2. Look at `default-session.json5` (example)
3. Implement Phase 1: Schema Parser
4. Test loading/saving sessions
5. Build from there

---

**Still confused? Read the full INTEGRATION-GUIDE.md**
