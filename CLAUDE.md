# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**rmix-BAE (Brane Audio Environment)** is a web-based audio processor using actual 2D membrane physics for sound transformation. Not a traditional reverb plugin - this physically models the actuator → membrane → microphone chain using wave equations.

**Philosophy**: Reduce abstraction layers. Simulate actual physics of sound propagation through a 2D membrane, then sample it like you'd mic a real acoustic space.

## Core Architecture

### Physics Engine
- **membrane-physics-core.js** - 2D wave equation solver (1% GPU usage, highly optimized)
- DO NOT modify this unless absolutely necessary - it's rock solid
- Uses damped wave equation with configurable boundaries

### Main Application Files

**Primary Version**: `brane-with-collectors-websocket.html`
- Latest working version with full tile UI system
- Uses D3.js for tile rendering and drag behavior
- Configuration-driven UI via `tiles-config.json`

**Configuration**: `tiles-config.json`
- Defines all control tiles (toggles, buttons, sliders)
- Tile positioning, colors, icons, and actions
- Actuator/collector properties and visual gradients

### Audio Flow

```
Input Sources → Actuators → Membrane Physics → Collectors → Output
```

**Input Sources** (all implemented):
- Demo mode (sine waves) - `D` key
- Audio files (MP3/WAV) - `F` key, uses Web Audio API
- JACK input - `A` key, requires Zen JACK Bridge extension
- Tab audio capture - Browser tab audio via getDisplayMedia
- Demo loops - Cycling through bass.wav, drums.wav, kick.wav

**Actuators**: Drive membrane like speaker cones
- Click to add at cursor position
- Apply force based on audio input
- Support stereo (left/right channels map to different actuators)

**Collectors**: Virtual microphones that sample membrane
- Shift+Click to add
- Sample membrane velocity at specific (x,y) positions
- Convert to audio samples (-1.0 to +1.0 range)
- Send via WebSocket to bridge

**Output**:
- WebSocket bridge (`jack-websocket-bridge.js`) receives samples
- JACK output port creation is TODO

## Tile Control System

The UI uses a **data-driven tile system** with D3.js data binding:

**Design Pattern**: Atomic controls - one function per tile
- Each tile is toggle, button, slider, or mini-membrane
- No composite controls or grouped buttons
- Free-floating drag-and-drop positioning
- Positions saved in `tilePositions` object

**Tile Types**:
- `toggle` - Circular button with icon, glows when active (e.g., audio sources)
- `button` - One-shot action button (e.g., load file, clear all)
- `slider` - Horizontal slider for continuous parameters (wave speed, damping, gain)
- `mini-membrane` - Mini visualization showing actuators/collectors as dots

**Creating Tiles**:
1. Add tile definition to `tiles-config.json`
2. Implement action handler in appropriate function (e.g., `captureTab()`, `playLoop()`)
3. D3 binding handles rendering automatically via `createTileContent()`
4. Drag behavior uses D3 drag with hard screen boundaries

## Running the Application

### Browser Version (Primary)
```bash
# No build step - open directly in browser
firefox brane-with-collectors-websocket.html
# or any modern browser (Chrome/Edge work, Safari needs testing)
```

**Keyboard Controls**:
- `D` - Demo mode (sine waves)
- `F` - Load audio file
- `A` - Connect to JACK (requires extension)
- `O` - Toggle WebSocket output
- `R` - Reset membrane
- `C` - Clear actuators
- `M` - Clear collectors
- Click - Add actuator
- Shift+Click - Add collector

### WebSocket Bridge (Node.js)

```bash
npm install  # First time only
npm run bridge
# or
node jack-websocket-bridge.js
```

Opens `ws://localhost:9001` for collector samples. Currently receives samples but does not output to JACK yet.

## Key Technical Details

### Audio Input Handling

**Stereo Channel Splitting**:
- All audio sources use separate `leftAnalyser` and `rightAnalyser`
- ChannelSplitter routes stereo to individual AnalyserNodes
- FFT size: 256, smoothing: 0.3
- Left/right audio data stored in separate Uint8Array buffers

**JACK Input**:
- Expects Firefox with Zen JACK Bridge extension
- Creates virtual device ID: `jack-system-capture`
- Uses `getUserMedia()` with specific deviceId
- Known to be "janky" - see STATUS.md for details

### Collector Sampling

**Physics → Audio Conversion**:
```javascript
// Sample membrane velocity at (x, y)
const velocity = membrane.getVelocity(gridX, gridY);
// Convert to audio sample range
const sample = Math.max(-1.0, Math.min(1.0, velocity * scaleFactor));
```

