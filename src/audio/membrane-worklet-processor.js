/**
 * Membrane Physics AudioWorklet Processor
 *
 * Owns the 2D membrane physics simulation, running at audio sample rate (48 kHz).
 * Same damped wave equation as membrane-physics-core.js but with a flat
 * Float32Array layout (i * stride + j) and zero per-frame allocation.
 *
 * Audio I/O contract:
 *   inputs[0]  — actuator force signal (N channels, one per actuator)
 *   outputs[0] — collector pickup signal (N channels, one per collector)
 *
 * MessagePort commands (main → worklet):
 *   { type: 'configure', gridSize, waveSpeed, damping, boundaryType }
 *   { type: 'setActuators',  actuators: [{ gridX, gridY, radius }] }
 *   { type: 'setCollectors', collectors: [{ gridX, gridY, mode }] }
 *   { type: 'setParam', key: 'waveSpeed'|'damping', value: Number }
 *   { type: 'reset' }
 *   { type: 'strike', gridX, gridY, force, radius }
 *
 * MessagePort events (worklet → main):
 *   { type: 'snapshot', heights: Float32Array }   // ~60 Hz for rendering
 *   { type: 'ready' }
 */

class MembraneWorkletProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        const proc = options.processorOptions || {};

        // Grid dimensions — stride = gridSize + 1 (inclusive boundary)
        this.gridSize = proc.gridSize || 32;
        this.stride = this.gridSize + 1;
        this.totalCells = this.stride * this.stride;

        // Physics parameters
        this.waveSpeed = proc.waveSpeed || 0.3;
        this.damping = proc.damping || 0.00265;
        this.boundaryType = proc.boundaryType || 'fixed'; // 'fixed', 'free', 'infinite'
        this.actuatorGain = proc.actuatorGain || 3.0;

        // Pre-allocated flat buffers — NEVER reallocated in process()
        this.heights = new Float32Array(this.totalCells);
        this.velocities = new Float32Array(this.totalCells);
        this.newHeights = new Float32Array(this.totalCells);

        // Actuator & collector descriptors (updated via message port)
        // Each actuator: { gridX, gridY, radius, channel, gaussianWeights, offsets }
        //   channel: 0=left, 1=right, -1=mono (average both)
        this.actuators = [];
        // Each collector: { gridX, gridY, mode: 'velocity'|'displacement' }
        this.collectors = [];

        // Snapshot throttle: send heights to main thread at ~60 Hz
        // At 48 kHz / 128 samples per block = 375 blocks/sec
        // 375 / 60 ≈ 6 blocks between snapshots
        this.snapshotInterval = 6;
        this.blockCount = 0;

        // Pre-allocated snapshot buffer (reused, transferred copy made on send)
        this.snapshotBuffer = new Float32Array(this.totalCells);

        // Listen for configuration messages
        this.port.onmessage = (e) => this._handleMessage(e.data);
        this.port.postMessage({ type: 'ready' });
    }

    /**
     * Inline index: row i, column j → flat offset
     */
    _idx(i, j) {
        return i * this.stride + j;
    }

    /**
     * Pre-compute Gaussian spread weights for an actuator.
     * Stored once, reused every sample.  Returns { offsets, weights, count }.
     */
    _buildGaussianKernel(radius) {
        const r = Math.max(1, Math.round(radius));
        const diameter = 2 * r + 1;
        const maxEntries = diameter * diameter;
        const offsets = new Int32Array(maxEntries * 2); // pairs of (di, dj)
        const weights = new Float32Array(maxEntries);
        let count = 0;
        const sigma2 = r * r * 0.5;

        for (let di = -r; di <= r; di++) {
            for (let dj = -r; dj <= r; dj++) {
                const w = Math.exp(-(di * di + dj * dj) / sigma2) * 0.1;
                offsets[count * 2] = di;
                offsets[count * 2 + 1] = dj;
                weights[count] = w;
                count++;
            }
        }
        return { offsets, weights, count };
    }

    /**
     * Handle messages from main thread.
     */
    _handleMessage(msg) {
        switch (msg.type) {
            case 'configure': {
                if (msg.gridSize != null) {
                    this.gridSize = msg.gridSize;
                    this.stride = this.gridSize + 1;
                    this.totalCells = this.stride * this.stride;
                    this._reallocate();
                }
                if (msg.waveSpeed != null) this.waveSpeed = msg.waveSpeed;
                if (msg.damping != null) this.damping = msg.damping;
                if (msg.boundaryType != null) this.boundaryType = msg.boundaryType;
                break;
            }
            case 'setActuators': {
                this.actuators = (msg.actuators || []).map(a => {
                    const kernel = this._buildGaussianKernel(a.radius || 2);
                    // channel: 0=left, 1=right, -1=mono
                    let ch = -1;
                    if (a.channel === 'left' || a.channel === 0) ch = 0;
                    else if (a.channel === 'right' || a.channel === 1) ch = 1;
                    return {
                        gridX: a.gridX,
                        gridY: a.gridY,
                        radius: a.radius || 2,
                        channel: ch,
                        ...kernel
                    };
                });
                break;
            }
            case 'setCollectors': {
                this.collectors = (msg.collectors || []).map(c => ({
                    gridX: c.gridX,
                    gridY: c.gridY,
                    mode: c.mode || 'velocity'
                }));
                break;
            }
            case 'setParam': {
                if (msg.key === 'waveSpeed') this.waveSpeed = msg.value;
                else if (msg.key === 'damping') this.damping = msg.value;
                else if (msg.key === 'actuatorGain') this.actuatorGain = msg.value;
                break;
            }
            case 'reset': {
                this.heights.fill(0);
                this.velocities.fill(0);
                this.newHeights.fill(0);
                break;
            }
            case 'strike': {
                this._applyStrike(msg.gridX, msg.gridY, msg.force || 2.0, msg.radius || 6);
                break;
            }
        }
    }

    /**
     * Reallocate flat buffers after grid resize.
     * Only called from message handler, never from process().
     */
    _reallocate() {
        this.heights = new Float32Array(this.totalCells);
        this.velocities = new Float32Array(this.totalCells);
        this.newHeights = new Float32Array(this.totalCells);
        this.snapshotBuffer = new Float32Array(this.totalCells);
    }

    /**
     * One-shot strike impulse — Gaussian velocity injection.
     */
    _applyStrike(cx, cy, force, radius) {
        const r = Math.round(radius);
        const sigma2 = r * r * 0.5;
        const gs = this.gridSize;

        for (let di = -r; di <= r; di++) {
            for (let dj = -r; dj <= r; dj++) {
                const gi = cx + di;
                const gj = cy + dj;
                if (gi >= 0 && gi <= gs && gj >= 0 && gj <= gs) {
                    const w = Math.exp(-(di * di + dj * dj) / sigma2);
                    this.velocities[gi * this.stride + gj] += force * w * 0.1;
                }
            }
        }
    }

    /**
     * Apply actuator forces from input audio channels.
     * Each actuator reads its assigned channel (left=0, right=1, mono=-1).
     * Force = audioSample * actuatorGain * heightCoupling * gaussianWeight
     */
    _applyActuatorForces(inputs, sampleIndex) {
        const input = inputs[0]; // first input node
        if (!input || input.length === 0) return;

        const gs = this.gridSize;
        const stride = this.stride;
        const vel = this.velocities;
        const h = this.heights;
        const gain = this.actuatorGain;

        for (let a = 0; a < this.actuators.length; a++) {
            const act = this.actuators[a];

            // Read force from assigned channel
            let force;
            if (act.channel === -1) {
                // Mono: average available channels
                let sum = 0;
                for (let ch = 0; ch < input.length; ch++) {
                    sum += input[ch][sampleIndex];
                }
                force = sum / input.length;
            } else {
                const ch = Math.min(act.channel, input.length - 1);
                force = input[ch][sampleIndex];
            }

            force *= gain;
            if (force === 0) continue;

            // Height-based coupling: speaker cone couples less at extreme displacement
            const actIdx = act.gridX * stride + act.gridY;
            if (actIdx >= 0 && actIdx < h.length) {
                const memSurface = h[actIdx];
                const height = Math.max(0.5, 2 + memSurface * 0.8);
                const heightGain = 4.0 / (1 + (height / 4.0) * (height / 4.0));
                force *= heightGain;
            }

            const { gridX, gridY, offsets, weights, count } = act;

            for (let k = 0; k < count; k++) {
                const gi = gridX + offsets[k * 2];
                const gj = gridY + offsets[k * 2 + 1];
                if (gi >= 0 && gi <= gs && gj >= 0 && gj <= gs) {
                    vel[gi * stride + gj] += force * weights[k];
                }
            }
        }
    }

    /**
     * Step the 2D wave equation one timestep.
     * Identical math to membrane-physics-core.js updatePhysics(), but flat layout.
     *
     *   ∂²u/∂t² = c²∇²u − γ ∂u/∂t
     *
     *   velocity[i,j] += c² * laplacian(heights, i, j)
     *   velocity[i,j] *= (1 − damping)
     *   newHeight[i,j]  = height[i,j] + velocity[i,j]
     */
    _stepPhysics() {
        const gs = this.gridSize;
        const stride = this.stride;
        const h = this.heights;
        const v = this.velocities;
        const nh = this.newHeights;
        const c2 = this.waveSpeed * this.waveSpeed;
        const damp = 1 - this.damping;

        // Interior cells (1..gridSize-1)
        for (let i = 1; i < gs; i++) {
            const rowOff = i * stride;
            for (let j = 1; j < gs; j++) {
                const idx = rowOff + j;

                // 4-point Laplacian ∇²u
                const laplacian = h[idx + stride] + h[idx - stride] +
                                  h[idx + 1] + h[idx - 1] -
                                  4 * h[idx];

                v[idx] += c2 * laplacian;
                v[idx] *= damp;
                nh[idx] = h[idx] + v[idx];
            }
        }

        // Boundary conditions
        this._applyBoundary(nh);

        // Pointer swap — zero allocation
        this.newHeights = this.heights;
        this.heights = nh;
    }

    /**
     * Apply boundary conditions to newHeights buffer.
     */
    _applyBoundary(nh) {
        const gs = this.gridSize;
        const stride = this.stride;

        if (this.boundaryType === 'fixed') {
            // Dirichlet: u = 0 at edges
            for (let k = 0; k <= gs; k++) {
                nh[k] = 0;                         // top row (i=0)
                nh[gs * stride + k] = 0;           // bottom row (i=gridSize)
                nh[k * stride] = 0;                // left col (j=0)
                nh[k * stride + gs] = 0;           // right col (j=gridSize)
            }
        } else if (this.boundaryType === 'free') {
            // Neumann-ish: edge mirrors interior neighbor
            for (let k = 1; k < gs; k++) {
                nh[k] = nh[stride + k];                             // top
                nh[gs * stride + k] = nh[(gs - 1) * stride + k];   // bottom
                nh[k * stride] = nh[k * stride + 1];               // left
                nh[k * stride + gs] = nh[k * stride + gs - 1];     // right
            }
            // Corners
            nh[0] = nh[stride + 1];
            nh[gs] = nh[stride + gs - 1];
            nh[gs * stride] = nh[(gs - 1) * stride + 1];
            nh[gs * stride + gs] = nh[(gs - 1) * stride + gs - 1];
        } else if (this.boundaryType === 'infinite') {
            // Absorbing boundary layer (2 cells)
            const absorbWidth = 2;
            const v = this.velocities;
            for (let i = 0; i <= gs; i++) {
                for (let j = 0; j <= gs; j++) {
                    const distFromEdge = Math.min(i, gs - i, j, gs - j);
                    if (distFromEdge < absorbWidth) {
                        const factor = 0.1 + 0.9 * (distFromEdge / absorbWidth);
                        v[i * stride + j] *= factor;
                    }
                }
            }
        }
    }

    /**
     * Write collector samples to output channels.
     * Each collector writes to its corresponding output channel.
     */
    _sampleCollectors(outputs, sampleIndex) {
        const output = outputs[0];
        if (!output || output.length === 0) return;

        const h = this.heights;
        const v = this.velocities;
        const stride = this.stride;
        const gs = this.gridSize;

        for (let c = 0; c < this.collectors.length; c++) {
            const channel = output[Math.min(c, output.length - 1)];
            if (!channel) continue;

            const col = this.collectors[c];
            const { gridX, gridY, mode } = col;

            let sample = 0;
            if (gridX >= 0 && gridX <= gs && gridY >= 0 && gridY <= gs) {
                const idx = gridX * stride + gridY;
                if (mode === 'displacement') {
                    sample = h[idx];
                } else {
                    // velocity (default)
                    sample = v[idx];
                }
            }

            // Gain is applied on main thread side; here we output raw physics
            channel[sampleIndex] = sample;
        }
    }

    /**
     * AudioWorklet process callback — called at sample rate, 128 samples per block.
     * Budget: ~2.67 ms at 48 kHz.
     */
    process(inputs, outputs) {
        const blockSize = 128;

        for (let s = 0; s < blockSize; s++) {
            // 1. Inject actuator forces from audio input
            this._applyActuatorForces(inputs, s);

            // 2. Step physics one timestep
            this._stepPhysics();

            // 3. Sample collectors → audio output
            this._sampleCollectors(outputs, s);
        }

        // 4. Periodic snapshot for visualization (~60 Hz)
        this.blockCount++;
        if (this.blockCount >= this.snapshotInterval) {
            this.blockCount = 0;
            // Copy current heights for transfer
            this.snapshotBuffer.set(this.heights);
            this.port.postMessage(
                { type: 'snapshot', heights: this.snapshotBuffer.buffer.slice(0) },
                // No transferable — we copy so snapshotBuffer stays allocated
            );
        }

        return true; // Keep processor alive
    }
}

registerProcessor('membrane-worklet-processor', MembraneWorkletProcessor);
