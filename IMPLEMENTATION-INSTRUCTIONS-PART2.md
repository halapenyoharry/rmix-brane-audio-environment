# rmix-BAE Implementation Instructions - Part 2

**Continuation of IMPLEMENTATION-INSTRUCTIONS.md**
**Covers**: Phase 3.3 through Phase 5, complete integration guide

---

## Phase 3 (Continued): Schema Integration

### 3.3 Implement ParameterController.js

**File**: `src/controllers/ParameterController.js`

**Purpose**: Central state hub for all parameters with smoothing, validation, and pub/sub

<details>
<summary>Click to expand ParameterController.js code</summary>

```javascript
/**
 * ParameterController.js
 * Central state hub for all parameters
 *
 * Features:
 * - Get/set parameter values
 * - Parameter smoothing (exponential, linear)
 * - Subscribe to parameter changes (pub/sub)
 * - Validate ranges
 * - Load from session
 */

class ParameterController {
    constructor(session) {
        this.session = session;
        this.parameters = new Map(); // id → parameter object
        this.subscribers = new Map(); // id → Set of callbacks
        this.currentValues = new Map(); // id → current value (after smoothing)
        this.targetValues = new Map(); // id → target value (before smoothing)

        this.loadParameters(session.parameters);
    }

    /**
     * Load parameters from session
     * @param {Object} parametersObj - Nested parameters from session
     */
    loadParameters(parametersObj) {
        Object.values(parametersObj).forEach(group => {
            Object.values(group).forEach(param => {
                this.parameters.set(param.id, param);
                this.currentValues.set(param.id, param.value);
                this.targetValues.set(param.id, param.value);
                this.subscribers.set(param.id, new Set());
            });
        });

        console.log(`Loaded ${this.parameters.size} parameters`);
    }

    /**
     * Get current parameter value (smoothed)
     * @param {string} id - Parameter ID
     * @returns {number|string} Current value
     */
    getValue(id) {
        return this.currentValues.get(id);
    }

    /**
     * Set parameter value (will be smoothed if enabled)
     * @param {string} id - Parameter ID
     * @param {*} value - New value
     * @param {boolean} immediate - Skip smoothing if true
     */
    setValue(id, value, immediate = false) {
        const param = this.parameters.get(id);
        if (!param) {
            console.warn(`Unknown parameter: ${id}`);
            return;
        }

        // Validate range (numeric only)
        if (typeof value === 'number') {
            value = Math.max(param.min, Math.min(param.max, value));
        }

        this.targetValues.set(id, value);

        if (immediate || !param.smoothing || !param.smoothing.enabled) {
            this.currentValues.set(id, value);
            this.notifySubscribers(id, value);
        }
        // Smoothing happens in update()
    }

    /**
     * Update all parameters (call every frame)
     * Applies smoothing to parameters with smoothing enabled
     * @param {number} deltaTimeMs - Time since last update in milliseconds
     */
    update(deltaTimeMs) {
        this.parameters.forEach((param, id) => {
            if (!param.smoothing || !param.smoothing.enabled) {
                return;
            }

            const current = this.currentValues.get(id);
            const target = this.targetValues.get(id);

            if (current === target) return; // Already at target

            let newValue;

            if (param.smoothing.type === 'exponential') {
                // Exponential smoothing: newValue = current + (target - current) * alpha
                // alpha = 1 - exp(-deltaTime / timeConstant)
                const timeConstant = param.smoothing.timeConstant || 100;
                const alpha = 1 - Math.exp(-deltaTimeMs / timeConstant);
                newValue = current + (target - current) * alpha;

                // Snap to target if very close (avoids infinite approach)
                if (Math.abs(newValue - target) < 0.001) {
                    newValue = target;
                }

            } else if (param.smoothing.type === 'linear') {
                // Linear smoothing: fixed rate per second
                const rate = param.smoothing.rate || 1.0; // units per second
                const maxChange = rate * (deltaTimeMs / 1000);
                const diff = target - current;

                if (Math.abs(diff) <= maxChange) {
                    newValue = target;
                } else {
                    newValue = current + Math.sign(diff) * maxChange;
                }
            }

            if (newValue !== current) {
                this.currentValues.set(id, newValue);
                this.notifySubscribers(id, newValue);
            }
        });
    }

    /**
     * Subscribe to parameter changes
     * @param {string} id - Parameter ID
     * @param {Function} callback - Called with (value) when parameter changes
     */
    subscribe(id, callback) {
        if (!this.subscribers.has(id)) {
            this.subscribers.set(id, new Set());
        }
        this.subscribers.get(id).add(callback);
    }

    /**
     * Unsubscribe from parameter changes
     * @param {string} id - Parameter ID
     * @param {Function} callback - Callback to remove
     */
    unsubscribe(id, callback) {
        if (this.subscribers.has(id)) {
            this.subscribers.get(id).delete(callback);
        }
    }

    /**
     * Notify all subscribers of parameter change
     * @param {string} id - Parameter ID
     * @param {*} value - New value
     */
    notifySubscribers(id, value) {
        if (this.subscribers.has(id)) {
            this.subscribers.get(id).forEach(callback => {
                callback(value);
            });
        }
    }

    /**
     * Get parameter metadata
     * @param {string} id - Parameter ID
     * @returns {Object} Parameter object from session
     */
    getParameter(id) {
        return this.parameters.get(id);
    }

    /**
     * Get all parameter IDs
     * @returns {Array<string>}
     */
    getAllParameterIds() {
        return Array.from(this.parameters.keys());
    }

    /**
     * Get parameters by group
     * @param {string} groupName - Group name (e.g., 'membrane', 'visual')
     * @returns {Array<Object>} Array of parameters in group
     */
    getParametersByGroup(groupName) {
        const results = [];
        this.parameters.forEach(param => {
            if (param.group === groupName) {
                results.push(param);
            }
        });
        return results;
    }

    /**
     * Reset parameter to default value
     * @param {string} id - Parameter ID
     */
    resetToDefault(id) {
        const param = this.parameters.get(id);
        if (param) {
            this.setValue(id, param.default, true);
        }
    }

    /**
     * Reset all parameters to defaults
     */
    resetAll() {
        this.parameters.forEach((param, id) => {
            this.setValue(id, param.default, true);
        });
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParameterController;
}
```
</details>

