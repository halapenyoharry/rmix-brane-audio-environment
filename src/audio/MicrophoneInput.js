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