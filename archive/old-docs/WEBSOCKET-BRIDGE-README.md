# WebSocket Bridge Setup

## Quick Start

### 1. Install Dependencies

```bash
cd ~/Projects/rmix-brane-audio-environment
npm install
```

This installs the `ws` WebSocket library.

### 2. Run the Bridge

```bash
node jack-websocket-bridge.js
```

The bridge will:
- Listen on `ws://localhost:9001`
- Wait for browser connection
- Log received samples every second

### 3. Connect from Browser

1. Open `brane-with-collectors-websocket.html` in Firefox
2. Press `D` for demo mode (membrane starts moving)
3. Press `O` to connect WebSocket output
4. Watch terminal for sample data

## What It Does

```
Browser (collectors) → WebSocket → Node.js Bridge → (future: JACK)
```

**Current Status**: Bridge receives samples and logs them. JACK output not yet implemented.

## Expected Output

When working, you should see:

```
🌊 rmix-BAE WebSocket-to-JACK Bridge
=====================================
WebSocket Port: 9001
Sample Rate: 48000 Hz
Channels: 2

🎧 Waiting for browser connection on ws://localhost:9001

✅ Browser connected
📊 Receiving: 60 samples/sec (~60 fps), 1 collector
   Sample values: [0.023, -0.012, 0.045, ...]
```

## Troubleshooting

**"Cannot find module 'ws'"**
- Run `npm install` in this directory

**"WebSocket connection failed" in browser**
- Make sure bridge is running first
- Check port 9001 isn't already in use: `lsof -i :9001`

**"Samples always zero"**
- Make sure demo mode is active (press `D`)
- Check that collectors exist (Shift+Click to add them)
- Actuators need to be moving the membrane

## Next Steps

To complete JACK output:
1. Use `node-jack` or native JACK client
2. Create JACK output ports (one per collector)
3. Interpolate browser samples (60 fps) to JACK rate (48kHz)
4. Write samples to JACK ring buffer