**Testing 3.3**: Create `test-parameter-controller.html`

```html
<!DOCTYPE html>
<html>
<head><title>Test ParameterController</title></head>
<body>
    <h1>ParameterController Test</h1>

    <h2>Wave Speed (with exponential smoothing)</h2>
    <input type="range" id="waveSpeed" min="0.05" max="0.3" step="0.01" value="0.15">
    <span id="waveSpeedValue">0.15</span>

    <h2>Damping (no smoothing)</h2>
    <input type="range" id="damping" min="0.001" max="0.05" step="0.001" value="0.01">
    <span id="dampingValue">0.01</span>

    <button id="reset">Reset All</button>

    <h3>Current Values (smoothed):</h3>
    <pre id="currentValues"></pre>

    <h3>Target Values:</h3>
    <pre id="targetValues"></pre>

    <script src="src/schema/SchemaParser.js"></script>
    <script src="src/controllers/ParameterController.js"></script>
    <script>
        let paramController;

        // Load session and create controller
        (async () => {
            const parser = new SchemaParser();
            const session = await parser.loadSession('./default-session.json');
            paramController = new ParameterController(session);

            // Subscribe to changes
            paramController.subscribe('membrane_wave_speed', (value) => {
                document.getElementById('waveSpeedValue').textContent = value.toFixed(3);
                console.log('Wave speed changed:', value);
            });

            paramController.subscribe('membrane_damping', (value) => {
                document.getElementById('dampingValue').textContent = value.toFixed(4);
                console.log('Damping changed:', value);
            });

            // UI handlers
            document.getElementById('waveSpeed').oninput = (e) => {
                paramController.setValue('membrane_wave_speed', parseFloat(e.target.value));
            };

            document.getElementById('damping').oninput = (e) => {
                paramController.setValue('membrane_damping', parseFloat(e.target.value));
            };

            document.getElementById('reset').onclick = () => {
                paramController.resetAll();
                document.getElementById('waveSpeed').value =
                    paramController.getValue('membrane_wave_speed');
                document.getElementById('damping').value =
                    paramController.getValue('membrane_damping');
            };

            // Animation loop to update smoothing
            let lastTime = performance.now();
            function animate() {
                const now = performance.now();
                const deltaTime = now - lastTime;
                lastTime = now;

                paramController.update(deltaTime);

                // Display current vs target
                document.getElementById('currentValues').textContent =
                    `Wave Speed: ${paramController.getValue('membrane_wave_speed').toFixed(3)}\n` +
                    `Damping: ${paramController.getValue('membrane_damping').toFixed(4)}`;

                document.getElementById('targetValues').textContent =
                    `Wave Speed: ${paramController.targetValues.get('membrane_wave_speed').toFixed(3)}\n` +
                    `Damping: ${paramController.targetValues.get('membrane_damping').toFixed(4)}`;

                requestAnimationFrame(animate);
            }
            animate();

        })();
    </script>
</body>
</html>
```

**Verification**:
- [ ] Load session → parameters initialized
- [ ] Change wave speed → smoothly interpolates to target
- [ ] Change damping → immediately jumps (no smoothing)
- [ ] Reset → returns to defaults
- [ ] Subscribe callbacks fire on changes

### 3.4 Implement MappingCurveEngine.js

**File**: `src/visual/MappingCurveEngine.js`

**Purpose**: Compute derived properties from spatial/visual properties

<details>
<summary>Click to expand MappingCurveEngine.js code</summary>

