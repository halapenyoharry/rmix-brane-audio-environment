# rmix-BAE Implementation Instructions

**Purpose**: Complete guide for implementing the browser-native audio system with Schema v1.1
**Audience**: Harold (human) and AI assistants (future sessions)
**Date**: 2025-10-26

---

## AI Progress Tracking Guidelines

**For AI assistants working on this project:**

1. **Always check this file first** - It contains the master implementation plan
2. **Update TODO list** - Use TodoWrite tool to track which phase/step you're on
3. **Mark completed steps** - Update this file's checkboxes as you complete each item
4. **Document blockers** - If stuck, add notes to `BLOCKERS.md` with context
5. **Test after each phase** - Don't skip testing sections
6. **Ask before major changes** - If deviating from plan, get Harold's approval first

**Progress Tracking Pattern:**
```javascript
// At start of session:
TodoWrite([
  {content: "Phase X: Current task", status: "in_progress", activeForm: "Working on..."},
  {content: "Phase X: Next task", status: "pending", activeForm: "..."}
])

// When completing a step:
1. Test the change
2. Mark checkbox in this file (edit IMPLEMENTATION-INSTRUCTIONS.md)
3. Update TodoWrite to mark completed, move to next
4. Commit if major milestone reached
```

---

## Phase 1: Remove JACK/WebSocket Code (30 minutes)

**Status**: IN PROGRESS
**Goal**: Clean HTML file of all JACK/WebSocket references, keep working features intact

### Completed ✓
- [x] Created `archive/deprecated/` directory
- [x] Moved `jack-websocket-bridge.js` to archive
- [x] Created `JACK-REMOVAL-NOTES.md` documentation
- [x] Removed `jack-input` and `audio-output` tiles from `tiles-config.json`
- [x] Removed `connectJACK()` function from HTML
- [x] Removed websocket variable (line 252)
- [x] Removed initJackAudio() function (lines 556-607)
- [x] Removed connectWebSocket() function (lines 818-843)
- [x] Removed disconnectWebSocket() function (lines 844-850)
- [x] Removed sendCollectorSamples() function (lines 923-937)
- [x] Removed 'A' key handler (lines 1054-1072)
- [x] Removed 'O' key handler (lines 1095-1102)
- [x] Removed JACK visualizer reference (lines 1128-1129)
- [x] Removed JACK tile action handler (lines 1331-1336)
- [x] Removed JACK from isActionActive check (line 1536)
- [x] Removed toggleAudioOutput() function
- [x] Updated initAudioOutput() comment to say "system audio"
- [x] Removed JACK from help console logs

### Phase 1 COMPLETE ✅

All JACK/WebSocket code has been successfully removed from the HTML file.

**Edit 1: Remove websocket variable**
- **Line**: 252
- **Find**: `let websocket = null;`
- **Action**: DELETE entire line

**Edit 2: Remove initJackAudio() function**
- **Lines**: 556-607
- **Find**:
```javascript
        // Initialize JACK audio through extension
        async function initJackAudio() {
            try {
                console.log('Requesting JACK audio access...');

                // ... (entire function until closing brace)
            }
        }
```
- **Action**: DELETE entire function (from line 555 comment through line 607)

**Edit 3: Remove connectWebSocket() function**
- **Lines**: 818-843
- **Find**:
```javascript
        function connectWebSocket() {
            if (!websocket || websocket.readyState === WebSocket.CLOSED) {
                websocket = new WebSocket('ws://localhost:9001');
                // ... (entire function)
            }
        }
```
- **Action**: DELETE entire function

**Edit 4: Remove disconnectWebSocket() function**
- **Lines**: 844-850
- **Find**:
```javascript
        function disconnectWebSocket() {
            if (websocket) {
                websocket.close();
                websocket = null;
                // ... (entire function)
            }
        }
```
- **Action**: DELETE entire function

**Edit 5: Remove sendCollectorSamples() function**
- **Lines**: 923-937
- **Find**:
```javascript
        function sendCollectorSamples() {
            if (!outputEnabled || !websocket || websocket.readyState !== WebSocket.OPEN) {
                return;
            }
            // ... (entire function)
        }
```
- **Action**: DELETE entire function

**Edit 6: Remove 'A' key handler (JACK toggle)**
- **Lines**: 1055-1063
- **Find**:
```javascript
                // Toggle JACK audio
                case 'a':
                case 'A':
                    const success = await initJackAudio();
                    if (success) {
                        audioEnabled = true;
                        demoMode = false;
                        updateAudioToggles();
                    }
                    break;
```
- **Action**: DELETE this case block (keep other cases intact)

**Edit 7: Remove JACK visualizer reference**
- **Line**: 1128-1129
- **Find**:
```javascript
                } else if (tileData.action === 'toggleJack' && audioEnabled && !tabAudioActive && !audioFileMode && !demoMode && leftAnalyser) {
                    // Only show on JACK button if JACK is the actual source (not file/loop/demo)
```
- **Action**: DELETE these two lines (inside updateAudioVisualizers function)

