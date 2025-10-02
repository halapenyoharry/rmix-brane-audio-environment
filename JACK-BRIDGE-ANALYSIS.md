# JACK Bridge Architecture Analysis

## How It Currently Works

### 1. Extension Detection (Lines 340-346)
```javascript
const devices = await navigator.mediaDevices.enumerateDevices();
const jackDevice = devices.find(d => d.deviceId === 'jack-system-capture');
```

**What it expects**: A browser extension called "Zen JACK Bridge" that creates a virtual audio device with deviceId `'jack-system-capture'`

**Critical Questions**:
- Does this extension still exist?
- Is it installed and running?
- Does it appear in Firefox's `about:debugging`?

### 2. Audio Stream Acquisition (Lines 349-351)
```javascript
audioStream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: 'jack-system-capture' }
});
```

**What happens**: Browser requests access to virtual JACK device as if it were a microphone

### 3. Frequency Analysis (Lines 354-363)
```javascript
audioAnalyser = audioContext.createAnalyser();
audioAnalyser.fftSize = 256;
audioAnalyser.smoothingTimeConstant = 0.8;
audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
```

**The Limitation**: Uses AnalyserNode which only provides frequency domain data, not raw audio samples
- FFT size: 256 (128 frequency bins)
- Smoothing: 0.8 (heavy averaging across frames)
- Output: 0-255 integer values representing frequency magnitude

### 4. Channel Split Logic (Lines 273-294)

**Left Channel** (lines 274-279):
- Uses lower 1/4 of frequency spectrum
- Simulates "left channel" by frequency range, not true stereo

**Right Channel** (lines 280-286):
- Uses upper 1/4 of frequency spectrum
- Also simulated, not actual left/right channel separation

**Mono** (lines 288-293):
- Uses full spectrum
- Averages all frequency bins

**The Jank**: This isn't real stereo - it's frequency-band splitting disguised as stereo channels

### 5. Force Application (Line 301)
```javascript
velocities[this.gridX][this.gridY] += force * 0.1;
```

Frequency magnitude → scaled force → applied to membrane velocity grid

## What's Missing: The Output Path

### NO Collectors Implemented

Expected architecture from `dev-plan.md`:
```
Actuator → Membrane → Collector → JACK Output
```

Current reality:
```
Actuator → Membrane → [NOTHING]
```

**What collectors need to do**:
1. Sample membrane height at specific (x, y) positions
2. Convert membrane displacement to audio sample values
3. Send to JACK output via:
   - Option A: WebSocket to native JACK client
   - Option B: MediaStream API (create virtual output device)

## Testing Plan

### Phase 1: Verify Extension Exists
Open `brane-with-v1actuaters-jack-extensions-working-janky-cone.html` in Firefox:

1. Open browser console (F12)
2. Run:
   ```javascript
   navigator.mediaDevices.enumerateDevices().then(devices => {
       console.table(devices);
       const jack = devices.find(d => d.deviceId === 'jack-system-capture');
       console.log('JACK device found:', jack);
   });
   ```

**Expected if working**: Device with label containing "jack" or "zen"
**Expected if broken**: undefined, or device not in list

### Phase 2: Test JACK Connection
1. Press `D` to start demo mode (this should work - uses sine waves)
2. Check if membrane responds to demo actuators
3. Press `A` to attempt JACK connection
4. Watch console for errors

**Possible outcomes**:
- ✅ "JACK audio connected successfully!" → Extension works
- ❌ "JACK Bridge extension not installed or running" → Extension missing
- ❌ getUserMedia error → Permission issue or extension broken

### Phase 3: Check Audio Data Flow
If JACK connects:
1. Play audio through JACK (Spotify, etc.)
2. Connect audio to `zen-jack-bridge:capture_L` and `capture_R` in patchbay
3. Watch console for "Audio max level" logs (line 390)
4. Watch membrane for movement

**Expected if working**: Non-zero max levels, membrane responds
**Expected if broken**: Always 0, or brief spike then silence

## Known Issues to Document

1. **No sample-accurate timing** - FFT analysis introduces latency
2. **Frequency-based, not sample-based** - Can't capture transients accurately
3. **Fake stereo** - Frequency splitting, not real L/R channels
4. **No output** - Collectors not implemented

## Next Steps After Testing

Based on test results:

**If extension exists but broken**:
- Consider WebSocket approach (more reliable than browser extension)
- Native JACK client sends/receives via WebSocket
- No browser extension dependency

**If extension works**:
- Still implement collectors for output
- Consider hybrid: Extension for input, WebSocket for output

**If extension completely missing**:
- Full WebSocket implementation
- Bidirectional: JACK → WebSocket → Browser → WebSocket → JACK
