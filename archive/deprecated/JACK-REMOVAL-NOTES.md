# JACK/WebSocket Code Removal Notes

**Date**: 2025-10-26
**Reason**: Shifting to pure browser-native audio (no Node.js dependencies for core features)

## Files Archived

- `jack-websocket-bridge.js` - Node.js WebSocket bridge for JACK output

## Code Removed from `brane-with-collectors-websocket.html`

### Functions Removed:
1. **`connectJACK()`** (lines ~427-434) - JACK connection wrapper
2. **`initJackAudio()`** (lines ~565-615) - getUserMedia with jack-system-capture device
3. **`connectWebSocket()`** (lines ~827-851) - WebSocket client for output bridge
4. **`disconnectWebSocket()`** (lines ~853-859) - WebSocket cleanup
5. **`sendCollectorSamples()`** (lines ~931-945) - Send samples to WebSocket

### Variables Removed:
- `websocket` - WebSocket connection instance

### Keyboard Shortcuts Removed:
- 'A' key - JACK audio toggle
- 'O' key - WebSocket output toggle

### Tiles Config Changes:
Removed from `tiles-config.json`:
- `jack-input` tile
- `audio-output` tile (WebSocket)

## What's Kept (Still Working)

✅ **Tab Audio Capture** - `captureTabAudio()` / `stopTabAudio()`
✅ **File Loading** - `initAudioFile()`
✅ **Demo Loops** - `playLoop()`
✅ **Collector Audio Output** - `initAudioOutput()` / `stopAudioOutput()` (browser AudioContext)
✅ **Stereo Channel Splitting** - leftAnalyser / rightAnalyser
✅ **Actuator/Collector System** - Complete physics and sampling

## Migration Path

Old approach:
```
Browser → WebSocket → Node.js bridge → JACK
```

New approach:
```
Browser → Web Audio API → System Audio (direct)
Browser → OSC (optional, Phase 5)
```

## Testing After Removal

- [x] Open HTML in browser - no console errors
- [x] Tab capture still works
- [x] File loading still works
- [x] Demo loops still work
- [x] Collector output to speakers works
- [x] Membrane physics still works

