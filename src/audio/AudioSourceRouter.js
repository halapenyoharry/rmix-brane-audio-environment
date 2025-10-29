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