**Edit 8: Remove JACK tile action handler**
- **Lines**: 1331-1335
- **Find**:
```javascript
                } else if (tileData.action === 'toggleJack') {
                    if (!isActive) {
                        connectJACK();
                    }
                    // No deactivation needed - handled by other toggles
```
- **Action**: DELETE this else-if block

**Edit 9: Remove JACK from isActionActive check**
- **Line**: 1536
- **Find**: `if (action === 'toggleJack') return audioEnabled && !demoMode && !tabAudioActive;`
- **Action**: DELETE this entire line

**Edit 10: Remove JACK from help console log**
- **Line**: 1638
- **Find**: `console.log('  A              - Connect JACK input (requires Zen JACK Bridge)');`
- **Action**: DELETE this entire line

**Edit 11: Remove "JACK audio connected" log**
- **Line**: 598
- **Context**: Inside initJackAudio (will be deleted in Edit 2, but for reference)
- **Action**: Already handled by Edit 2

**Edit 12: Remove WebSocket references in initAudioOutput**
- **Lines**: 902-906
- **Find**:
```javascript
            // Connect to speakers (which Firefox routes to JACK)
            collectorGainNode.connect(audioContext.destination);
            outputEnabled = true;

            console.log('Audio output enabled - routing to Firefox JACK output');
```
- **Replace with**:
```javascript
            // Connect to speakers
            collectorGainNode.connect(audioContext.destination);
            outputEnabled = true;

            console.log('Audio output enabled - routing to system audio');
```

**Edit 13: Remove sendCollectorSamples() call in animate loop**
- **Search for**: `sendCollectorSamples();` (likely in main animation loop)
- **Action**: DELETE this line if found

### Testing Phase 1 Completion

After all edits, test:

```bash
# Open in browser
firefox brane-with-collectors-websocket.html
```

**Verification checklist**:
- [ ] No console errors on load
- [ ] Tab capture tile works (press tile, capture audio from browser tab)
- [ ] Demo loops tile works (cycles through bass/drums/kick/snare)
- [ ] File input tile works (loads audio file)
- [ ] Membrane still renders and responds
- [ ] Actuators can be placed (click on membrane)
- [ ] Collectors can be placed (shift+click)
- [ ] No JACK or WebSocket errors in console

**If all tests pass**: Mark Phase 1 complete, commit changes, move to Phase 2

---

## Phase 2: Audio File Management (3-4 hours)

**Status**: PENDING
**Goal**: Create modular audio system (file manager, loop controller, mic input, router)

### 2.1 Create Directory Structure

```bash
mkdir -p ~/Projects/rmix-brane-audio-environment/src/audio
mkdir -p ~/Projects/rmix-brane-audio-environment/src/schema
mkdir -p ~/Projects/rmix-brane-audio-environment/src/controllers
mkdir -p ~/Projects/rmix-brane-audio-environment/src/physics
mkdir -p ~/Projects/rmix-brane-audio-environment/src/visual
mkdir -p ~/Projects/rmix-brane-audio-environment/src/ui
mkdir -p ~/Projects/rmix-brane-audio-environment/sessions
```

**Verification**: `ls -la ~/Projects/rmix-brane-audio-environment/src/`

### 2.2 Implement AudioFileManager.js

**File**: `src/audio/AudioFileManager.js`

**Copy the following code** (from detailed plan above, lines 135-258):

<details>
<summary>Click to expand AudioFileManager.js code</summary>