```javascript
/**
 * MappingCurveEngine.js
 * Computes derived properties from mapping curves
 *
 * Implements curves from schema:
 * - Size → Frequency (power law)
 * - Opacity → Q factor (exponential)
 * - Z-height → Gain (inverse square)
 * - Size → Gaussian spread (linear)
 * - Frequency → Color (logarithmic)
 */

class MappingCurveEngine {
    constructor(session) {
        this.curves = session.mappingCurves || {};
    }

    /**
     * Compute frequency from actuator size
     * @param {number} size_mm - Actuator radius in mm
     * @returns {number} Frequency in Hz
     */
    sizeToFrequency(size_mm) {
        const curve = this.curves.actuator_size_to_frequency;
        if (!curve) return 1000; // Default

        const c = curve.curve;
        const ratio = size_mm / c.size_max_mm;
        const freq = c.freq_max_hz * Math.pow(ratio, c.exponent);

        return Math.max(c.freq_min_hz, Math.min(c.freq_max_hz, freq));
    }

    /**
     * Compute Q factor from opacity
     * @param {number} opacity - Opacity value (0-1)
     * @returns {number} Q factor
     */
    opacityToQ(opacity) {
        const curve = this.curves.actuator_transparency_to_q;
        if (!curve) return 1.0;

        const c = curve.curve;
        const q = c.q_min + (1 - opacity) * (c.q_max - c.q_min);

        return Math.max(c.q_min, Math.min(c.q_max, q));
    }

    /**
     * Compute gain from z-height
     * @param {number} z - Z-height
     * @returns {number} Gain multiplier
     */
    zToGain(z) {
        const curve = this.curves.actuator_z_to_gain;
        if (!curve) return 1.0;

        const c = curve.curve;
        const gain = c.base_gain / (1 + Math.pow(z / c.scale, 2));

        return gain;
    }

    /**
     * Compute Gaussian spread (sigma) from size
     * @param {number} size_mm - Actuator radius in mm
     * @returns {number} Sigma value
     */
    sizeToSpread(size_mm) {
        const curve = this.curves.actuator_gaussian_spread;
        if (!curve) return size_mm;

        const c = curve.curve;
        const sigma = size_mm * c.spread_factor;

        return Math.max(c.sigma_min, Math.min(c.sigma_max, sigma));
    }

    /**
     * Compute color hue from frequency
     * @param {number} freq_hz - Frequency in Hz
     * @returns {number} Hue value (0-360)
     */
    frequencyToColor(freq_hz) {
        const curve = this.curves.frequency_to_color;
        if (!curve) return 200; // Default blue

        const c = curve.curve;
        const logRatio = Math.log10(freq_hz) / Math.log10(c.freq_max_hz);
        const hue = 240 - logRatio * 240;

        return Math.max(0, Math.min(360, hue));
    }

    /**
     * Get all computed properties for an actuator
     * @param {Object} actuator - Actuator object with position, size, appearance
     * @returns {Object} Computed properties
     */
    computeActuatorProperties(actuator) {
        const size_mm = actuator.size.radius_mm;
        const opacity = actuator.appearance.opacity;
        const z = actuator.position.z;

        return {
            frequency: this.sizeToFrequency(size_mm),
            qFactor: this.opacityToQ(opacity),
            gain: this.zToGain(z),
            sigma: this.sizeToSpread(size_mm),
            hue: this.frequencyToColor(this.sizeToFrequency(size_mm))
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MappingCurveEngine;
}
```
</details>

**Testing 3.4**: Create `test-mapping-curves.html`

```html
<!DOCTYPE html>
<html>
<head><title>Test MappingCurveEngine</title></head>
<body>
    <h1>MappingCurveEngine Test</h1>

    <h2>Size → Frequency</h2>
    <label>Size (mm): <input type="range" id="size" min="2" max="50" value="15"></label>
    <span id="sizeVal">15</span>mm →
    <span id="freqVal">?</span>Hz

    <h2>Opacity → Q Factor</h2>
    <label>Opacity: <input type="range" id="opacity" min="0.1" max="1" step="0.1" value="0.7"></label>
    <span id="opacityVal">0.7</span> →
    <span id="qVal">?</span>

    <h2>Z-Height → Gain</h2>
    <label>Z: <input type="range" id="z" min="0" max="20" value="5"></label>
    <span id="zVal">5</span> →
    <span id="gainVal">?</span>x

    <h2>Frequency → Color</h2>
    <span id="colorVal">?</span>° hue
    <div id="colorBox" style="width:100px;height:50px;border:1px solid #fff;"></div>

    <h3>Full Actuator Properties:</h3>
    <pre id="fullProps"></pre>

    <script src="src/schema/SchemaParser.js"></script>
    <script src="src/visual/MappingCurveEngine.js"></script>
    <script>
        let mapper;

        (async () => {
            const parser = new SchemaParser();
            const session = await parser.loadSession('./default-session.json');
            mapper = new MappingCurveEngine(session);

            function update() {
                const size = parseFloat(document.getElementById('size').value);
                const opacity = parseFloat(document.getElementById('opacity').value);
                const z = parseFloat(document.getElementById('z').value);

                // Individual curves
                const freq = mapper.sizeToFrequency(size);
                const q = mapper.opacityToQ(opacity);
                const gain = mapper.zToGain(z);
                const hue = mapper.frequencyToColor(freq);

                document.getElementById('sizeVal').textContent = size;
                document.getElementById('freqVal').textContent = freq.toFixed(1);

                document.getElementById('opacityVal').textContent = opacity;
                document.getElementById('qVal').textContent = q.toFixed(2);

                document.getElementById('zVal').textContent = z;
                document.getElementById('gainVal').textContent = gain.toFixed(3);

                document.getElementById('colorVal').textContent = hue.toFixed(0);
                document.getElementById('colorBox').style.backgroundColor =
                    `hsl(${hue}, 100%, 50%)`;

                // Full actuator
                const actuator = {
                    position: { x: 0, y: 0, z: z },
                    size: { radius_mm: size },
                    appearance: { opacity: opacity }
                };

                const props = mapper.computeActuatorProperties(actuator);
                document.getElementById('fullProps').textContent =
                    JSON.stringify(props, null, 2);
            }

            document.getElementById('size').oninput = update;
            document.getElementById('opacity').oninput = update;
            document.getElementById('z').oninput = update;

            update();
        })();
    </script>
</body>
</html>
```

