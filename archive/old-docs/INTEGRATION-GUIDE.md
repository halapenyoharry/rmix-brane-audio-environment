# RMIX Integration Guide
## How the Schema Connects to Your UI

**Last Updated:** October 7, 2025  
**Schema Version:** 1.1

---

## File Architecture Overview

```
rmix-brane-audio-environment/
├── SCHEMA-v1.1.md              ← Schema specification (this is documentation)
├── INTEGRATION-GUIDE.md        ← This file
├── default-session.json5       ← Default session (loads on startup)
├── sessions/                   ← User-saved sessions
│   ├── ambient-guitar.json5
│   ├── drum-texture.json5
│   └── ...
│
├── src/                        ← Your implementation
│   ├── schema/
│   │   ├── parser.js           ← Loads & validates JSON5
│   │   ├── validator.js        ← Checks references, ranges
│   │   └── mapper.js           ← Computes derived properties
│   │
│   ├── controllers/
│   │   ├── ParameterController.js     ← Central parameter management
│   │   ├── ActuatorController.js      ← Actuator lifecycle
│   │   ├── SourceController.js        ← Audio source management
│   │   └── ModulationController.js    ← LFOs, envelopes, etc.
│   │
│   ├── ui/
│   │   ├── UIGenerator.js      ← Reads schema → builds controls
│   │   ├── Toolbar.js          ← Bottom toolbar from schema
│   │   └── ActuatorEditor.js   ← Gesture controls for balls
│   │
│   ├── audio/
│   │   ├── AudioEngine.js      ← FFT analysis, routing
│   │   └── SourceManager.js    ← JACK, files, mic, etc.
│   │
│   ├── physics/
│   │   ├── MembranePhysics.js  ← Existing (adapt to schema)
│   │   └── ForceApplicator.js  ← Couples audio → membrane
│   │
│   └── visual/
│       ├── Renderer.js         ← Three.js rendering
│       └── ColorMapper.js      ← D3 color scales
│
└── rmix-integrated.html        ← Main application file
```

---

## Where Files Live & How They Connect

### 1. Schema Documentation (SCHEMA-v1.1.md)
**Location:** `/rmix-brane-audio-environment/SCHEMA-v1.1.md`  
**Purpose:** Human-readable specification  
**Used By:** Developers, AI assistants reading documentation  
**NOT loaded by application** - this is just the spec

### 2. Session Files (.json5)
**Location:** 
- Default: `/rmix-brane-audio-environment/default-session.json5`
- User sessions: `/rmix-brane-audio-environment/sessions/*.json5`

**Purpose:** Active runtime data (the actual schema instances)  
**Format:** JSON5 (allows comments)  
**Loaded By:** Application on startup or when user opens a session  
**Saved By:** Application when user saves session

**This is what the UI reads and writes.**

### 3. Parser/Loader Code
**Location:** `/rmix-brane-audio-environment/src/schema/parser.js`  
**Purpose:** Reads JSON5 → JavaScript objects  
**Used By:** Application startup, File → Open, File → Save

---

## Data Flow: Schema → UI → Audio → Membrane

```
┌──────────────────────┐
│ default-session.json5│  ← User edits OR app saves
└──────────┬───────────┘
           │
           ↓ Load
┌──────────────────────┐
│   parser.js          │  ← Parses JSON5
│   validator.js       │  ← Validates references
└──────────┬───────────┘
           │
           ↓ Creates
┌──────────────────────────────────────────────┐
│ ParameterController                          │
│ - Holds ALL parameter states                 │
│ - Manages smoothing                          │
│ - Notifies listeners on changes              │
│                                               │
│ Central hub: Everything reads/writes here    │
└───┬────────────────┬──────────────────┬──────┘
    │                │                  │
    ↓                ↓                  ↓
┌─────────┐   ┌──────────────┐   ┌──────────────┐
│ UI      │   │ Audio Engine │   │ Physics      │
│ Generator│   │              │   │ Engine       │
└─────────┘   └──────────────┘   └──────────────┘
    │                │                  │
    └────────────────┴──────────────────┘
                     │
                     ↓
            ┌────────────────┐
            │ Visual Renderer│
            └────────────────┘
```

---

## Integration Steps

### Phase 1: Schema Parser (Week 1)

**Goal:** Load session files into memory

**Files to Create:**
1. `src/schema/parser.js`
2. `src/schema/validator.js`  
3. `default-session.json5`

**Implementation:**

