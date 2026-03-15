# RMIX Integration Guide - SIMPLIFIED
## Standard JSON (No Dependencies)

**Decision:** Use standard JSON instead of JSON5. Keep documentation separate.

---

## File Architecture

```
rmix-brane-audio-environment/
├── default-session.json        ← Runtime data (standard JSON)
├── default-session.md          ← Documentation for the session
├── SCHEMA-v1.1.md             ← Schema specification
├── INTEGRATION-GUIDE.md       ← This file
│
├── sessions/                   ← User-saved sessions
│   ├── ambient-guitar.json
│   ├── ambient-guitar.md       ← Session notes (optional)
│   └── drum-texture.json
│
└── src/
    ├── schema/
    │   ├── parser.js           ← Loads & validates JSON (no library needed)
    │   └── validator.js        ← Checks references, ranges
    ├── controllers/
    │   ├── ParameterController.js
    │   └── ActuatorController.js
    └── ui/
        └── UIGenerator.js
```

---

## Why Standard JSON

- **No dependencies** - Uses native `JSON.parse()`
- **No breakage** - Standard browser API
- **No complexity** - Everyone knows JSON
- **Documentation separate** - `.md` files explain sessions

---

## Phase 1: Schema Parser (Week 1)

### Implementation

```javascript
// src/schema/parser.js

export class SchemaParser {
  async loadSession(filepath) {
    const response = await fetch(filepath);
    const text = await response.text();
    const session = JSON.parse(text);  // Native - no library
    
    this.validate(session);
    return session;
  }
  
  validate(session) {
    // Version check
    if (session.version !== "1.1") {
      throw new Error(`Unsupported version: ${session.version}`);
    }
    
    // Validate sourceId references
    const sourceIds = new Set(session.sources.map(s => s.id));
    session.actuators.forEach(act => {
      if (!sourceIds.has(act.sourceId)) {
        throw new Error(`Invalid sourceId: ${act.sourceId}`);
      }
    });
    
    // Validate parameter ranges
    this.validateParameterRanges(session.parameters);
  }
  
  validateParameterRanges(parameters) {
    Object.values(parameters).forEach(group => {
      Object.values(group).forEach(param => {
        if (param.value < param.min || param.value > param.max) {
          throw new Error(
            `Parameter ${param.id} value ${param.value} out of range [${param.min}, ${param.max}]`
          );
        }
      });
    });
  }
  
  saveSession(session, filename) {
    const json = JSON.stringify(session, null, 2);
    
    // Browser download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### Test
```javascript
const parser = new SchemaParser();
const session = await parser.loadSession('./default-session.json');
console.log('Loaded', session.actuators.length, 'actuators');
```

---

[Rest of integration guide continues as before, but with .json instead of .json5]

---

## Complete Integration Example

```javascript
// In your main HTML file

async function init() {
  // 1. Load session (standard JSON)
  const parser = new SchemaParser();
  const session = await parser.loadSession('./default-session.json');
  
  // 2. Create controllers
  const paramCtrl = new ParameterController(session);
  const mapper = new MappingCurveEngine(session);
  const audioEngine = new AudioEngine(session);
  const membrane = new MembranePhysics(session.parameters.membrane);
  
  // 3. Generate UI
  const uiGen = new UIGenerator(session, paramCtrl);
  uiGen.generateToolbar(document.body);
  
  // 4. Create actuators
  const actuatorCtrl = new ActuatorController(
    session, audioEngine, membrane, mapper
  );
  
  // 5. Connect parameters to systems
  paramCtrl.subscribe('membrane_wave_speed', (v) => 
    membrane.setWaveSpeed(v)
  );
  
  // 6. Animation loop
  function animate() {
    const deltaTime = clock.getDelta() * 1000;
    paramCtrl.update(deltaTime);
    actuatorCtrl.update(deltaTime);
    membrane.updatePhysics();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
  
  // 7. Save session (Ctrl+S)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      parser.saveSession(session, 'my-session.json');
    }
  });
}

init();
```

---

## Documentation Pattern

Each session file can have a companion `.md` file:

```
ambient-guitar.json     ← Session data
ambient-guitar.md       ← Human notes: "Created for live performance, 
                          uses guitar input with reverb..."
```

AI assistants can read/write both:
- **Edit .json** - Change parameters
- **Update .md** - Document changes

---

## Key Takeaways

✅ **Standard JSON** - No libraries, no complexity  
✅ **Separate docs** - `.md` files for human/AI notes  
✅ **Native parsing** - `JSON.parse()` works everywhere  
✅ **Simple save** - `JSON.stringify()` + download  
✅ **No breakage** - Standard browser API

---

See FILE-ARCHITECTURE.md for quick reference.  
See SCHEMA-v1.1.md for complete specification.  
See default-session.md for documentation example.