**Verification**:
- [ ] Size slider → frequency changes (inverse relationship)
- [ ] Opacity slider → Q factor changes
- [ ] Z slider → gain decreases with distance
- [ ] Color updates based on frequency (low=red, high=blue)
- [ ] Full actuator properties computed correctly

### 3.5 Refactor Membrane Physics into Module

**File**: `src/physics/MembranePhysicsWrapper.js`

**Purpose**: Wrapper for existing `membrane-physics-core.js` that loads from session

**Note**: DO NOT modify `membrane-physics-core.js` - it's optimized and stable. Just wrap it.

<details>
<summary>Click to expand MembranePhysicsWrapper.js code</summary>

```javascript
/**
 * MembranePhysicsWrapper.js
 * Wrapper for membrane-physics-core.js that integrates with schema
 *
 * Features:
 * - Initialize from session parameters
 * - Connect to ParameterController
 * - Provide simplified API
 */

class MembranePhysicsWrapper {
    constructor(session, parameterController) {
        this.session = session;
        this.params = parameterController;
        this.membrane = null;

        this.init();
    }

    /**
     * Initialize membrane physics from session
     */
    init() {
        // Get parameters from controller
        const waveSpeed = this.params.getValue('membrane_wave_speed');
        const damping = this.params.getValue('membrane_damping');

        // Create membrane instance (assumes membrane-physics-core.js is loaded)
        if (typeof MembranePhysics === 'undefined') {
            throw new Error('MembranePhysics not loaded - include membrane-physics-core.js');
        }

        this.membrane = new MembranePhysics({
            gridSize: 128,  // Could come from session if needed
            waveSpeed: waveSpeed,
            damping: damping,
            boundaryType: 'fixed'
        });

        // Subscribe to parameter changes
        this.params.subscribe('membrane_wave_speed', (value) => {
            this.membrane.setWaveSpeed(value);
        });

        this.params.subscribe('membrane_damping', (value) => {
            this.membrane.setDamping(value);
        });

        console.log('Membrane physics initialized');
    }

    /**
     * Update physics simulation
     * @param {number} deltaTime - Time step (usually fixed)
     */
    update(deltaTime = 16.67) {
        if (this.membrane) {
            this.membrane.update(deltaTime);
        }
    }

    /**
     * Apply force at grid position
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @param {number} force - Force magnitude
     */
    applyForce(gridX, gridY, force) {
        if (this.membrane) {
            this.membrane.applyForce(gridX, gridY, force);
        }
    }

    /**
     * Get velocity at grid position (for collectors)
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @returns {number} Velocity value
     */
    getVelocity(gridX, gridY) {
        if (this.membrane) {
            return this.membrane.getVelocity(gridX, gridY);
        }
        return 0;
    }

    /**
     * Get height data for visualization
     * @returns {Float32Array} Height field
     */
    getHeightData() {
        if (this.membrane) {
            return this.membrane.getHeightData();
        }
        return null;
    }

    /**
     * Reset membrane to flat state
     */
    reset() {
        if (this.membrane) {
            this.membrane.reset();
        }
    }

    /**
     * Get current physics parameters
     * @returns {Object} Current parameters
     */
    getParameters() {
        return {
            waveSpeed: this.params.getValue('membrane_wave_speed'),
            damping: this.params.getValue('membrane_damping'),
            actuatorGain: this.params.getValue('membrane_actuator_gain')
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MembranePhysicsWrapper;
}
```
</details>

**Testing 3.5**: Integrate into existing HTML test (requires full membrane-physics-core.js)

### Phase 3 Completion Checklist

- [ ] `src/` directory structure created
- [ ] `default-session.json` updated with audio sources
- [ ] `SchemaParser.js` implemented and tested
- [ ] `ParameterController.js` implemented and tested
- [ ] `MappingCurveEngine.js` implemented and tested
- [ ] `MembranePhysicsWrapper.js` created
- [ ] All test files pass
- [ ] No console errors

**When Phase 3 complete**: Commit, update TODO, move to Phase 4

---

## Phase 4: UI Components (3-4 hours)

**Status**: PENDING
**Goal**: Create playback controls and loop region UI

### 4.1 Implement PlaybackControls.js

**File**: `src/ui/PlaybackControls.js`

<details>
<summary>Click to expand PlaybackControls.js code</summary>