```javascript
// src/schema/parser.js
import JSON5 from 'json5';

export class SchemaParser {
  async loadSession(filepath) {
    const response = await fetch(filepath);
    const text = await response.text();
    const session = JSON5.parse(text);
    
    // Validate
    this.validate(session);
    
    return session;
  }
  
  validate(session) {
    // Check version compatibility
    if (session.version !== "1.1") {
      throw new Error(`Unsupported version: ${session.version}`);
    }
    
    // Validate all sourceId references
    const sourceIds = new Set(session.sources.map(s => s.id));
    session.actuators.forEach(act => {
      if (!sourceIds.has(act.sourceId)) {
        throw new Error(`Invalid sourceId: ${act.sourceId}`);
      }
    });
    
    // Validate parameter ranges
    // ... more validation
  }
  
  saveSession(session, filepath) {
    const json5 = JSON5.stringify(session, null, 2);
    // Save to file or download
  }
}
```

**Test:**
```javascript
const parser = new SchemaParser();
const session = await parser.loadSession('./default-session.json5');
console.log('Loaded', session.actuators.length, 'actuators');
```

---

### Phase 2: Parameter Controller (Week 2)

**Goal:** Central state management for all parameters

**Files to Create:**
1. `src/controllers/ParameterController.js`

**Implementation:**

```javascript
// src/controllers/ParameterController.js

export class ParameterController {
  constructor(session) {
    this.session = session;
    this.parameters = new Map(); // parameterId → current value
    this.listeners = new Map();  // parameterId → [callback functions]
    this.smoothers = new Map();  // parameterId → SmootherInstance
    
    this.initializeParameters();
    this.initializeSmoothers();
  }
  
  initializeParameters() {
    // Load all global parameters
    Object.values(this.session.parameters).forEach(group => {
      Object.values(group).forEach(param => {
        this.parameters.set(param.id, param.value);
      });
    });
  }
  
  initializeSmoothers() {
    Object.values(this.session.parameters).forEach(group => {
      Object.values(group).forEach(param => {
        if (param.smoothing.enabled) {
          this.smoothers.set(param.id, new ParameterSmoother(param.smoothing));
        }
      });
    });
  }
  
  // Get current value (smoothed if applicable)
  getValue(parameterId) {
    return this.parameters.get(parameterId);
  }
  
  // Set new value (will be smoothed if enabled)
  setValue(parameterId, newValue) {
    const param = this.findParameter(parameterId);
    
    // Clamp to range
    newValue = Math.max(param.min, Math.min(param.max, newValue));
    
    // Apply smoothing
    const smoother = this.smoothers.get(parameterId);
    if (smoother) {
      smoother.setTarget(newValue);
    } else {
      this.parameters.set(parameterId, newValue);
      this.notifyListeners(parameterId, newValue);
    }
  }
  
  // Update smoothers (call every frame)
  update(deltaTime) {
    this.smoothers.forEach((smoother, parameterId) => {
      const smoothedValue = smoother.update(deltaTime);
      this.parameters.set(parameterId, smoothedValue);
      this.notifyListeners(parameterId, smoothedValue);
    });
  }
  
  // Subscribe to parameter changes
  subscribe(parameterId, callback) {
    if (!this.listeners.has(parameterId)) {
      this.listeners.set(parameterId, []);
    }
    this.listeners.get(parameterId).push(callback);
  }
  
  notifyListeners(parameterId, value) {
    const callbacks = this.listeners.get(parameterId) || [];
    callbacks.forEach(cb => cb(value));
  }
  
  findParameter(parameterId) {
    // Search through session.parameters to find by ID
    for (const group of Object.values(this.session.parameters)) {
      for (const param of Object.values(group)) {
        if (param.id === parameterId) return param;
      }
    }
    throw new Error(`Parameter not found: ${parameterId}`);
  }
}

class ParameterSmoother {
  constructor(config) {
    this.type = config.type;
    this.timeConstant = config.timeConstant;
    this.current = 0;
    this.target = 0;
  }
  
  setTarget(value) {
    this.target = value;
  }
  
  update(deltaTime) {
    if (this.type === 'exponential') {
      const alpha = 1 - Math.exp(-deltaTime / this.timeConstant);
      this.current += (this.target - this.current) * alpha;
    } else if (this.type === 'linear') {
      const step = (deltaTime / this.timeConstant);
      const diff = this.target - this.current;
      this.current += Math.sign(diff) * Math.min(Math.abs(diff), step);
    } else {
      this.current = this.target;
    }
    return this.current;
  }
}
```