**WebSocket Protocol**:
- Sends Float32Array of samples every frame (~60fps)
- Format: Binary ArrayBuffer containing float samples
- Channel count depends on number of collectors
- Needs interpolation for proper audio sample rate (48kHz)

### Visualization

**Spectrum Visualizers on Tiles**:
- Active audio tiles show real-time spectrum
- Canvas overlay on toggle buttons
- Draws compact frequency bars using analyser data
- Updates in main animation loop via `updateAudioVisualizers()`

**Membrane Rendering**:
- Three.js with custom vertex/fragment shaders
- Height-based color mapping (spectral gradient)
- Actuators: solid spheres with colored glow
- Collectors: wireframe spheres (green/blue)

## Common Development Tasks

### Adding a New Tile

1. Edit `tiles-config.json`:
```json
{
  "id": "my-control",
  "type": "toggle",  // or "button", "slider", "mini-membrane"
  "width": 60,
  "height": 60,
  "action": "myAction",  // function name to call
  "color": "#ff00ff",
  "icon": "🎛"
}
```

2. Implement action handler in HTML file:
```javascript
function myAction() {
    // Your implementation
    console.log('Action triggered');
}
```

3. Reload - D3 binding automatically renders the tile

### Modifying Physics Parameters

**Configurable via tiles**:
- `waveSpeed` - Wave propagation speed (0.05 - 0.3)
- `damping` - Energy dissipation (0.001 - 0.05)
- `actuatorGain` - Input sensitivity (0.5 - 5.0)

**Hardcoded in membrane-physics-core.js**:
- Grid resolution
- Boundary conditions (fixed/free/infinite)
- Timestep calculations

### Audio Source Lifecycle

**Important**: Each audio element source can only be connected to AudioContext once. Track with flags:
- `audioElementSource` - for file playback
- `loopAudioSource` - for demo loops
- Creating source twice throws DOMException

**Pattern**:
```javascript
if (!audioElementSource) {
    audioElementSource = audioContext.createMediaElementSource(audioElement);
    // Connect to splitter/analysers
}
// Then load new file
audioElement.src = url;
```

## Known Issues & Gotchas

### JACK Input
- Zen JACK Bridge extension may be outdated/broken
- Only works in Firefox
- Frequency-based sampling, not raw audio
- No sample-accurate timing

### WebSocket Output
- Samples sent at 60fps, not audio rate (48kHz)
- Needs interpolation/resampling in bridge
- No error handling for disconnection
- Bridge doesn't create JACK output ports yet

### Drag Behavior
- Tiles use D3 drag with calculated offsets
- Boundaries are hard-limited to window size
- Position tracking in `tilePositions` object
- Dragging requires proper offset calculation (startX/startY pattern)

### Browser Compatibility
- Tab audio capture requires Chrome/Edge (not Safari)
- JACK bridge only works in Firefox
- MediaDevices API needs HTTPS or localhost

## File Organization

**Active Development**:
- `brane-with-collectors-websocket.html` - Main application
- `tiles-config.json` - UI configuration
- `jack-websocket-bridge.js` - WebSocket bridge server
- `package.json` - Node dependencies

**Physics Core** (don't modify):
- `membrane-physics-core.js` - Wave equation solver

**Supporting Libraries**:
- `three.min.js` - 3D rendering (local copy)
- `OrbitControls.js` - Camera controls (local copy)
- D3.js - Loaded from CDN in HTML

**Demo Content**:
- `demo-loops/` - bass.wav, drums.wav, kick.wav, snare.wav

**Documentation**:
- `README.md` - Project overview
- `QUICKSTART.md` - Quick testing guide
- `STATUS.md` - Current state and next steps
- `FUTURE-ENHANCEMENTS.md` - Planned features
- `dev-plan.md` - Original development phases

**Archived/Reference**:
- `brane-with-v1actuaters-jack-extensions-working-janky-cone.html` - Previous version
- `test-*.html` - Old experiments
- Various `*.js` modules - Not currently integrated

## Design Principles

1. **Don't break the physics** - membrane-physics-core.js is optimized and stable
2. **One control per tile** - No composite UI elements
3. **Configuration over code** - Use tiles-config.json for UI changes
4. **Visual feedback** - Show what's active (glows, spectrum, waveforms)
5. **No external dependencies in HTML** - Inline everything except Three.js and D3.js
6. **Free-floating UI** - Tiles can be positioned anywhere on screen
7. **Reduce abstraction** - Simulate real physics, not DSP tricks

## Next Steps Priority

Per STATUS.md:
1. Complete JACK output in WebSocket bridge
2. Implement sample rate conversion (60fps → 48kHz)
3. Test end-to-end audio flow
4. Consider WaveSurfer.js for file playback controls
5. Save/load preset system for tile positions and configurations