```javascript
/**
 * PlaybackControls.js
 * Playback UI: Play/Pause/Stop/Next/Previous/Load Files
 *
 * Features:
 * - Playback transport controls
 * - File loading dialog
 * - Track info display
 * - Playlist visualization
 */

class PlaybackControls {
    constructor(containerElement, audioFileManager) {
        this.container = containerElement;
        this.manager = audioFileManager;

        this.playBtn = null;
        this.pauseBtn = null;
        this.stopBtn = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.loadBtn = null;
        this.trackInfo = null;

        this.render();
        this.setupCallbacks();
    }

    /**
     * Render UI elements
     */
    render() {
        this.container.innerHTML = `
            <div class="playback-controls" style="
                display: flex;
                gap: 8px;
                align-items: center;
                padding: 12px;
                background: rgba(10, 14, 39, 0.8);
                border: 1px solid rgba(0, 229, 255, 0.3);
                border-radius: 8px;
                font-family: 'JetBrains Mono', monospace;
                color: #00e5ff;
            ">
                <button id="pb-load" style="
                    width: 40px;
                    height: 40px;
                    font-size: 20px;
                    background: rgba(255, 136, 0, 0.3);
                    border: 1px solid #ff8800;
                    border-radius: 4px;
                    color: #ff8800;
                    cursor: pointer;
                ">📁</button>

                <button id="pb-prev" style="
                    width: 40px;
                    height: 40px;
                    font-size: 16px;
                    background: rgba(0, 229, 255, 0.2);
                    border: 1px solid #00e5ff;
                    border-radius: 4px;
                    color: #00e5ff;
                    cursor: pointer;
                ">⏮</button>

                <button id="pb-play" style="
                    width: 40px;
                    height: 40px;
                    font-size: 16px;
                    background: rgba(0, 255, 0, 0.2);
                    border: 1px solid #00ff00;
                    border-radius: 4px;
                    color: #00ff00;
                    cursor: pointer;
                ">▶</button>

                <button id="pb-pause" style="
                    width: 40px;
                    height: 40px;
                    font-size: 16px;
                    background: rgba(255, 255, 0, 0.2);
                    border: 1px solid #ffff00;
                    border-radius: 4px;
                    color: #ffff00;
                    cursor: pointer;
                ">⏸</button>

                <button id="pb-stop" style="
                    width: 40px;
                    height: 40px;
                    font-size: 16px;
                    background: rgba(255, 0, 0, 0.2);
                    border: 1px solid #ff0000;
                    border-radius: 4px;
                    color: #ff0000;
                    cursor: pointer;
                ">⏹</button>

                <button id="pb-next" style="
                    width: 40px;
                    height: 40px;
                    font-size: 16px;
                    background: rgba(0, 229, 255, 0.2);
                    border: 1px solid #00e5ff;
                    border-radius: 4px;
                    color: #00e5ff;
                    cursor: pointer;
                ">⏭</button>

                <div id="pb-track-info" style="
                    flex: 1;
                    padding: 0 12px;
                    font-size: 12px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                ">No file loaded</div>
            </div>
        `;

        // Get element references
        this.loadBtn = document.getElementById('pb-load');
        this.prevBtn = document.getElementById('pb-prev');
        this.playBtn = document.getElementById('pb-play');
        this.pauseBtn = document.getElementById('pb-pause');
        this.stopBtn = document.getElementById('pb-stop');
        this.nextBtn = document.getElementById('pb-next');
        this.trackInfo = document.getElementById('pb-track-info');

        // Add hover effects
        const buttons = [this.loadBtn, this.prevBtn, this.playBtn, this.pauseBtn, this.stopBtn, this.nextBtn];
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'scale(1.1)';
                btn.style.boxShadow = '0 0 10px currentColor';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = 'none';
            });
        });
    }

    /**
     * Setup event callbacks
     */
    setupCallbacks() {
        this.loadBtn.onclick = () => this.openFileDialog();
        this.playBtn.onclick = () => this.manager.play();
        this.pauseBtn.onclick = () => this.manager.pause();
        this.stopBtn.onclick = () => this.manager.stop();
        this.prevBtn.onclick = () => this.manager.previous();
        this.nextBtn.onclick = () => this.manager.next();

        // Track change callback
        this.manager.onTrackChange = (track, index) => {
            this.updateTrackInfo(track, index);
        };
    }

    /**
     * Open file selection dialog
     */
    openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.multiple = true;

        input.onchange = async (e) => {
            await this.manager.loadFiles(e.target.files);
            this.manager.play(0); // Auto-play first track
        };

        input.click();
    }

    /**
     * Update track info display
     * @param {Object} track - Current track
     * @param {number} index - Track index
     */
    updateTrackInfo(track, index) {
        const total = this.manager.playlist.length;
        const duration = this.formatTime(track.duration);

        this.trackInfo.textContent =
            `${index + 1}/${total}: ${track.name} [${duration}]`;
    }

    /**
     * Format time in seconds to MM:SS
     * @param {number} seconds
     * @returns {string}
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Update play/pause button states
     */
    updateButtonStates() {
        if (this.manager.isPlaying) {
            this.playBtn.style.opacity = '0.5';
            this.pauseBtn.style.opacity = '1.0';
        } else {
            this.playBtn.style.opacity = '1.0';
            this.pauseBtn.style.opacity = '0.5';
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaybackControls;
}
```
</details>

**Testing 4.1**: Add to main HTML or create test file

### 4.2 Implement LoopRegionUI.js

**File**: `src/ui/LoopRegionUI.js`