**Test:**
```javascript
const paramCtrl = new ParameterController(session);

// Subscribe to wave speed changes
paramCtrl.subscribe('membrane_wave_speed', (value) => {
  console.log('Wave speed changed:', value);
  membrane.setWaveSpeed(value);
});

// User drags slider
paramCtrl.setValue('membrane_wave_speed', 0.5);

// Every frame
function animate() {
  paramCtrl.update(deltaTime);
  requestAnimationFrame(animate);
}
```

---

### Phase 3: Mapping Curve Engine (Week 2-3)

**Goal:** Compute actuator audio properties from spatial properties

**Files to Create:**
1. `src/schema/mapper.js`

**Implementation:**

```javascript
// src/schema/mapper.js

export class MappingCurveEngine {
  constructor(session) {
    this.curves = session.mappingCurves;
  }
  
  // Compute frequency from size
  sizeToFrequency(size_mm) {
    const curve = this.curves.actuator_size_to_frequency.curve;
    
    if (curve.type === 'power') {
      return curve.freq_max * Math.pow(
        size_mm / curve.size_max_mm,
        curve.exponent
      );
    }
    
    // Clamp to range
    return Math.max(curve.freq_min_hz, 
           Math.min(curve.freq_max_hz, freq));
  }
  
  // Compute Q factor from opacity
  opacityToQ(opacity) {
    const curve = this.curves.actuator_transparency_to_q.curve;
    
    return curve.q_min + 
           (1 - opacity) * (curve.q_max - curve.q_min);
  }
  
  // Compute gain from z-height
  zToGain(z) {
    const curve = this.curves.actuator_z_to_gain.curve;
    
    return curve.base_gain / (1 + Math.pow(z / curve.scale, 2));
  }
  
  // Compute Gaussian sigma from size
  sizeToSigma(size_mm) {
    const curve = this.curves.actuator_gaussian_spread.curve;
    
    return size_mm * curve.spread_factor;
  }
  
  // Compute color from frequency
  frequencyToHue(freq_hz) {
    const curve = this.curves.frequency_to_color.curve;
    
    const logFreq = Math.log10(freq_hz);
    const logMax = Math.log10(curve.freq_max_hz);
    
    return 240 - (logFreq / logMax) * 240;
  }
  
  // Compute ALL properties for an actuator
  computeActuatorProperties(actuator) {
    const size = actuator.size.radius_mm;
    const opacity = actuator.appearance.opacity;
    const z = actuator.position.z;
    
    const freq_center_hz = this.sizeToFrequency(size);
    const q_factor = this.opacityToQ(opacity);
    const gain = this.zToGain(z);
    const gaussian_sigma = this.sizeToSigma(size);
    const color_hue = this.frequencyToHue(freq_center_hz);
    
    return {
      frequency_center_hz: freq_center_hz,
      q_factor: q_factor,
      gain: gain,
      gaussian_sigma: gaussian_sigma,
      color_hue: color_hue,
      
      // Compute FFT bin range
      frequency_bandwidth_hz: freq_center_hz / q_factor,
      fft_bin_range: this.computeFFTBinRange(freq_center_hz, q_factor)
    };
  }
  
  computeFFTBinRange(centerFreq, qFactor) {
    const bandwidth = centerFreq / qFactor;
    const minFreq = centerFreq - bandwidth / 2;
    const maxFreq = centerFreq + bandwidth / 2;
    
    // Assuming FFT size 2048, sample rate 48kHz
    const fftSize = 2048;
    const sampleRate = 48000;
    const binWidth = sampleRate / fftSize;
    
    const startBin = Math.floor(minFreq / binWidth);
    const endBin = Math.ceil(maxFreq / binWidth);
    
    return [startBin, endBin];
  }
}
```

**Test:**
```javascript
const mapper = new MappingCurveEngine(session);

const actuator = session.actuators[0];
const computed = mapper.computeActuatorProperties(actuator);

console.log('Ball properties:', computed);
// { frequency_center_hz: 1000, q_factor: 2.5, gain: 8.0, ... }
```

---

### Phase 4: UI Generator (Week 3-4)

**Goal:** Build UI controls from schema

**Files to Create:**
1. `src/ui/UIGenerator.js`
2. `src/ui/Toolbar.js`

**Implementation:**

