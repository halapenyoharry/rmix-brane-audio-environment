# rmix-BAE Quick Start

## What Works RIGHT NOW

### Browser Membrane Simulation
**File**: `brane-with-collectors-websocket.html`

**Controls**:
- **F** - Load audio file (MP3, WAV, etc.)
- **D** - Demo mode (sine waves)
- **A** - JACK input (requires Zen extension)
- **O** - WebSocket output (requires bridge running)
- **Click** - Add actuator (solid sphere)
- **Shift+Click** - Add collector (wireframe sphere)
- **R** - Reset membrane
- **C** / **M** - Clear actuators / collectors

### WebSocket Bridge (Testing)
**File**: `jack-websocket-bridge.js`

```bash
cd ~/Projects/rmix-brane-audio-environment
npm install  # First time only
node jack-websocket-bridge.js
```

Opens `ws://localhost:9001` and logs received samples.

## Quick Test (2 minutes)

**Terminal**:
```bash
node jack-websocket-bridge.js
```

**Browser** (Firefox):
1. Open `brane-with-collectors-websocket.html`
2. Press **F** → Load an audio file
3. Press **O** → Connect WebSocket
4. Watch terminal show sample values

**Success = Terminal logs changing sample values** ✅

## Audio File Test

1. Press **F**
2. Select any audio file (MP3, WAV)
3. File plays through actuators
4. Membrane responds to audio
5. You hear the file AND see membrane move
6. Collectors sample the membrane
7. WebSocket sends samples to bridge

## What's Missing

**JACK output**: Bridge receives samples but doesn't send to JACK yet.

Next step: Implement JACK output ports in bridge.

## Files Overview

- **brane-with-collectors-websocket.html** - Main working version
- **jack-websocket-bridge.js** - WebSocket server (WIP)
- **TESTING-GUIDE.md** - Detailed testing steps
- **FUTURE-ENHANCEMENTS.md** - Planned features
- **PROGRESS-SUMMARY.md** - What we built today

## Git Status

All changes committed. Safe to experiment.

```bash
git log --oneline
```

Latest commits:
- Audio file playback support
- Collector class implementation
- WebSocket bridge foundation