**Purpose**: Visual waveform with draggable in/out markers

<details>
<summary>Click to expand LoopRegionUI.js code (long)</summary>

```javascript
/**
 * LoopRegionUI.js
 * Waveform display with draggable loop markers
 *
 * Features:
 * - Waveform visualization
 * - Draggable in/out markers
 * - Playhead indicator
 * - Seek by clicking
 * - Keyboard shortcuts (I/O/L)
 */

class LoopRegionUI {
    constructor(canvasElement, audioElement, loopController) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.audio = audioElement;
        this.loop = loopController;

        this.waveformData = null;
        this.isDraggingIn = false;
        this.isDraggingOut = false;
        this.isDraggingPlayhead = false;

        this.markerRadius = 5;
        this.colors = {
            background: '#0a0e27',
            waveform: '#00e5ff',
            loopRegion: 'rgba(255, 0, 255, 0.1)',
            inMarker: '#00ff00',
            outMarker: '#ff0000',
            playhead: '#ffffff'
        };

        this.setupInteraction();
        this.setupKeyboard();
    }

    /**
     * Load waveform from audio buffer
     * @param {AudioBuffer} audioBuffer - Decoded audio buffer
     */
    async loadWaveform(audioBuffer) {
        const samples = audioBuffer.getChannelData(0);
        const width = this.canvas.width;
        const step = Math.floor(samples.length / width);

        this.waveformData = new Float32Array(width);

        for (let i = 0; i < width; i++) {
            const start = i * step;
            const end = start + step;
            let sum = 0;
            let count = 0;

            for (let j = start; j < end && j < samples.length; j++) {
                sum += Math.abs(samples[j]);
                count++;
            }

            this.waveformData[i] = count > 0 ? sum / count : 0;
        }

        console.log('Waveform loaded');
    }

    /**
     * Draw waveform, loop region, and markers
     */
    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, w, h);

        if (!this.audio || !this.audio.duration) return;

        const duration = this.audio.duration;
        const region = this.loop.getRegion();

        // Calculate positions
        const inX = (region.start / duration) * w;
        const outX = (region.end / duration) * w;
        const playheadX = (this.audio.currentTime / duration) * w;

        // Draw loop region highlight
        ctx.fillStyle = this.colors.loopRegion;
        ctx.fillRect(inX, 0, outX - inX, h);

        // Draw waveform
        if (this.waveformData) {
            ctx.strokeStyle = this.colors.waveform;
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let i = 0; i < this.waveformData.length; i++) {
                const x = i;
                const amp = this.waveformData[i];
                const y = h / 2 - (amp * h / 2);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Draw mirrored (bottom half)
            ctx.beginPath();
            for (let i = 0; i < this.waveformData.length; i++) {
                const x = i;
                const amp = this.waveformData[i];
                const y = h / 2 + (amp * h / 2);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Draw center line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Draw in marker (green)
        this.drawMarker(inX, this.colors.inMarker, 'IN');

        // Draw out marker (red)
        this.drawMarker(outX, this.colors.outMarker, 'OUT');

        // Draw playhead (white)
        ctx.strokeStyle = this.colors.playhead;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();

        // Draw time labels
        this.drawTimeLabel(region.start, inX, 20);
        this.drawTimeLabel(region.end, outX, 20);
        this.drawTimeLabel(this.audio.currentTime, playheadX, h - 10);
    }

    /**
     * Draw a loop marker
     * @param {number} x - X position
     * @param {string} color - Marker color
     * @param {string} label - Label text
     */
    drawMarker(x, color, label) {
        const ctx = this.ctx;
        const h = this.canvas.height;

        // Vertical line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        // Circle at top
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, 10, this.markerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = color;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, h - 5);
    }

    /**
     * Draw time label
     * @param {number} timeSec - Time in seconds
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawTimeLabel(timeSec, x, y) {
        const ctx = this.ctx;
        const mins = Math.floor(timeSec / 60);
        const secs = (timeSec % 60).toFixed(1);
        const label = `${mins}:${secs.padStart(4, '0')}`;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y);
    }

    /**
     * Setup mouse/touch interaction
     */
    setupInteraction() {
        // Mouse down
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const timeSec = (x / this.canvas.width) * this.audio.duration;

            const region = this.loop.getRegion();
            const inX = (region.start / this.audio.duration) * this.canvas.width;
            const outX = (region.end / this.audio.duration) * this.canvas.width;

            // Check if clicking near markers
            if (Math.abs(x - inX) < 10) {
                this.isDraggingIn = true;
            } else if (Math.abs(x - outX) < 10) {
                this.isDraggingOut = true;
            } else {
                // Seek to position
                this.audio.currentTime = timeSec;
            }
        });

        // Mouse move
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDraggingIn && !this.isDraggingOut) return;

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const timeSec = (x / this.canvas.width) * this.audio.duration;

            if (this.isDraggingIn) {
                this.loop.loopStart = Math.max(0, Math.min(timeSec, this.loop.loopEnd || this.audio.duration));
            } else if (this.isDraggingOut) {
                this.loop.loopEnd = Math.max(this.loop.loopStart, Math.min(timeSec, this.audio.duration));
            }
        });

        // Mouse up
        this.canvas.addEventListener('mouseup', () => {
            this.isDraggingIn = false;
            this.isDraggingOut = false;
        });

        // Mouse leave
        this.canvas.addEventListener('mouseleave', () => {
            this.isDraggingIn = false;
            this.isDraggingOut = false;
        });

        // Cursor style
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDraggingIn || this.isDraggingOut) return;

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;

            const region = this.loop.getRegion();
            const inX = (region.start / this.audio.duration) * this.canvas.width;
            const outX = (region.end / this.audio.duration) * this.canvas.width;

            if (Math.abs(x - inX) < 10 || Math.abs(x - outX) < 10) {
                this.canvas.style.cursor = 'ew-resize';
            } else {
                this.canvas.style.cursor = 'pointer';
            }
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Only if not typing in input
            if (e.target.tagName === 'INPUT') return;

            if (e.key === 'i' || e.key === 'I') {
                this.loop.setInPoint();
                console.log('Loop in point set:', this.loop.loopStart.toFixed(2));
            }

            if (e.key === 'o' || e.key === 'O') {
                this.loop.setOutPoint();
                console.log('Loop out point set:', this.loop.loopEnd.toFixed(2));
            }

            if (e.key === 'l' || e.key === 'L') {
                if (this.loop.isLooping) {
                    this.loop.disableLoop();
                    console.log('Loop disabled');
                } else {
                    this.loop.enableLoop();
                    console.log('Loop enabled');
                }
            }
        });
    }

    /**
     * Update and redraw (call in animation loop)
     */
    update() {
        this.draw();
    }

    /**
     * Resize canvas (call on window resize)
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        // Will need to reload waveform if size changes significantly
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoopRegionUI;
}
```
</details>