```javascript
/**
 * AudioFileManager.js
 * Manages audio file loading, playlists, and playback
 *
 * Features:
 * - Load single or multiple audio files
 * - Playlist management (add, remove, clear)
 * - Playback control (play, pause, stop, next, previous)
 * - Duration calculation
 * - Stereo channel splitting for analysis
 */

class AudioFileManager {
    constructor(audioContext) {
        this.context = audioContext;
        this.playlist = [];          // Array of {name, url, duration, buffer}
        this.currentIndex = 0;
        this.audioElement = null;
        this.sourceNode = null;
        this.analyserL = null;
        this.analyserR = null;
        this.onTrackChange = null;   // Callback when track changes
        this.isPlaying = false;
    }

    /**
     * Load single file into playlist
     * @param {File} file - File object from input element
     * @returns {number} Index in playlist
     */
    async loadFile(file) {
        const url = URL.createObjectURL(file);
        const duration = await this.getAudioDuration(url);

        this.playlist.push({
            name: file.name,
            url: url,
            duration: duration,
            type: file.type
        });

        return this.playlist.length - 1;
    }

    /**
     * Load multiple files (folder or multi-select)
     * @param {FileList} fileList - Files from input element
     * @returns {Array} Playlist array
     */
    async loadFiles(fileList) {
        const promises = Array.from(fileList).map(f => this.loadFile(f));
        await Promise.all(promises);
        return this.playlist;
    }

    /**
     * Get audio duration without loading full file
     * @param {string} url - Object URL or path
     * @returns {number} Duration in seconds
     */
    async getAudioDuration(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.addEventListener('loadedmetadata', () => {
                resolve(audio.duration);
                audio.src = ''; // Release
            });
            audio.addEventListener('error', (e) => {
                reject(e);
            });
            audio.src = url;
        });
    }

    /**
     * Play specific track by index
     * @param {number} index - Track index (null = current)
     */
    play(index = null) {
        if (index !== null) this.currentIndex = index;

        const track = this.playlist[this.currentIndex];
        if (!track) {
            console.warn('No track to play');
            return;
        }

        if (!this.audioElement) {
            this.audioElement = new Audio();
            this.setupAudioChain();
        }

        this.audioElement.src = track.url;
        this.audioElement.play();
        this.isPlaying = true;

        if (this.onTrackChange) {
            this.onTrackChange(track, this.currentIndex);
        }
    }

    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.isPlaying = false;
        }
    }

    stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.isPlaying = false;
        }
    }

    next() {
        if (this.playlist.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.play();
    }

    previous() {
        if (this.playlist.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.play();
    }

    /**
     * Setup audio chain: Element → Splitter → Analysers
     * Creates stereo analysis nodes for actuator input
     */
    setupAudioChain() {
        if (!this.sourceNode) {
            this.sourceNode = this.context.createMediaElementSource(this.audioElement);

            const splitter = this.context.createChannelSplitter(2);
            this.analyserL = this.context.createAnalyser();
            this.analyserR = this.context.createAnalyser();

            this.analyserL.fftSize = 256;
            this.analyserR.fftSize = 256;
            this.analyserL.smoothingTimeConstant = 0.3;
            this.analyserR.smoothingTimeConstant = 0.3;

            this.sourceNode.connect(splitter);
            this.sourceNode.connect(this.context.destination);
            splitter.connect(this.analyserL, 0);
            splitter.connect(this.analyserR, 1);
        }
    }

    getCurrentTrack() {
        return this.playlist[this.currentIndex];
    }

    getPlaylist() {
        return this.playlist;
    }

    clearPlaylist() {
        this.stop();
        this.playlist.forEach(track => URL.revokeObjectURL(track.url));
        this.playlist = [];
        this.currentIndex = 0;
    }

    removeTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;

        const track = this.playlist[index];
        URL.revokeObjectURL(track.url);
        this.playlist.splice(index, 1);

        // Adjust current index if needed
        if (this.currentIndex >= index && this.currentIndex > 0) {
            this.currentIndex--;
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioFileManager;
}
```
</details>

**Testing 2.2**:
Create test HTML file: `test-audio-file-manager.html`

```html
<!DOCTYPE html>
<html>
<head><title>Test AudioFileManager</title></head>
<body>
    <h1>AudioFileManager Test</h1>
    <input type="file" id="files" multiple accept="audio/*">
    <button id="play">Play</button>
    <button id="pause">Pause</button>
    <button id="next">Next</button>
    <button id="prev">Previous</button>
    <div id="status">No file loaded</div>

    <script src="src/audio/AudioFileManager.js"></script>
    <script>
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const manager = new AudioFileManager(audioContext);

        manager.onTrackChange = (track, index) => {
            document.getElementById('status').textContent =
                `${index + 1}/${manager.playlist.length}: ${track.name}`;
        };

        document.getElementById('files').onchange = async (e) => {
            await manager.loadFiles(e.target.files);
            console.log('Loaded:', manager.getPlaylist());
        };

        document.getElementById('play').onclick = () => manager.play();
        document.getElementById('pause').onclick = () => manager.pause();
        document.getElementById('next').onclick = () => manager.next();
        document.getElementById('prev').onclick = () => manager.previous();
    </script>
</body>
</html>
```

**Verification**:
- [ ] Load multiple files → all appear in playlist
- [ ] Play → audio plays
- [ ] Next/Previous → cycles through tracks
- [ ] Track info updates correctly

### 2.3 Implement LoopController.js

**File**: `src/audio/LoopController.js`

<details>
<summary>Click to expand LoopController.js code</summary>

