# Testing the Collectors

## What We Just Built

**Collectors are working!** They sample the membrane and send audio data via WebSocket.

The missing piece is JACK output - the bridge receives samples but doesn't send them to JACK yet.

## Quick Test (5 minutes)

### Terminal 1: Start WebSocket Bridge

```bash
cd ~/Projects/rmix-brane-audio-environment
npm install  # First time only
node jack-websocket-bridge.js
```

**Expected output**:
```
🌊 rmix-BAE WebSocket-to-JACK Bridge
=====================================
WebSocket Port: 9001
Sample Rate: 48000 Hz
Channels: 2

🎧 Waiting for browser connection on ws://localhost:9001
```

### Browser: Test Collectors

1. Open `brane-with-collectors-websocket.html` in Firefox
2. Watch console (F12) for startup messages
3. Press `D` → Demo mode (membrane starts wobbling)
4. Press `O` → Connect WebSocket output

**Expected**:
- Browser console: "WebSocket connected!"
- Terminal shows: "✅ Browser connected"
- Terminal shows: "📊 Receiving: X samples/sec..."

### What You'll See

**In Terminal**:
```
✅ Browser connected
📊 Receiving: 60 samples/sec (~60.0 fps), 1 collector
   Sample values: [0.023, -0.012, 0.045, ...]
```

The sample values should change as the membrane moves. If they're always zero:
- Make sure demo mode is on (press `D`)
- Check that actuators are visible (yellow sphere at center)
- Green wireframe sphere = collector

### Playing Around

**Add more collectors**:
- `Shift+Click` on membrane → Adds green wireframe collector
- Collectors sample at that (x, y) position
- Terminal will show all collector values

**Add more actuators**:
- Regular `Click` → Adds solid sphere actuator
- In demo mode, these drive the membrane with sine waves

**Clear things**:
- `C` → Clear actuators
- `M` → Clear collectors (careful - clears ALL)
- `R` → Reset membrane (zero out waves)

### Troubleshooting

**"Cannot find module 'ws'"**
```bash
npm install
```

**"WebSocket connection failed"**
- Make sure bridge is running first
- Check nothing else using port 9001: `lsof -i :9001`

**"Samples always zero"**
- Press `D` for demo mode
- Actuators need to be moving
- Collector needs to exist (check collector count in UI)

## What's Next

Once this works, we'll add:
1. JACK output ports in the bridge
2. Sample rate conversion (60 fps → 48 kHz)
3. You'll be able to hear the membrane!

For now, seeing sample values change = SUCCESS ✅