**Testing 4.2**: Create test HTML with waveform loading

### Phase 4 Completion Checklist

- [ ] `PlaybackControls.js` implemented and styled
- [ ] `LoopRegionUI.js` implemented with full interaction
- [ ] Both components tested independently
- [ ] Keyboard shortcuts work (I/O/L)
- [ ] Visual feedback is clear
- [ ] Ready to integrate into main app

**When Phase 4 complete**: Commit, update TODO, move to Phase 5

---

## Phase 5: OSC Integration (3-4 hours)

**Status**: PENDING
**Goal**: Add OSC control layer (optional, after core features work)

### 5.1 Add OSC Schema Extension

**Add to `default-session.json`** (at root level):

```json
{
  "osc": {
    "enabled": false,
    "transport": "websocket",
    "config": {
      "wsPort": 8080,
      "inPort": 8000,
      "outPort": 9000
    },
    "mappings": [
      {
        "address": "/membrane/wave_speed",
        "parameterId": "membrane_wave_speed",
        "direction": "bidirectional",
        "range": [0.05, 0.8]
      },
      {
        "address": "/membrane/damping",
        "parameterId": "membrane_damping",
        "direction": "bidirectional",
        "range": [0.001, 0.05]
      },
      {
        "address": "/playback/play",
        "action": "play",
        "direction": "in"
      },
      {
        "address": "/playback/pause",
        "action": "pause",
        "direction": "in"
      },
      {
        "address": "/playback/next",
        "action": "next",
        "direction": "in"
      },
      {
        "address": "/collector/*/level",
        "source": "collector_levels",
        "direction": "out",
        "updateRate": 60
      }
    ]
  }
}
```

### 5.2 Include osc.js Library

**Download**: https://github.com/acolyer/osc.js/releases

```bash
cd ~/Projects/rmix-brane-audio-environment/assets
# Download osc.js browser build
curl -L -o osc-browser.min.js \
  https://unpkg.com/osc@2.4.3/dist/osc-browser.min.js
```

Or include via CDN in HTML:
```html
<script src="https://unpkg.com/osc@2.4.3/dist/osc-browser.min.js"></script>
```

### 5.3 Implement OSCController.js

(Code provided in IMPLEMENTATION-INSTRUCTIONS.md Phase 5.3)

### 5.4 Optional: WebSocket↔UDP Bridge

**File**: `osc-bridge.js` (Node.js, optional)

```javascript
#!/usr/bin/env node
const WebSocket = require('ws');
const osc = require('osc');

const wss = new WebSocket.Server({ port: 8080 });
const udpPort = new osc.UDPPort({
    localAddress: '0.0.0.0',
    localPort: 8000,
    remoteAddress: '127.0.0.1',
    remotePort: 9000,
    metadata: true
});

wss.on('connection', (ws) => {
    console.log('Browser connected via WebSocket');

    // WebSocket → UDP
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            udpPort.send(msg);
        } catch (e) {
            console.error('Invalid OSC message from browser:', e);
        }
    });

    // UDP → WebSocket
    udpPort.on('message', (msg) => {
        ws.send(JSON.stringify(msg));
    });

    ws.on('close', () => {
        console.log('Browser disconnected');
    });
});

udpPort.open();
console.log('OSC WebSocket↔UDP Bridge Running');
console.log('  WebSocket: ws://localhost:8080');
console.log('  UDP In: 0.0.0.0:8000');
console.log('  UDP Out: 127.0.0.1:9000');
```

**Usage**:
```bash
npm install ws osc
node osc-bridge.js
```

