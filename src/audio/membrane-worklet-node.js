/**
 * Membrane Worklet Node — Main-thread wrapper
 *
 * Manages the AudioWorkletNode that runs membrane-worklet-processor.js.
 * Provides a clean API for the main application:
 *   - Loading and initializing the worklet
 *   - Connecting audio sources (actuator inputs) and destinations (collector outputs)
 *   - Sending actuator/collector position updates
 *   - Receiving height snapshots for Three.js rendering
 *   - Forwarding parameter changes (waveSpeed, damping, etc.)
 */

class MembraneWorkletNode {
    /**
     * @param {AudioContext} audioContext
     * @param {object} options
     * @param {number} options.gridSize - Physics grid resolution (default 32)
     * @param {number} options.waveSpeed - Wave propagation speed (default 0.3)
     * @param {number} options.damping - Energy dissipation (default 0.00265)
     * @param {string} options.boundaryType - 'fixed'|'free'|'infinite' (default 'fixed')
     * @param {number} options.actuatorGain - Force multiplier (default 3.0)
     * @param {number} options.actuatorCount - Number of actuator input channels
     * @param {number} options.collectorCount - Number of collector output channels
     */
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.gridSize = options.gridSize || 32;
        this.waveSpeed = options.waveSpeed || 0.3;
        this.damping = options.damping || 0.00265;
        this.boundaryType = options.boundaryType || 'fixed';
        this.actuatorGain = options.actuatorGain || 3.0;
        this.actuatorCount = options.actuatorCount || 2;
        this.collectorCount = options.collectorCount || 2;

        /** @type {AudioWorkletNode|null} */
        this.node = null;

        /** @type {Float32Array|null} Latest height snapshot for rendering */
        this.latestSnapshot = null;

        /** @type {function|null} Callback when a new snapshot arrives */
        this.onSnapshot = null;

        /** @type {boolean} */
        this.ready = false;