```javascript
/**
 * LoopController.js
 * Controls loop regions (in/out points) for live sampling
 *
 * Features:
 * - Set loop start/end points
 * - Enable/disable looping
 * - Jump to loop points
 * - Precise loop monitoring (10ms check interval)
 */

class LoopController {
    constructor(audioElement) {
        this.audio = audioElement;
        this.loopStart = 0;        // Seconds
        this.loopEnd = null;       // Null = end of file
        this.isLooping = false;
        this.updateInterval = null;
    }

    /**
     * Set loop region in seconds
     * @param {number} startSec - Start time
     * @param {number} endSec - End time
     */
    setLoopRegion(startSec, endSec) {
        this.loopStart = Math.max(0, startSec);
        this.loopEnd = endSec;
    }

    /**
     * Enable loop monitoring
     * Checks playback position every 10ms for precision
     */
    enableLoop() {
        if (this.isLooping) return;
        this.isLooping = true;

        this.updateInterval = setInterval(() => {
            if (!this.audio) return;

            const current = this.audio.currentTime;
            const end = this.loopEnd || this.audio.duration;

            // Loop back when reaching end point
            if (current >= end) {
                this.audio.currentTime = this.loopStart;
            }
        }, 10); // Check every 10ms for precision
    }

    /**
     * Disable loop monitoring
     */
    disableLoop() {
        this.isLooping = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.audio.loop = false;
    }

    /**
     * Jump to loop start point
     */
    jumpToStart() {
        if (this.audio) {
            this.audio.currentTime = this.loopStart;
        }
    }

    /**
     * Set in point from current playback position
     */
    setInPoint() {
        if (this.audio) {
            this.loopStart = this.audio.currentTime;
        }
    }

    /**
     * Set out point from current playback position
     */
    setOutPoint() {
        if (this.audio) {
            this.loopEnd = this.audio.currentTime;
        }
    }

    /**
     * Clear loop points to defaults
     */
    clearPoints() {
        this.loopStart = 0;
        this.loopEnd = null;
    }

    /**
     * Get current loop region info
     * @returns {Object} {start, end, duration}
     */
    getRegion() {
        const duration = this.audio ? this.audio.duration : 0;
        return {
            start: this.loopStart,
            end: this.loopEnd || duration,
            duration: (this.loopEnd || duration) - this.loopStart
        };
    }

    /**
     * Cleanup when destroying
     */
    destroy() {
        this.disableLoop();
        this.audio = null;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoopController;
}
```
</details>

**Testing 2.3**: Add to `test-audio-file-manager.html`