```javascript
// src/ui/UIGenerator.js

export class UIGenerator {
  constructor(session, parameterController) {
    this.session = session;
    this.paramCtrl = parameterController;
  }
  
  generateToolbar(containerElement) {
    const toolbar = document.createElement('div');
    toolbar.id = 'controls-container';
    
    // For each parameter in session.parameters
    Object.values(this.session.parameters).forEach(group => {
      Object.values(group).forEach(param => {
        const tile = this.createControlTile(param);
        toolbar.appendChild(tile);
      });
    });
    
    containerElement.appendChild(toolbar);
  }
  
  createControlTile(param) {
    const tile = document.createElement('div');
    tile.className = 'control-tile';
    tile.style.width = param.ui.width + 'px';
    tile.style.height = param.ui.height + 'px';
    
    if (param.ui.type === 'slider') {
      const slider = this.createSlider(param);
      tile.appendChild(slider);
    } else if (param.ui.type === 'toggle') {
      const toggle = this.createToggle(param);
      tile.appendChild(toggle);
    } else if (param.ui.type === 'canvas-drag') {
      const canvas = this.createCanvasDrag(param);
      tile.appendChild(canvas);
    }
    // ... other UI types
    
    return tile;
  }
  
  createSlider(param) {
    const container = document.createElement('div');
    
    const label = document.createElement('label');
    label.textContent = param.displayName;
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = param.min;
    slider.max = param.max;
    slider.step = param.step || 0.01;
    slider.value = param.value;
    
    // Connect to ParameterController
    slider.addEventListener('input', (e) => {
      this.paramCtrl.setValue(param.id, parseFloat(e.target.value));
    });
    
    // Listen for parameter changes (e.g., from modulation)
    this.paramCtrl.subscribe(param.id, (value) => {
      slider.value = value;
    });
    
    container.appendChild(label);
    container.appendChild(slider);
    
    return container;
  }
  
  // Similar for other UI types...
}
```

**Usage in main app:**
```javascript
// In rmix-integrated.html

const parser = new SchemaParser();
const session = await parser.loadSession('./default-session.json5');

const paramCtrl = new ParameterController(session);
const uiGen = new UIGenerator(session, paramCtrl);

// Generate UI from schema
uiGen.generateToolbar(document.getElementById('workspace'));

// Connect parameters to existing systems
paramCtrl.subscribe('membrane_wave_speed', (value) => {
  membrane.setWaveSpeed(value);
});

paramCtrl.subscribe('membrane_damping', (value) => {
  membrane.setDamping(value);
});
```

---

### Phase 5: Actuator Integration (Week 4-5)

**Goal:** Connect actuators to membrane

**Files to Create:**
1. `src/controllers/ActuatorController.js`
2. `src/physics/ForceApplicator.js`

**Implementation:**

```javascript
// src/controllers/ActuatorController.js

export class ActuatorController {
  constructor(session, audioEngine, membrane, mapper) {
    this.session = session;
    this.audioEngine = audioEngine;
    this.membrane = membrane;
    this.mapper = mapper;
    
    this.actuators = [];
    
    // Load all actuators from session
    session.actuators.forEach(actuatorData => {
      this.createActuator(actuatorData);
    });
  }
  
  createActuator(actuatorData) {
    const actuator = {
      data: actuatorData,
      computed: this.mapper.computeActuatorProperties(actuatorData),
      visual: this.createVisual(actuatorData)
    };
    
    this.actuators.push(actuator);
    return actuator;
  }
  
  update(deltaTime) {
    this.actuators.forEach(actuator => {
      // Recompute properties if position/size changed
      actuator.computed = this.mapper.computeActuatorProperties(actuator.data);
      
      // Get audio energy for this actuator's frequency range
      const source = this.audioEngine.getSource(actuator.data.sourceId);
      const fftData = source.getFFTData();
      const [startBin, endBin] = actuator.computed.fft_bin_range;
      
      // Sum energy in frequency range
      let energy = 0;
      for (let i = startBin; i <= endBin; i++) {
        energy += fftData[i];
      }
      energy /= (endBin - startBin + 1);
      
      // Apply to membrane
      const force = energy * actuator.computed.gain;
      this.membrane.applyForce(
        actuator.data.position.x,
        actuator.data.position.y,
        force,
        actuator.computed.gaussian_sigma
      );
      
      // Update visual
      this.updateVisual(actuator, energy);
    });
  }
  
  createVisual(actuatorData) {
    const geometry = new THREE.SphereGeometry(
      actuatorData.size.radius_mm / 10,
      16, 16
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: actuatorData.appearance.opacity
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      actuatorData.position.x,
      actuatorData.position.z,
      actuatorData.position.y
    );
    
    return mesh;
  }
  
  updateVisual(actuator, energy) {
    // Update color based on computed frequency
    const hue = actuator.computed.color_hue;
    actuator.visual.material.color.setHSL(hue / 360, 1, 0.5);
    
    // Pulse size based on audio energy
    const scale = 1 + energy * 0.5;
    actuator.visual.scale.setScalar(scale);
  }
  
  // Gesture handling
  onDrag(actuator, deltaX, deltaY) {
    // Horizontal = size
    actuator.data.size.radius_mm += deltaX * 0.1;
    
    // Vertical = z-height
    actuator.data.position.z += deltaY * 0.1;
    
    // Recompute properties
    actuator.computed = this.mapper.computeActuatorProperties(actuator.data);
  }
  
  onScroll(actuator, delta) {
    // Scroll = opacity
    actuator.data.appearance.opacity += delta * 0.01;
    actuator.data.appearance.opacity = Math.max(0.1, Math.min(1.0, 
      actuator.data.appearance.opacity));
    
    // Recompute properties
    actuator.computed = this.mapper.computeActuatorProperties(actuator.data);
  }
}
```