        /** @type {function|null} Resolves when processor posts 'ready' */
        this._readyResolve = null;
    }

    /**
     * Load the worklet module and create the AudioWorkletNode.
     * Must be called once before anything else.
     * @returns {Promise<void>}
     */
    async init() {
        // Register the processor module
        await this.audioContext.audioWorklet.addModule('src/audio/membrane-worklet-processor.js');

        // Create the node with correct channel counts
        this.node = new AudioWorkletNode(this.audioContext, 'membrane-worklet-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [Math.max(1, this.collectorCount)],
            processorOptions: {
                gridSize: this.gridSize,
                waveSpeed: this.waveSpeed,
                damping: this.damping,
                boundaryType: this.boundaryType,
                actuatorGain: this.actuatorGain,
            }
        });

        // Listen for messages from the processor
        this.node.port.onmessage = (e) => this._handleMessage(e.data);

        // Wait for the processor to signal ready
        await new Promise((resolve) => {
            if (this.ready) {
                resolve();
            } else {
                this._readyResolve = resolve;
            }
        });
    }

    /**
     * Handle messages from the worklet processor.
     */
    _handleMessage(msg) {
        switch (msg.type) {
            case 'ready':
                this.ready = true;
                if (this._readyResolve) {
                    this._readyResolve();
                    this._readyResolve = null;
                }
                break;

            case 'snapshot':
                // msg.heights is an ArrayBuffer (transferred)
                this.latestSnapshot = new Float32Array(msg.heights);
                if (this.onSnapshot) {
                    this.onSnapshot(this.latestSnapshot);
                }
                break;
        }
    }

    // ─── Actuator / Collector management ───────────────────────────

    /**
     * Update actuator positions. Each actuator reads from its assigned channel.
     * @param {Array<{gridX: number, gridY: number, radius?: number, channel?: string}>} actuators
     *   channel: 'left', 'right', or 'mono' (default)
     */
    setActuators(actuators) {
        this.node.port.postMessage({
            type: 'setActuators',
            actuators: actuators.map(a => ({
                gridX: a.gridX,
                gridY: a.gridY,
                radius: a.radius || 2,
                channel: a.channel || 'mono'
            }))
        });
    }

    /**
     * Update collector positions. Each collector writes to output channel N.
     * @param {Array<{gridX: number, gridY: number, mode?: string}>} collectors
     */
    setCollectors(collectors) {
        this.node.port.postMessage({
            type: 'setCollectors',
            collectors: collectors.map(c => ({
                gridX: c.gridX,
                gridY: c.gridY,
                mode: c.mode || 'velocity'
            }))
        });
    }

    // ─── Parameter control ─────────────────────────────────────────

    /**
     * Set actuator gain (force multiplier).
     * @param {number} gain
     */
    setActuatorGain(gain) {
        this.actuatorGain = gain;
        if (this.node) this.node.port.postMessage({ type: 'setParam', key: 'actuatorGain', value: gain });
    }

    /**
     * Set wave propagation speed.
     * @param {number} speed
     */
    setWaveSpeed(speed) {
        this.waveSpeed = speed;
        if (this.node) this.node.port.postMessage({ type: 'setParam', key: 'waveSpeed', value: speed });
    }

    /**
     * Set damping coefficient.
     * @param {number} damping
     */
    setDamping(damping) {
        this.damping = damping;
        if (this.node) this.node.port.postMessage({ type: 'setParam', key: 'damping', value: damping });
    }

    /**
     * Set display smoothing factor (overrides adaptive calculation).
     * @param {number} factor - 0.001 (very smooth) to 0.3 (near-instant)
     */
    setSmoothing(factor) {
        if (this.node) this.node.port.postMessage({ type: 'setParam', key: 'smoothFactor', value: factor });
    }

    /**
     * Full configuration update (e.g., on grid resize).
     * This reallocates buffers in the processor.
     * @param {object} config
     */
    configure(config) {
        if (config.gridSize != null) this.gridSize = config.gridSize;
        if (config.waveSpeed != null) this.waveSpeed = config.waveSpeed;
        if (config.damping != null) this.damping = config.damping;
        if (config.boundaryType != null) this.boundaryType = config.boundaryType;

        this.node.port.postMessage({ type: 'configure', ...config });
    }

    /**
     * Set the worklet snapshot rate to match the actual display refresh rate.
     * @param {number} hz - Target snapshot rate in Hz
     */
    setSnapshotRate(hz) {
        if (this.node) this.node.port.postMessage({ type: 'setSnapshotRate', rate: hz });
    }

    /**
     * Measure the actual display refresh rate and tell the worklet.
     * Runs a short burst of requestAnimationFrame to sample real frame timing,
     * then sends the measured rate to the processor.
     */
    syncToDisplayRate() {
        let frames = 0;
        let startTime = 0;
        const sampleFrames = 20; // measure over 20 frames

        const tick = (timestamp) => {
            if (frames === 0) {
                startTime = timestamp;
            }
            frames++;
            if (frames <= sampleFrames) {
                requestAnimationFrame(tick);
            } else {
                const elapsed = timestamp - startTime;
                const measuredHz = Math.round((sampleFrames / elapsed) * 1000);
                console.log(`Display refresh measured: ${measuredHz} Hz — syncing worklet snapshots`);
                this.setSnapshotRate(measuredHz);
            }
        };
        requestAnimationFrame(tick);
    }

    // ─── Actions ───────────────────────────────────────────────────

    /**
     * Reset membrane to flat state.
     */
    reset() {
        this.node.port.postMessage({ type: 'reset' });
    }

    /**
     * Apply a one-shot strike impulse.
     * @param {number} gridX
     * @param {number} gridY
     * @param {number} force
     * @param {number} radius
     */
    strike(gridX, gridY, force = 2.0, radius = 6) {
        this.node.port.postMessage({ type: 'strike', gridX, gridY, force, radius });
    }

    // ─── Audio graph helpers ───────────────────────────────────────

    /**
     * Get the AudioWorkletNode for connecting into the Web Audio graph.
     * Input: connect audio sources (actuator forces) to this node.
     * Output: collector samples come out of this node.
     * @returns {AudioWorkletNode}
     */
    getNode() {
        return this.node;
    }

    /**
     * Connect an audio source (e.g., MediaStreamSource, MediaElementSource)
     * to the worklet input. The source's channels map to actuators.
     * @param {AudioNode} source
     */
    connectSource(source) {
        source.connect(this.node);
    }

    /**
     * Connect the worklet output (collector signals) to a destination.
     * @param {AudioNode} destination
     */
    connectOutput(destination) {
        this.node.connect(destination);
    }

    /**
     * Disconnect all audio connections and clean up.
     */
    destroy() {
        if (this.node) {
            this.node.disconnect();
            this.node.port.close();
            this.node = null;
        }
        this.ready = false;
        this.latestSnapshot = null;
        this.onSnapshot = null;
    }
}
