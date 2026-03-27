/**
 * Membrane Physics AudioWorklet Processor
 *
 * Owns the 2D membrane physics simulation, running at audio sample rate (48 kHz).
 * Damped wave equation with glue-coupled actuators: the actuator sphere surface
 * IS the membrane surface at contact points. Waves radiate from footprint edges.
 *
 * Audio I/O contract:
 *   inputs[0]  — actuator displacement signal (N channels, one per actuator)
 *   outputs[0] — collector pickup signal (N channels, one per collector)
 *
 * MessagePort commands (main → worklet):
 *   { type: 'configure', gridSize, waveSpeed, damping, boundaryType }
 *   { type: 'setActuators',  actuators: [{ gridX, gridY, radius }] }
 *   { type: 'setCollectors', collectors: [{ gridX, gridY, mode }] }
 *   { type: 'setParam', key: 'waveSpeed'|'damping', value: Number }
 *   { type: 'setSnapshotRate', rate: Number }  // target Hz, e.g. 100 or 144
 *   { type: 'reset' }
 *   { type: 'strike', gridX, gridY, force, radius }
 *
 * MessagePort events (worklet → main):
 *   { type: 'snapshot', heights: Float32Array }   // adaptive Hz for rendering
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
        // Driven mask: 1 = owned by actuator, wave equation skips this cell
        this.driven = new Uint8Array(this.totalCells);

        // Actuator & collector descriptors (updated via message port)
        // Each actuator: { gridX, gridY, radius, channel, offsets, sphereHeights, count }
        //   channel: 0=left, 1=right, -1=mono (average both)
        //   Sphere footprint is pre-computed: offsets (di,dj) + height offset from sphere bottom
        this.actuators = [];
        // Each collector: { gridX, gridY, mode: 'velocity'|'displacement' }
        this.collectors = [];

        // Snapshot throttle: send heights to main thread at display refresh rate.
        // Default ~60 Hz; updated at runtime via 'setSnapshotRate' message
        // from main thread which measures actual monitor refresh rate.
        // At 48 kHz / 128 samples per block = 375 blocks/sec.
        this.blockRate = sampleRate / 128; // blocks per second
        this.snapshotInterval = Math.max(1, Math.round(this.blockRate / 60));
        this.blockCount = 0;

        // Display-smoothed heights: exponential low-pass filter on the physics
        // heights, used ONLY for visual snapshots. Audio output uses raw physics.
        // This is what made the "creamy" branch look smooth — physics at frame rate
        // was implicitly low-pass filtered. Now we get the same visual with audio-
        // rate physics underneath.
        //
        // smoothFactor controls the display low-pass cutoff.
        // Adaptive: scales with waveSpeed so you can see propagation at any speed.
        //   - At real-time (c=0.3): smoothFactor ≈ 0.003 → creamy, envelope view
        //   - At slow-mo (c=0.001): smoothFactor ≈ 0.15 → see every ripple
        //   - Frozen (c=0): smoothFactor = 0.3 → near-instant display response
        // Recalculated when waveSpeed changes.
        this.displayHeights = new Float32Array(this.totalCells);
        this.smoothOverride = false; // true when user manually sets smoothing
        this.smoothFactor = this._calcSmoothFactor(this.waveSpeed);

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
     * Calculate display smoothing factor from wave speed.
     * Maps waveSpeed to a smoothFactor that keeps visuals informative:
     *   high c → low factor (creamy, shows energy envelope)
     *   low c  → high factor (responsive, shows wave shapes)
     *   c = 0  → near-instant (frozen frame, no lag)
     */
    _calcSmoothFactor(c) {
        if (c <= 0) return 0.3;
        // Inverse relationship: faster physics → more smoothing
        // Clamp between 0.002 (very smooth) and 0.2 (very responsive)
        return Math.max(0.002, Math.min(0.2, 0.01 / c));
    }

    /**
     * Pre-compute sphere footprint for an actuator.
     * For each grid point within the sphere's radius, stores the (di, dj) offset
     * and the height delta from the sphere's bottom surface:
     *   surfaceHeight = centerY - sqrt(r² - di² - dj²)
     * The sqrt term is constant per grid offset, so we pre-compute it.
     * Returns { offsets, sphereDeltas, count }.
     */
    _buildSphereFootprint(radius) {
        const r = Math.max(1, Math.round(radius));
        const r2 = r * r;
        const diameter = 2 * r + 1;
        const maxEntries = diameter * diameter;
        const offsets = new Int32Array(maxEntries * 2); // pairs of (di, dj)
        const sphereDeltas = new Float32Array(maxEntries); // -sqrt(r²-d²) per point
        let count = 0;

        for (let di = -r; di <= r; di++) {
            for (let dj = -r; dj <= r; dj++) {
                const d2 = di * di + dj * dj;
                if (d2 >= r2) continue; // outside sphere footprint
                // Sphere bottom surface offset from center:
                // at (di,dj), surface is centerY - sqrt(r²-di²-dj²)
                // so the delta below center is -sqrt(r²-d²)
                sphereDeltas[count] = -Math.sqrt(r2 - d2);
                offsets[count * 2] = di;
                offsets[count * 2 + 1] = dj;
                count++;
            }
        }
        return { offsets, sphereDeltas, count };
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
                if (msg.waveSpeed != null) {
                    this.waveSpeed = msg.waveSpeed;
                    this.smoothFactor = this._calcSmoothFactor(msg.waveSpeed);
                }
                if (msg.damping != null) this.damping = msg.damping;
                if (msg.boundaryType != null) this.boundaryType = msg.boundaryType;
                break;
            }
            case 'setActuators': {
                this.actuators = (msg.actuators || []).map(a => {
                    const footprint = this._buildSphereFootprint(a.radius || 2);
                    // channel: 0=left, 1=right, -1=mono
                    let ch = -1;
                    if (a.channel === 'left' || a.channel === 0) ch = 0;
                    else if (a.channel === 'right' || a.channel === 1) ch = 1;
                    return {
                        gridX: a.gridX,
                        gridY: a.gridY,
                        radius: a.radius || 2,
                        channel: ch,
                        prevSample: 0, // for numerical velocity derivative
                        ...footprint
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
                if (msg.key === 'waveSpeed') {
                    this.waveSpeed = msg.value;
                    if (!this.smoothOverride) this.smoothFactor = this._calcSmoothFactor(msg.value);
                }
                else if (msg.key === 'damping') this.damping = msg.value;
                else if (msg.key === 'actuatorGain') this.actuatorGain = msg.value;
                else if (msg.key === 'smoothFactor') {
                    this.smoothOverride = true;
                    this.smoothFactor = msg.value;
                }
                break;
            }
            case 'setSnapshotRate': {
                // Adapt snapshot interval to actual display refresh rate
                const targetHz = Math.max(1, Math.min(375, msg.rate));
                this.snapshotInterval = Math.max(1, Math.round(this.blockRate / targetHz));
                break;
            }
            case 'reset': {
                this.heights.fill(0);
                this.velocities.fill(0);
                this.newHeights.fill(0);
                this.driven.fill(0);
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
        this.driven = new Uint8Array(this.totalCells);
        this.displayHeights = new Float32Array(this.totalCells);
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
     * Glue-couple actuators to the membrane.
     * Audio sample = sphere center displacement. The sphere's geometric footprint
     * dictates membrane height at contact points. The wave equation is suspended
     * at driven points. Waves radiate from footprint edges via the Laplacian
     * seeing enforced heights as boundary values.
     *
     * Same physics as oneDdemo/coupling-glue.js, extended to 2D.
     */
    _applyGlueCoupling(inputs, sampleIndex) {
        const input = inputs[0];
        if (!input || input.length === 0) return;

        const gs = this.gridSize;
        const stride = this.stride;
        const h = this.heights;
        const v = this.velocities;
        const driven = this.driven;
        const gain = this.actuatorGain;

        // Clear driven flags — footprint may change each sample
        driven.fill(0);

        for (let a = 0; a < this.actuators.length; a++) {
            const act = this.actuators[a];

            // Read displacement from assigned channel
            let displacement;
            if (act.channel === -1) {
                let sum = 0;
                for (let ch = 0; ch < input.length; ch++) {
                    sum += input[ch][sampleIndex];
                }
                displacement = sum / input.length;
            } else {
                const ch = Math.min(act.channel, input.length - 1);
                displacement = input[ch][sampleIndex];
            }

            // Displacement drives a sphere-shaped piston.
            // At rest (displacement=0), ALL footprint points = 0 (flat membrane).
            // Audio moves the sphere up/down; the curvature shapes how the
            // displacement spreads across the footprint.
            //
            // Raw sphere: surfaceHeight = (r + disp*gain) - sqrt(r²-d²)
            // Rest shape: restHeight = r - sqrt(r²-d²)  (dome, >0 at non-center)
            // Corrected:  surfaceHeight = disp*gain + (restHeight subtracted)
            //           = (r + disp*gain) - sqrt(r²-d²) - (r - sqrt(r²-d²))
            //           = disp*gain
            //
            // So with the rest-dome removed, all points move by disp*gain uniformly
            // (flat piston). To keep the sphere curvature shaping the displacement:
            //   surfaceHeight = disp * gain * (sqrt(r²-d²) / r)
            // Center gets full displacement, edges get less. Rest = 0 everywhere.
            const r = act.radius;
            const dispGain = displacement * gain;

            // Numerical velocity: derivative of displacement signal
            const velocity = (dispGain - act.prevSample) * sampleRate;
            act.prevSample = dispGain;

            const { gridX, gridY, offsets, sphereDeltas, count } = act;

            for (let k = 0; k < count; k++) {
                const gi = gridX + offsets[k * 2];
                const gj = gridY + offsets[k * 2 + 1];
                if (gi > 0 && gi < gs && gj > 0 && gj < gs) {
                    const idx = gi * stride + gj;
                    // sphereDeltas[k] = -sqrt(r²-d²), so -delta/r = sqrt(r²-d²)/r
                    // This scales displacement: 1.0 at center, tapering to 0 at edge
                    const sphereScale = -sphereDeltas[k] / r;
                    driven[idx] = 1;
                    h[idx] = dispGain * sphereScale;
                    v[idx] = velocity * sphereScale;
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
        const driven = this.driven;
        const c2 = this.waveSpeed * this.waveSpeed;
        const damp = 1 - this.damping;

        // Interior cells (1..gridSize-1)
        // Skip driven points — their heights are owned by the actuator
        for (let i = 1; i < gs; i++) {
            const rowOff = i * stride;
            for (let j = 1; j < gs; j++) {
                const idx = rowOff + j;
                if (driven[idx]) {
                    nh[idx] = h[idx]; // preserve actuator-set height
                    continue;
                }

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
        const tc = this.totalCells;
        const dh = this.displayHeights;
        const sf = this.smoothFactor;
        const oneMinusSf = 1.0 - sf;

        for (let s = 0; s < blockSize; s++) {
            // 1. Glue-couple actuators — sphere surface IS the membrane
            this._applyGlueCoupling(inputs, s);

            // 2. Step physics one timestep
            this._stepPhysics();

            // 3. Sample collectors → audio output (raw physics, no smoothing)
            this._sampleCollectors(outputs, s);

            // 4. Update display heights.
            //    When smoothFactor >= 0.25, skip smoothing entirely (raw physics).
            //    Otherwise exponential low-pass to reduce visual aliasing.
            const cur = this.heights;
            if (sf >= 0.25) {
                // Near-instant: just copy raw heights
                for (let k = 0; k < tc; k++) { dh[k] = cur[k]; }
            } else {
                for (let k = 0; k < tc; k++) {
                    dh[k] = dh[k] * oneMinusSf + cur[k] * sf;
                }
            }
        }

        // 5. Periodic snapshot — send smoothed display heights, not raw physics
        this.blockCount++;
        if (this.blockCount >= this.snapshotInterval) {
            this.blockCount = 0;
            this.snapshotBuffer.set(dh);
            this.port.postMessage(
                { type: 'snapshot', heights: this.snapshotBuffer.buffer.slice(0) },
            );
        }

        return true; // Keep processor alive
    }
}

registerProcessor('membrane-worklet-processor', MembraneWorkletProcessor);
