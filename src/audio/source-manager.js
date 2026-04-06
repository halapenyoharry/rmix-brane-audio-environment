(function() {
    /**
     * Audio source management system.
     * Owns: AudioContext lifecycle, all audio analysers, source routing
     * Controls: mic input, tab capture, file loading, demo loops, demo oscillator
     */

    // ─── Audio Context (lazy-init) ────────────────────────────────────
    let audioContext = null;

    function ensureAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000
            });
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        // CRITICAL (Thing 1): Set legacy bridge so existing code (initWorklet, keyboard, etc.)
        // can reference window.audioContext without modification
        window.audioContext = audioContext;
        return audioContext;
    }

    // ─── Analysers and Audio Data Buffers ─────────────────────────────
    let leftAnalyser = null;
    let rightAnalyser = null;
    let leftAudioData = null;
    let rightAudioData = null;

    function ensureAnalysers() {
        if (!leftAnalyser) {
            const ctx = ensureAudioContext();
            leftAnalyser = ctx.createAnalyser();
            leftAnalyser.fftSize = 256;
            leftAnalyser.smoothingTimeConstant = 0.3;
            leftAudioData = new Float32Array(leftAnalyser.fftSize);

            rightAnalyser = ctx.createAnalyser();
            rightAnalyser.fftSize = 256;
            rightAnalyser.smoothingTimeConstant = 0.3;
            rightAudioData = new Float32Array(rightAnalyser.fftSize);
        }
    }

    // ─── Audio Source State ───────────────────────────────────────────
    let audioEnabled = false;
    let demoMode = false;
    let audioFileMode = false;
    let tabAudioActive = false;
    let micActive = false;

    // Audio element and file playback
    let audioElement = null;
    let audioElementSource = null;

    // Tab audio capture
    let audioStream = null;

    // Demo oscillator
    let demoOscillator = null;
    let demoOscGain = null;

    // Microphone input
    let micInput = null;

    // Demo loops
    let loopAudioElement = null;
    let loopAudioSource = null;
    let currentLoopIndex = 0;
    const demoLoops = ['bass.wav', 'drums.wav', 'kick.wav'];

    // ─── Connect Source to Worklet ────────────────────────────────────
    function connectSourceToWorklet(sourceNode) {
        const worklet = _getWorklet();
        if (!worklet || !worklet.node) return;
        sourceNode.connect(worklet.node);
    }

    // ─── Callbacks and Getters ────────────────────────────────────────
    let _updateToggleStates = () => {};
    let _getWorklet = () => null;

    // ─── Control Methods (called by tile handlers) ────────────────────

    /**
     * Toggle microphone input on/off
     */
    async function toggleMic() {
        ensureAudioContext();

        if (!micInput) {
            micInput = new MicrophoneInput(audioContext);

            if (leftAnalyser && rightAnalyser) {
                micInput.analyserL = leftAnalyser;
                micInput.analyserR = rightAnalyser;
            }
        }

        if (!micActive) {
            try {
                await micInput.start();
                micActive = true;
                audioEnabled = true;

                if (!leftAnalyser || !rightAnalyser) {
                    leftAnalyser = micInput.analyserL;
                    rightAnalyser = micInput.analyserR;
                    leftAudioData = new Float32Array(leftAnalyser.frequencyBinCount);
                    rightAudioData = new Float32Array(rightAnalyser.frequencyBinCount);
                }

                if (micInput.sourceNode) {
                    connectSourceToWorklet(micInput.sourceNode);
                }

                console.log('Microphone input started');
            } catch (e) {
                console.error('Failed to start mic', e);
                alert('Could not access microphone: ' + e.message);
            }
        } else {
            micInput.stop();
            micActive = false;
            console.log('Microphone input stopped');
        }

        _updateToggleStates();
    }

    /**
     * Capture browser tab audio (getDisplayMedia)
     */
    async function captureTabAudio() {
        if (tabAudioActive) {
            stopTabAudio();
            return;
        }

        try {
            console.log('Requesting tab audio capture...');

            if (!navigator.mediaDevices) {
                throw new Error('MediaDevices API not available. Try:\n- Accessing via localhost (not remote host)\n- Using HTTPS instead of HTTP');
            }
            if (!navigator.mediaDevices.getDisplayMedia) {
                throw new Error('getDisplayMedia not available. This usually means:\n- You need to access via localhost (Chrome blocks this on remote HTTP)\n- OR set up HTTPS for remote access');
            }

            const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2
                },
                video: true
            });

            stream.getVideoTracks().forEach(track => track.stop());

            if (stream.getAudioTracks().length === 0) {
                throw new Error('No audio track in capture stream. Make sure to select a tab (not a window/screen) and check "Share tab audio".');
            }

            ensureAudioContext();

            const source = audioContext.createMediaStreamSource(stream);
            const splitter = audioContext.createChannelSplitter(2);
            source.connect(splitter);

            leftAnalyser = audioContext.createAnalyser();
            leftAnalyser.fftSize = 256;
            leftAnalyser.smoothingTimeConstant = 0.3;

            rightAnalyser = audioContext.createAnalyser();
            rightAnalyser.fftSize = 256;
            rightAnalyser.smoothingTimeConstant = 0.3;

            splitter.connect(leftAnalyser, 0);
            splitter.connect(rightAnalyser, 1);

            leftAudioData = new Float32Array(leftAnalyser.fftSize);
            rightAudioData = new Float32Array(rightAnalyser.fftSize);

            connectSourceToWorklet(source);

            audioStream = stream;
            tabAudioActive = true;
            audioEnabled = true;
            demoMode = false;
            audioFileMode = false;

            console.log('Tab audio captured! Use any browser tab audio.');

        } catch (error) {
            console.error('Tab capture failed:', error);
            alert('Tab audio capture failed: ' + error.message + '\n\nTips:\n- Select a tab (not "Entire Screen" or a window)\n- Check the "Share tab audio" checkbox in the dialog\n- Works in Chrome/Edge, not Safari.');
        }
    }

    /**
     * Stop tab audio capture
     */
    function stopTabAudio() {
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        tabAudioActive = false;
        audioEnabled = false;
        console.log('Tab audio stopped');
    }

    /**
     * Select and load audio file
     */
    function selectFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            console.log('Loading audio file:', file.name);

            if (!audioElement) {
                audioElement = new Audio();
                audioElement.loop = true;
                audioElement.controls = false;
            }

            ensureAudioContext();

            ensureAnalysers();

            if (!audioElementSource) {
                audioElementSource = audioContext.createMediaElementSource(audioElement);

                const splitter = audioContext.createChannelSplitter(2);
                audioElementSource.connect(splitter);
                audioElementSource.connect(audioContext.destination);

                splitter.connect(leftAnalyser, 0);
                splitter.connect(rightAnalyser, 1);

                connectSourceToWorklet(audioElementSource);
            }

            const url = URL.createObjectURL(file);
            audioElement.src = url;
            audioElement.play();

            audioFileMode = true;
            audioEnabled = true;
            demoMode = false;

            console.log('Audio file loaded and playing:', file.name);
        };

        input.click();
    }

    /**
     * Play demo loops (cycles through demoLoops array on each call)
     */
    function playLoop() {
        if (loopAudioElement && !loopAudioElement.paused) {
            loopAudioElement.pause();
            loopAudioElement.currentTime = 0;
            audioEnabled = false;
            audioFileMode = false;
            console.log('Loop stopped');
            return;
        }

        if (loopAudioElement && loopAudioElement.paused) {
            loopAudioElement.play();
            audioEnabled = true;
            audioFileMode = true;
            console.log('Loop resumed');
            return;
        }

        const loopFile = demoLoops[currentLoopIndex];
        currentLoopIndex = (currentLoopIndex + 1) % demoLoops.length;

        console.log('Loading demo loop:', loopFile);

        if (!loopAudioElement) {
            loopAudioElement = new Audio();
            loopAudioElement.loop = true;
        }

        ensureAudioContext();
        ensureAnalysers();

        if (!loopAudioSource) {
            loopAudioSource = audioContext.createMediaElementSource(loopAudioElement);

            const splitter = audioContext.createChannelSplitter(2);
            loopAudioSource.connect(splitter);
            loopAudioSource.connect(audioContext.destination);

            splitter.connect(leftAnalyser, 0);
            splitter.connect(rightAnalyser, 1);

            connectSourceToWorklet(loopAudioSource);
        }

        loopAudioElement.src = 'demo-loops/' + loopFile;
        loopAudioElement.play();

        audioEnabled = true;
        demoMode = false;
        audioFileMode = true;

        console.log('Playing loop:', loopFile);
    }

    /**
     * Toggle demo oscillator
     */
    function toggleDemo() {
        demoMode = !demoMode;

        if (demoMode) {
            audioEnabled = false;
            audioFileMode = false;
            if (audioElement) audioElement.pause();
            startDemoOscillator();
        } else {
            stopDemoOscillator();
        }

        _updateToggleStates();
    }

    /**
     * Start demo sine oscillator (2 Hz for slow membrane sweep)
     */
    function startDemoOscillator() {
        if (demoOscillator) return;

        const worklet = _getWorklet();
        if (!worklet) return; // No worklet — fallback path uses Actuator.apply()

        ensureAudioContext();

        demoOscGain = audioContext.createGain();
        demoOscGain.gain.value = 0.4;

        demoOscillator = audioContext.createOscillator();
        demoOscillator.type = 'sine';
        demoOscillator.frequency.value = 2.0;
        demoOscillator.connect(demoOscGain);

        connectSourceToWorklet(demoOscGain);

        demoOscillator.start();
    }

    /**
     * Stop demo oscillator
     */
    function stopDemoOscillator() {
        if (demoOscillator) {
            demoOscillator.stop();
            demoOscillator.disconnect();
            demoOscillator = null;
        }
        if (demoOscGain) {
            demoOscGain.disconnect();
            demoOscGain = null;
        }
    }

    // ─── State Update Methods ─────────────────────────────────────────

    /**
     * Update audio data from stereo analysers
     * Called once per animation frame
     */
    function updateAnalysers() {
        if (audioEnabled && leftAnalyser && rightAnalyser && leftAudioData && rightAudioData) {
            leftAnalyser.getFloatTimeDomainData(leftAudioData);
            rightAnalyser.getFloatTimeDomainData(rightAudioData);
        }
    }

    /**
     * Get current analyser objects (for visualizers)
     */
    function getAnalysers() {
        return { left: leftAnalyser, right: rightAnalyser };
    }

    /**
     * CRITICAL (Thing 2): Get audio sample buffers for actor-manager force computation
     * Actor-manager reads from this getter to get current L/R samples
     */
    function getAudioData() {
        return { left: leftAudioData, right: rightAudioData };
    }

    /**
     * Get shared AudioContext
     */
    function getAudioContext() {
        return audioContext;
    }

    /**
     * Get current audio state flags
     */
    function getAudioState() {
        return {
            audioEnabled,
            demoMode,
            audioFileMode,
            tabAudioActive,
            micActive
        };
    }

    // ─── Module Initialization ────────────────────────────────────────

    /**
     * Initialize source manager
     * @param {object} options
     *   - updateToggleStates: callback fn() to update UI state
     *   - getWorklet: callback fn() returning current membraneWorklet (or null)
     */
    function init(options = {}) {
        _updateToggleStates = options.updateToggleStates || (() => {});
        _getWorklet = options.getWorklet || (() => null);

        return {
            toggleMic,
            captureTabAudio,
            selectFile,
            playLoop,
            toggleDemo,
            updateAnalysers,
            getAnalysers,
            getAudioData,
            getAudioContext,
            getAudioState,
            connectSourceToWorklet
        };
    }

    // Export via window (synchronous, no async timing issues)
    window._sourceManager = { init };
})();