```javascript
// Add after AudioFileManager creation
const loopController = new LoopController(manager.audioElement);

// Add buttons to HTML
<button id="setIn">Set In (I)</button>
<button id="setOut">Set Out (O)</button>
<button id="toggleLoop">Toggle Loop (L)</button>
<div id="loopInfo">Loop: off</div>

// Add handlers
document.getElementById('setIn').onclick = () => {
    loopController.setInPoint();
    updateLoopInfo();
};

document.getElementById('setOut').onclick = () => {
    loopController.setOutPoint();
    updateLoopInfo();
};

document.getElementById('toggleLoop').onclick = () => {
    if (loopController.isLooping) {
        loopController.disableLoop();
    } else {
        loopController.enableLoop();
    }
    updateLoopInfo();
};

function updateLoopInfo() {
    const region = loopController.getRegion();
    document.getElementById('loopInfo').textContent =
        `Loop: ${loopController.isLooping ? 'ON' : 'OFF'} | ` +
        `${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s`;
}
```

**Verification**:
- [ ] Set in point → remembers position
- [ ] Set out point → remembers position
- [ ] Enable loop → plays between in/out points
- [ ] Loop is smooth (no gaps or clicks)

### 2.4 Implement MicrophoneInput.js

**File**: `src/audio/MicrophoneInput.js`

<details>
<summary>Click to expand MicrophoneInput.js code</summary>

```javascript
/**
 * MicrophoneInput.js
 * Handles microphone/line input via getUserMedia
 *
 * Features:
 * - System microphone/line input
 * - Device selection
 * - Stereo analysis
 * - Proper cleanup
 */

class MicrophoneInput {
    constructor(audioContext) {
        this.context = audioContext;
        this.stream = null;
        this.sourceNode = null;
        this.analyserL = null;
        this.analyserR = null;
        this.isActive = false;
    }

    /**
     * Start microphone input
     * @param {string} deviceId - Optional specific device ID
     */
    async start(deviceId = null) {
        try {
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2
                }
            };

            // Specific device if provided
            if (deviceId) {
                constraints.audio.deviceId = { exact: deviceId };
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.sourceNode = this.context.createMediaStreamSource(this.stream);

            // Setup stereo analysers
            const splitter = this.context.createChannelSplitter(2);
            this.analyserL = this.context.createAnalyser();
            this.analyserR = this.context.createAnalyser();

            this.analyserL.fftSize = 256;
            this.analyserR.fftSize = 256;
            this.analyserL.smoothingTimeConstant = 0.3;
            this.analyserR.smoothingTimeConstant = 0.3;

            this.sourceNode.connect(splitter);
            splitter.connect(this.analyserL, 0);
            splitter.connect(this.analyserR, 1);

            this.isActive = true;
            console.log('Microphone active');

        } catch (error) {
            console.error('Microphone access failed:', error);
            throw error;
        }
    }

    /**
     * Stop microphone input and cleanup
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        this.isActive = false;
        console.log('Microphone stopped');
    }

    /**
     * List available audio input devices
     * @returns {Array} Array of {deviceId, label}
     */
    static async getDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices
            .filter(d => d.kind === 'audioinput')
            .map(d => ({
                deviceId: d.deviceId,
                label: d.label || `Microphone ${d.deviceId.substring(0, 8)}`
            }));
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MicrophoneInput;
}
```
</details>

**Testing 2.4**: Create `test-microphone.html`

```html
<!DOCTYPE html>
<html>
<head><title>Test Microphone</title></head>
<body>
    <h1>MicrophoneInput Test</h1>
    <button id="start">Start Mic</button>
    <button id="stop">Stop Mic</button>
    <button id="listDevices">List Devices</button>
    <div id="status">Mic off</div>
    <canvas id="visualizer" width="400" height="100"></canvas>

    <script src="src/audio/MicrophoneInput.js"></script>
    <script>
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const mic = new MicrophoneInput(audioContext);
        const canvas = document.getElementById('visualizer');
        const ctx = canvas.getContext('2d');

        document.getElementById('start').onclick = async () => {
            await mic.start();
            document.getElementById('status').textContent = 'Mic active';
            visualize();
        };

        document.getElementById('stop').onclick = () => {
            mic.stop();
            document.getElementById('status').textContent = 'Mic off';
        };

        document.getElementById('listDevices').onclick = async () => {
            const devices = await MicrophoneInput.getDevices();
            console.log('Audio devices:', devices);
        };

        function visualize() {
            if (!mic.isActive) return;

            const dataL = new Uint8Array(mic.analyserL.fftSize);
            mic.analyserL.getByteTimeDomainData(dataL);

            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < dataL.length; i++) {
                const x = (i / dataL.length) * canvas.width;
                const y = (dataL[i] / 255) * canvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            requestAnimationFrame(visualize);
        }
    </script>
</body>
</html>
```

**Verification**:
- [ ] Start mic → waveform shows audio
- [ ] Stop mic → waveform stops
- [ ] List devices → shows available inputs
- [ ] No audio feedback/echo

### 2.5 Implement AudioSourceRouter.js

**File**: `src/audio/AudioSourceRouter.js`

<details>
<summary>Click to expand AudioSourceRouter.js code</summary>

```javascript
/**
 * AudioSourceRouter.js
 * Routes active audio source to actuators
 * Central hub for all audio inputs
 *
 * Features:
 * - Register multiple audio sources
 * - Switch between sources
 * - Provide unified audio data interface
 * - Route to actuators based on channel mode
 */

class AudioSourceRouter {
    constructor() {
        this.activeSourceId = null;
        this.sources = new Map(); // id → {analyserL, analyserR, instance}

        // Audio data buffers (stereo)
        this.leftData = null;
        this.rightData = null;
        this.bufferSize = 256; // Default FFT size
    }

    /**
     * Register an audio source
     * @param {string} id - Unique source identifier
     * @param {Object} source - Source instance with analyserL, analyserR properties
     */
    registerSource(id, source) {
        if (!source.analyserL || !source.analyserR) {
            console.warn(`Source ${id} missing analysers`);
            return;
        }

        this.sources.set(id, {
            instance: source,
            analyserL: source.analyserL,
            analyserR: source.analyserR
        });

        console.log(`Registered audio source: ${id}`);
    }

    /**
     * Unregister a source
     * @param {string} id - Source identifier
     */
    unregisterSource(id) {
        this.sources.delete(id);
        if (this.activeSourceId === id) {
            this.activeSourceId = null;
        }
    }

    /**
     * Set the active audio source
     * @param {string} id - Source identifier to activate
     */
    setActiveSource(id) {
        if (!this.sources.has(id)) {
            console.warn(`Unknown source: ${id}`);
            return false;
        }

        this.activeSourceId = id;
        const source = this.sources.get(id);

        // Allocate buffers if needed
        const fftSize = source.analyserL.fftSize;
        if (!this.leftData || this.leftData.length !== fftSize) {
            this.leftData = new Uint8Array(fftSize);
            this.rightData = new Uint8Array(fftSize);
            this.bufferSize = fftSize;
        }

        console.log(`Active audio source: ${id}`);
        return true;
    }

    /**
     * Update audio data from active source
     * Call this every frame before reading audio data
     */
    updateAudioData() {
        if (!this.activeSourceId) return;

        const source = this.sources.get(this.activeSourceId);
        if (!source) return;

        source.analyserL.getByteTimeDomainData(this.leftData);
        source.analyserR.getByteTimeDomainData(this.rightData);
    }

    /**
     * Get audio data for specific channel
     * @param {string} channel - 'left', 'right', or 'mono'
     * @returns {Uint8Array} Audio data buffer
     */
    getChannelData(channel) {
        if (!this.leftData || !this.rightData) return null;

        if (channel === 'left') return this.leftData;
        if (channel === 'right') return this.rightData;

        // Mono: mix both channels
        // For simplicity, return left (actuator can mix if needed)
        return this.leftData;
    }

    /**
     * Get frequency data for visualization
     * @param {string} channel - 'left', 'right', or 'mono'
     * @returns {Uint8Array} Frequency data
     */
    getFrequencyData(channel = 'left') {
        if (!this.activeSourceId) return null;

        const source = this.sources.get(this.activeSourceId);
        if (!source) return null;

        const analyser = (channel === 'right') ? source.analyserR : source.analyserL;
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);

        return freqData;
    }

    /**
     * Check if any source is active
     * @returns {boolean}
     */
    isActive() {
        return this.activeSourceId !== null;
    }

    /**
     * Get active source ID
     * @returns {string|null}
     */
    getActiveSourceId() {
        return this.activeSourceId;
    }

    /**
     * Get all registered source IDs
     * @returns {Array<string>}
     */
    getSourceIds() {
        return Array.from(this.sources.keys());
    }

    /**
     * Clear all sources
     */
    clearAll() {
        this.sources.clear();
        this.activeSourceId = null;
        this.leftData = null;
        this.rightData = null;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioSourceRouter;
}
```
</details>

**Testing 2.5**: Create `test-audio-router.html`

```html
<!DOCTYPE html>
<html>
<head><title>Test AudioSourceRouter</title></head>
<body>
    <h1>AudioSourceRouter Test</h1>

    <h2>Sources</h2>
    <button id="addFile">Add File Source</button>
    <button id="addMic">Add Mic Source</button>
    <input type="file" id="fileInput" accept="audio/*" style="display:none">

    <h2>Active Source</h2>
    <button id="activateFile">Activate File</button>
    <button id="activateMic">Activate Mic</button>

    <div id="status">No active source</div>
    <canvas id="viz" width="400" height="200"></canvas>

    <script src="src/audio/AudioFileManager.js"></script>
    <script src="src/audio/MicrophoneInput.js"></script>
    <script src="src/audio/AudioSourceRouter.js"></script>
    <script>
        const audioContext = new AudioContext();
        const router = new AudioSourceRouter();
        const fileManager = new AudioFileManager(audioContext);
        const mic = new MicrophoneInput(audioContext);

        let fileSourceReady = false;
        let micSourceReady = false;

        // Add file source
        document.getElementById('addFile').onclick = () => {
            document.getElementById('fileInput').click();
        };

        document.getElementById('fileInput').onchange = async (e) => {
            await fileManager.loadFiles(e.target.files);
            fileManager.play(0);
            router.registerSource('file', fileManager);
            fileSourceReady = true;
            console.log('File source registered');
        };

        // Add mic source
        document.getElementById('addMic').onclick = async () => {
            await mic.start();
            router.registerSource('mic', mic);
            micSourceReady = true;
            console.log('Mic source registered');
        };

        // Activate sources
        document.getElementById('activateFile').onclick = () => {
            if (fileSourceReady) {
                router.setActiveSource('file');
                document.getElementById('status').textContent = 'Active: File';
            }
        };

        document.getElementById('activateMic').onclick = () => {
            if (micSourceReady) {
                router.setActiveSource('mic');
                document.getElementById('status').textContent = 'Active: Mic';
            }
        };

        // Visualize active source
        const canvas = document.getElementById('viz');
        const ctx = canvas.getContext('2d');

        function visualize() {
            router.updateAudioData();

            const leftData = router.getChannelData('left');
            const rightData = router.getChannelData('right');

            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (leftData) {
                // Draw left channel (top half)
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < leftData.length; i++) {
                    const x = (i / leftData.length) * canvas.width;
                    const y = (leftData[i] / 255) * (canvas.height / 2);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            if (rightData) {
                // Draw right channel (bottom half)
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < rightData.length; i++) {
                    const x = (i / rightData.length) * canvas.width;
                    const y = canvas.height / 2 + (rightData[i] / 255) * (canvas.height / 2);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            requestAnimationFrame(visualize);
        }

        visualize();
    </script>
</body>
</html>
```

**Verification**:
- [ ] Register file source → appears in sources list
- [ ] Register mic source → appears in sources list
- [ ] Activate file → visualizer shows file audio
- [ ] Activate mic → visualizer shows mic audio
- [ ] Switch between sources → visualizer updates correctly

### Phase 2 Completion Checklist

- [ ] All 5 modules created in `src/audio/`
- [ ] All test files pass
- [ ] No console errors
- [ ] Code is well-commented
- [ ] Ready to integrate into main HTML

**When Phase 2 complete**: Commit changes, update TODO, move to Phase 3

---

## Phase 3: Schema v1.1 Integration (4-6 hours)

**Status**: PENDING
**Goal**: Implement schema-based system (session files, parameter controller, refactor physics)

### 3.1 Extend default-session.json with Audio Sources

**File**: `default-session.json`

<details>
<summary>Click to expand updated default-session.json</summary>

```json
{
  "version": "1.1",
  "name": "default-session",
  "created": "2025-10-26T00:00:00Z",
  "modified": "2025-10-26T00:00:00Z",

  "sources": [
    {
      "id": "source_file_player",
      "type": "file_player",
      "label": "Audio Files",
      "enabled": false,
      "config": {
        "playlist": [],
        "currentTrack": 0,
        "loop": false,
        "loopRegion": {
          "start": 0,
          "end": null
        }
      },
      "analysis": {
        "fftSize": 256,
        "smoothing": 0.3
      }
    },
    {
      "id": "source_microphone",
      "type": "microphone",
      "label": "Mic/Line In",
      "enabled": false,
      "config": {
        "deviceId": null,
        "gain": 1.0
      },
      "analysis": {
        "fftSize": 256,
        "smoothing": 0.3
      }
    },
    {
      "id": "source_tab_capture",
      "type": "tab_capture",
      "label": "Browser Tab Audio",
      "enabled": false,
      "analysis": {
        "fftSize": 256,
        "smoothing": 0.3
      }
    },
    {
      "id": "source_demo_loops",
      "type": "demo_loops",
      "label": "Demo Loops",
      "enabled": false,
      "config": {
        "folder": "./demo-loops/",
        "files": ["bass.wav", "drums.wav", "kick.wav", "snare.wav"],
        "currentIndex": 0,
        "autoAdvance": true
      }
    }
  ],

  "actuators": [],

  "collectors": [],

  "modulators": [],

  "parameters": {
    "membrane": {
      "wave_speed": {
        "id": "membrane_wave_speed",
        "path": "/membrane/physics/wave_speed",
        "displayName": "Wave Speed",
        "value": 0.15,
        "min": 0.05,
        "max": 0.3,
        "default": 0.15,
        "unit": "c",
        "scaling": "linear",
        "updateRate": "frame",
        "group": "membrane",
        "smoothing": {
          "enabled": true,
          "type": "exponential",
          "timeConstant": 50
        },
        "ui": {
          "type": "slider",
          "width": 120,
          "height": 60,
          "color": "#4444ff"
        }
      },
      "damping": {
        "id": "membrane_damping",
        "path": "/membrane/physics/damping",
        "displayName": "Damping",
        "value": 0.01,
        "min": 0.001,
        "max": 0.05,
        "default": 0.01,
        "unit": "γ",
        "scaling": "logarithmic",
        "updateRate": "frame",
        "group": "membrane",
        "smoothing": {
          "enabled": false,
          "type": "none"
        },
        "ui": {
          "type": "slider",
          "width": 120,
          "height": 60,
          "color": "#ff4444"
        }
      },
      "actuator_gain": {
        "id": "membrane_actuator_gain",
        "path": "/membrane/physics/actuator_gain",
        "displayName": "Actuator Gain",
        "value": 3.0,
        "min": 0.5,
        "max": 5.0,
        "default": 3.0,
        "unit": "",
        "scaling": "linear",
        "updateRate": "frame",
        "group": "membrane",
        "smoothing": {
          "enabled": true,
          "type": "exponential",
          "timeConstant": 100
        },
        "ui": {
          "type": "slider",
          "width": 120,
          "height": 60,
          "color": "#44ff44"
        }
      }
    }
  },

  "mappingCurves": {
    "actuator_size_to_frequency": {
      "id": "actuator_size_to_frequency",
      "path": "/audio/actuator/size_freq_map",
      "displayName": "Size → Frequency",
      "curve": {
        "type": "power",
        "formula": "freq_hz = freq_max * (size_mm / size_max)^exponent",
        "exponent": -2.0,
        "size_min_mm": 2,
        "size_max_mm": 50,
        "freq_min_hz": 20,
        "freq_max_hz": 20000
      }
    }
  },

  "uiLayout": {
    "toolbar": {
      "position": "bottom",
      "height": 120,
      "padding": 20,
      "gap": 12,
      "collapsible": true
    }
  },

  "metadata": {
    "masterOutput": {
      "gain": 1.0,
      "limiter": {
        "enabled": true,
        "threshold": -0.1,
        "release": 100
      }
    },
    "performance": {
      "target_fps": 60,
      "auto_quality": true,
      "gpu_acceleration": true
    }
  }
}
```
</details>

### 3.2 Implement SchemaParser.js

**File**: `src/schema/SchemaParser.js`

<details>
<summary>Click to expand SchemaParser.js code</summary>

```javascript
/**
 * SchemaParser.js
 * Loads, validates, and saves session JSON files
 *
 * Features:
 * - Load session from file/URL
 * - Validate schema version and structure
 * - Check sourceId references
 * - Validate parameter ranges
 * - Save session to JSON file (browser download)
 */

class SchemaParser {
    constructor() {
        this.supportedVersion = "1.1";
    }

    /**
     * Load session from file path or URL
     * @param {string} filepath - Path to session JSON file
     * @returns {Object} Parsed and validated session
     */
    async loadSession(filepath) {
        try {
            const response = await fetch(filepath);
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.statusText}`);
            }

            const text = await response.text();
            const session = JSON.parse(text);

            this.validate(session);

            console.log(`Loaded session: ${session.name} (v${session.version})`);
            return session;

        } catch (error) {
            console.error('Session load failed:', error);
            throw error;
        }
    }

    /**
     * Validate session structure and data
     * @param {Object} session - Session object to validate
     */
    validate(session) {
        // Version check
        if (session.version !== this.supportedVersion) {
            throw new Error(
                `Unsupported version: ${session.version} (expected ${this.supportedVersion})`
            );
        }

        // Required top-level properties
        const required = ['version', 'name', 'sources', 'actuators', 'collectors', 'parameters'];
        for (const prop of required) {
            if (!session.hasOwnProperty(prop)) {
                throw new Error(`Missing required property: ${prop}`);
            }
        }

        // Validate sourceId references in actuators
        const sourceIds = new Set(session.sources.map(s => s.id));
        session.actuators.forEach(act => {
            if (act.sourceId && !sourceIds.has(act.sourceId)) {
                throw new Error(`Invalid sourceId in actuator: ${act.sourceId}`);
            }
        });

        // Validate parameter ranges
        this.validateParameters(session.parameters);

        console.log('Session validation passed');
    }

    /**
     * Validate all parameters have valid ranges
     * @param {Object} parameters - Parameters object from session
     */
    validateParameters(parameters) {
        Object.values(parameters).forEach(group => {
            Object.values(group).forEach(param => {
                // Skip non-numeric parameters
                if (param.type === 'enum' || typeof param.value !== 'number') {
                    return;
                }

                if (param.value < param.min || param.value > param.max) {
                    throw new Error(
                        `Parameter ${param.id} value ${param.value} out of range [${param.min}, ${param.max}]`
                    );
                }
            });
        });
    }

    /**
     * Save session to JSON file (browser download)
     * @param {Object} session - Session object to save
     * @param {string} filename - Filename (default: session name)
     */
    saveSession(session, filename = null) {
        // Update modified timestamp
        session.modified = new Date().toISOString();

        // Generate filename
        const fname = filename || `${session.name}.json`;

        // Serialize with formatting
        const json = JSON.stringify(session, null, 2);

        // Browser download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`Session saved: ${fname}`);
    }

    /**
     * Create a new empty session
     * @param {string} name - Session name
     * @returns {Object} New session object
     */
    createNewSession(name = 'untitled') {
        return {
            version: this.supportedVersion,
            name: name,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            sources: [],
            actuators: [],
            collectors: [],
            modulators: [],
            parameters: {},
            mappingCurves: {},
            uiLayout: {},
            metadata: {}
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchemaParser;
}
```
</details>

**Testing 3.2**: Create `test-schema-parser.html`

```html
<!DOCTYPE html>
<html>
<head><title>Test SchemaParser</title></head>
<body>
    <h1>SchemaParser Test</h1>
    <button id="load">Load default-session.json</button>
    <button id="save">Save Session</button>
    <button id="new">Create New Session</button>
    <pre id="output"></pre>

    <script src="src/schema/SchemaParser.js"></script>
    <script>
        const parser = new SchemaParser();
        let currentSession = null;

        document.getElementById('load').onclick = async () => {
            try {
                currentSession = await parser.loadSession('./default-session.json');
                document.getElementById('output').textContent =
                    JSON.stringify(currentSession, null, 2);
                console.log('Session loaded:', currentSession);
            } catch (error) {
                alert('Load failed: ' + error.message);
            }
        };

        document.getElementById('save').onclick = () => {
            if (currentSession) {
                parser.saveSession(currentSession);
            } else {
                alert('No session loaded');
            }
        };

        document.getElementById('new').onclick = () => {
            currentSession = parser.createNewSession('test-session');
            document.getElementById('output').textContent =
                JSON.stringify(currentSession, null, 2);
        };
    </script>
</body>
</html>
```

**Verification**:
- [ ] Load default-session.json → no errors
- [ ] Save session → downloads JSON file
- [ ] Create new session → valid structure
- [ ] Invalid version throws error
- [ ] Invalid sourceId throws error

### 3.3-3.5 Continue in Next Message...

Due to length limits, I'll continue with ParameterController, refactoring, and remaining phases in the next part. Would you like me to continue with the rest of Phase 3-5 detailed instructions now?

---

## Quick Reference for AI Assistants

**When resuming work on this project:**

1. **Read this file first** - Check current phase status
2. **Check TODO list** - `TodoWrite` tool should match this file
3. **Run tests** - Verify previous phases still work
4. **Update checkboxes** - Edit this file to mark completed items
5. **Ask before deviating** - Get Harold's approval for changes to plan

**Common blockers:**
- Missing directory structure → Create with `mkdir -p src/{audio,schema,controllers,physics,visual,ui}`
- Module not found → Check file exists in correct location
- CORS errors → Use local HTTP server: `python3 -m http.server 8000`
- AudioContext suspended → User gesture required (button click)

**Testing pattern:**
```bash
# Start local server
cd ~/Projects/rmix-brane-audio-environment
python3 -m http.server 8000

# Open test files
firefox http://localhost:8000/test-audio-file-manager.html
```

**File naming conventions:**
- Modules: `PascalCase.js` (e.g., `AudioFileManager.js`)
- Tests: `test-kebab-case.html` (e.g., `test-audio-router.html`)
- Sessions: `kebab-case.json` (e.g., `default-session.json`)