---

## Complete Integration Example

```javascript
// rmix-integrated.html - main setup

async function init() {
  // 1. Load session
  const parser = new SchemaParser();
  const session = await parser.loadSession('./default-session.json5');
  
  // 2. Create controllers
  const paramCtrl = new ParameterController(session);
  const mapper = new MappingCurveEngine(session);
  const audioEngine = new AudioEngine(session);
  const membrane = new MembranePhysics(session.parameters.membrane);
  
  // 3. Generate UI
  const uiGen = new UIGenerator(session, paramCtrl);
  uiGen.generateToolbar(document.body);
  
  // 4. Create actuators
  const actuatorCtrl = new ActuatorController(session, audioEngine, membrane, mapper);
  
  // 5. Connect parameters to systems
  paramCtrl.subscribe('membrane_wave_speed', (v) => membrane.setWaveSpeed(v));
  paramCtrl.subscribe('membrane_damping', (v) => membrane.setDamping(v));
  // ... etc for all parameters
  
  // 6. Animation loop
  function animate() {
    const deltaTime = clock.getDelta() * 1000; // ms
    
    // Update smoothing
    paramCtrl.update(deltaTime);
    
    // Update actuators (reads audio, applies to membrane)
    actuatorCtrl.update(deltaTime);
    
    // Update physics
    membrane.updatePhysics();
    
    // Render
    renderer.render(scene, camera);
    
    requestAnimationFrame(animate);
  }
  animate();
  
  // 7. Save session
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      parser.saveSession(session, 'my-session.json5');
    }
  });
}

init();
```

---

## File Locations Summary

| What | Where | Used By |
|------|-------|---------|
| **Schema Spec** | `SCHEMA-v1.1.md` | Developers, AI (documentation) |
| **Session Files** | `default-session.json5`, `sessions/*.json5` | Application (runtime data) |
| **Parser** | `src/schema/parser.js` | Application startup, File I/O |
| **Parameter Controller** | `src/controllers/ParameterController.js` | Everything (central hub) |
| **Mapping Engine** | `src/schema/mapper.js` | Actuator updates |
| **UI Generator** | `src/ui/UIGenerator.js` | Application startup |
| **Actuator Controller** | `src/controllers/ActuatorController.js` | Animation loop |

---

## Key Concepts

### The UI READS the session file
- On startup: loads `default-session.json5`
- On "File → Open": loads user's `.json5` file
- Uses `SchemaParser` to convert JSON5 → JavaScript objects

### The UI WRITES the session file
- On "File → Save": writes current state to `.json5`
- On "Export": packages session + assets

### ParameterController is the Hub
- UI controls write to it
- Physics reads from it
- Audio reads from it
- Everything stays in sync

### Computed Properties Never Saved
- Actuator's `frequency_center_hz` is NOT in the file
- Only `size`, `position`, `opacity` are saved
- MappingCurveEngine recomputes on load

---

## Next Steps

1. **Week 1:** Implement SchemaParser + create `default-session.json5`
2. **Week 2:** Implement ParameterController + MappingCurveEngine
3. **Week 3:** Implement UIGenerator
4. **Week 4:** Implement ActuatorController
5. **Week 5:** Testing, refinement, performance tuning

**After Phase 1 complete:** You'll be able to load/save sessions  
**After Phase 2 complete:** Parameters will work with smoothing  
**After Phase 3 complete:** UI will auto-generate from schema  
**After Phase 4 complete:** Balls will affect membrane  
**After Phase 5 complete:** Full system integration

---

**Questions? Check SCHEMA-v1.1.md for complete specification.**