### Phase 5 Completion Checklist

- [ ] OSC schema added to default-session.json
- [ ] osc.js library included (browser build)
- [ ] `OSCController.js` implemented
- [ ] OSC enabled/disabled toggle works
- [ ] Parameter changes send OSC out
- [ ] Incoming OSC updates parameters
- [ ] Optional bridge tested (if using UDP devices)

**When Phase 5 complete**: Full system is done!

---

## Final Integration & Testing

### Integration Checklist

**Combine all modules into main HTML:**

1. Create `index.html` (new main file) or update `brane-with-collectors-websocket.html`
2. Include all scripts in order:
   ```html
   <!-- Core libraries -->
   <script src="assets/three.min.js"></script>
   <script src="assets/d3.v7.min.js"></script>
   <script src="membrane-physics-core.js"></script>

   <!-- Audio modules -->
   <script src="src/audio/AudioFileManager.js"></script>
   <script src="src/audio/LoopController.js"></script>
   <script src="src/audio/MicrophoneInput.js"></script>
   <script src="src/audio/AudioSourceRouter.js"></script>

   <!-- Schema & Controllers -->
   <script src="src/schema/SchemaParser.js"></script>
   <script src="src/controllers/ParameterController.js"></script>

   <!-- Visual -->
   <script src="src/visual/MappingCurveEngine.js"></script>

   <!-- UI -->
   <script src="src/ui/PlaybackControls.js"></script>
   <script src="src/ui/LoopRegionUI.js"></script>

   <!-- OSC (optional) -->
   <script src="assets/osc-browser.min.js"></script>
   <script src="src/controllers/OSCController.js"></script>
   ```

3. Initialize system:
   ```javascript
   async function init() {
       // Load session
       const parser = new SchemaParser();
       const session = await parser.loadSession('./default-session.json');

       // Create controllers
       const audioContext = new AudioContext();
       const paramCtrl = new ParameterController(session);
       const mapper = new MappingCurveEngine(session);
       const router = new AudioSourceRouter();

       // Create audio sources
       const fileManager = new AudioFileManager(audioContext);
       const mic = new MicrophoneInput(audioContext);

       router.registerSource('file', fileManager);
       router.registerSource('mic', mic);

       // Create UI
       const playbackControls = new PlaybackControls(
           document.getElementById('playback-container'),
           fileManager
       );

       const loopUI = new LoopRegionUI(
           document.getElementById('waveform-canvas'),
           fileManager.audioElement,
           new LoopController(fileManager.audioElement)
       );

       // Animation loop
       function animate() {
           const deltaTime = clock.getDelta() * 1000;

           paramCtrl.update(deltaTime);
           router.updateAudioData();
           membrane.update();
           loopUI.update();

           renderer.render(scene, camera);
           requestAnimationFrame(animate);
       }
       animate();
   }

   init();
   ```

### End-to-End Testing

**Test flow**:
1. Open browser → no console errors
2. Load files → playlist appears
3. Play → audio plays, actuators respond
4. Set loop points → loops correctly
5. Switch to mic → mic input drives membrane
6. Adjust parameters → membrane responds smoothly
7. Place actuators → audio drives membrane
8. Place collectors → samples membrane, outputs audio
9. Save session → downloads JSON
10. Load session → restores state

### Performance Verification

**Benchmarks**:
- FPS: Should maintain 60fps
- Membrane physics: <5% CPU
- Audio processing: <2% CPU
- Total system: <10% CPU on modern hardware

**If performance issues**:
- Reduce membrane grid size
- Disable expensive visual effects
- Lower parameter smoothing update rate

---

## AI Assistant Handoff Instructions

**When picking up this project:**

1. **Read these files first**:
   - `IMPLEMENTATION-INSTRUCTIONS.md` (this file)
   - `IMPLEMENTATION-INSTRUCTIONS-PART2.md` (phases 3-5)
   - `CLAUDE.md` (project context)

2. **Check current status**:
   - Look for checkboxes in this file
   - Run `git log --oneline -10` to see recent commits
   - Check `git status` for uncommitted changes

3. **Resume work**:
   - Update TODO list with TodoWrite tool
   - Start from first unchecked item
   - Test previous phase before continuing

4. **If stuck**:
   - Check `BLOCKERS.md` for known issues
   - Read relevant test file for examples
   - Ask Harold for clarification

5. **Before finishing session**:
   - Update checkboxes in this file
   - Commit if milestone reached
   - Update TODO for next session

---

## Quick Command Reference

```bash
# Start local server
cd ~/Projects/rmix-brane-audio-environment
python3 -m http.server 8000

# Open in browser
firefox http://localhost:8000/index.html

# Run tests
firefox http://localhost:8000/test-audio-file-manager.html
firefox http://localhost:8000/test-parameter-controller.html

# Check for errors
# Open browser console (F12)

# Commit progress
git add .
git commit -m "Phase X: Description"

# Save session
# Use Ctrl+S in browser when session save is implemented
```

---

**END OF IMPLEMENTATION INSTRUCTIONS PART 2**

Harry: Follow these instructions sequentially. Test after each phase. Ask if anything is unclear.

AI: Start with Phase 1 line-by-line edits, then proceed through phases 2-5 as described.
