# rmix-BAE Current Status

## What Actually Works

### ✅ Membrane Physics (Core)
- 2D wave equation solver
- Runs at 1% GPU (incredibly efficient)
- Supports different boundary conditions
- Damping and wave speed configurable
- **Status**: SOLID - don't touch this

### ✅ Visualization
- Three.js 3D rendering
- WebGL shaders with height-based coloring
- Mouse interaction for striking membrane
- OrbitControls for camera
- **Status**: WORKING - visuals are "spectacularly real"

### ✅ Demo Mode
- Sine wave actuators
- Multiple actuators at different phases
- Visual feedback working
- **Status**: PERFECT for testing without JACK

## What's "Janky"

### 🔨 JACK Input (Actuators)
**Current Implementation**:
- Expects "Zen JACK Bridge" Firefox extension
- Extension creates virtual device `jack-system-capture`
- Uses Web Audio API `getUserMedia()` to access it
- AnalyserNode reads frequency data
- Actuators apply force based on frequency bands

**The Jank**:
1. Depends on external browser extension (is it still working?)
2. Only reads frequency data, not raw audio samples
3. Left/right channel split is frequency-based (not true stereo)
4. No sample-accurate timing

**What Needs Testing**:
- Does Zen JACK Bridge extension still exist?
- Does it show up in `navigator.mediaDevices.enumerateDevices()`?
- Is there a better WebSocket approach?

### ✅ JACK Output (Collectors - IMPLEMENTED!)
**What's Working**:
- ✅ Collector class samples membrane velocity at (x, y) positions
- ✅ Converts velocity → audio samples (-1.0 to +1.0)
- ✅ WebSocket connection to bridge server
- ✅ Sends Float32Array samples every frame (~60 fps)
- ✅ Visual indicators (green wireframe spheres)
- ✅ Keyboard controls (Shift+Click to add, M to clear, O to connect)

**What's Still Needed**:
- ❌ JACK output from bridge (samples received but not sent to JACK yet)
- ❌ Sample rate conversion (60 fps → 48 kHz interpolation)
- ❌ JACK port creation in native bridge

**Files**:
- `brane-with-collectors-websocket.html` - Browser side with collectors
- `jack-websocket-bridge.js` - Node.js WebSocket server (receives samples)
- `package.json` - Dependencies (ws library)

## The Current State

**Input works**: JACK → Zen extension → actuators → membrane ✅
**Physics works**: 2D wave equation, beautiful visualization ✅
**Output partially works**: Membrane → collectors → WebSocket ✅
**Missing**: WebSocket → JACK (bridge receives but doesn't output yet) ❌

## Next Steps (Prioritized)

### 1. Test Current JACK Input ⚠️ NEEDS HAROLD

**Quick Test Script (Firefox Console)**:
```javascript
// Check if Zen JACK Bridge extension creates virtual device
navigator.mediaDevices.enumerateDevices().then(devices => {
    console.table(devices);
    const jack = devices.find(d => d.deviceId === 'jack-system-capture');
    console.log('JACK device found:', jack);
});
```

**Test Sequence**:
1. Open `brane-with-v1actuaters-jack-extensions-working-janky-cone.html` in Firefox
2. Open browser console (F12)
3. Press `D` → Demo mode should work (sine waves)
4. Press `A` → Try JACK connection
5. Report what happens (see JACK-BRIDGE-ANALYSIS.md for details)

**What to Document**:
- Does extension appear in `about:debugging`?
- What error message appears when pressing `A`?
- Do "Audio max level" logs show non-zero values?
- Does membrane move when audio plays?

### 2. Choose Output Strategy
**Option A**: WebSocket Bridge (recommended)
- Native JACK client receives WebSocket data
- Converts to JACK audio output
- More reliable than browser extension

**Option B**: MediaStream Output
- Try to create virtual output device in browser
- Less tested, might be janky too

### 3. Implement Basic Collector
- Single point sampler at center of membrane
- Convert height → audio sample
- Output to JACK via chosen method

### 4. Make It Sound
- Connect JACK input → membrane → JACK output
- Hear the physics working
- Adjust parameters for interesting sounds

## Files That Matter

**Active Development**:
- `brane-with-collectors-websocket.html` - **CURRENT VERSION** with collectors and WebSocket output
- `jack-websocket-bridge.js` - WebSocket bridge server (Node.js)
- `package.json` - Node dependencies
- `WEBSOCKET-BRIDGE-README.md` - How to run the bridge

**Previous Versions**:
- `brane-with-v1actuaters-jack-extensions-working-janky-cone.html` - Previous version without collectors
- `jack-bridge-template.html` - Template for JACK connection
- `membrane-physics-core.js` - Physics (don't break this!)

## Files That Don't Matter Yet

- All the `test-*.html` files - old experiments
- `falstad-oscillator.js` - different project
- `harmonic-oscillator.js` - the rabbit hole we're avoiding

---

**Bottom Line**: We have a beautiful physics simulation that responds to audio but makes no sound. Let's fix that.
