(function() {
    /**
     * Actuator — drives membrane from audio/demo input
     */
    class Actuator {
        constructor(x, y, channel = 'mono', deps) {
            this.x = x;
            this.y = y;
            this.gridX = Math.round(((y + deps.membraneSize/2) / deps.membraneSize) * deps.gridSize);
            this.gridY = Math.round(((x + deps.membraneSize/2) / deps.membraneSize) * deps.gridSize);
            this.channel = channel;
            this.gain = 1.0;
            this.visual = null;
            this.demoPhase = Math.random() * Math.PI * 2;

            // Visual properties
            this.currentAmplitude = 0;
            this.baseSize = 2.0; // Visual radius
            this.baseColor = new THREE.Color();

            // Assign mapped properties (random size for variety)
            const seed = Math.abs(x * y * 1000);
            const randomSize = 15 + (seed % 35); // 15-50mm range

            if (deps.mapper) {
                const freq = deps.mapper.sizeToFrequency(randomSize);
                const hue = deps.mapper.frequencyToColor(freq);
                this.baseColor.setHSL(hue / 360, 1.0, 0.5);
            } else {
                // Fallback colors if mapper not ready
                if (channel === 'left') this.baseColor.setHex(0xff00ff);
                else if (channel === 'right') this.baseColor.setHex(0x00ffff);
                else this.baseColor.setHex(0xffff00);
            }
        }

        apply(deps) {
            let force = 0;

            if (deps.demoMode) {
                // Demo sine waves
                const time = Date.now() * 0.001;
                force = Math.sin(time * 2 + this.demoPhase) * 2;
            } else if (deps.audioEnabled && deps.leftAudioData && deps.rightAudioData) {
                // Use actual audio samples from correct channel
                let sum = 0;
                let audioData;

                // Select the correct channel data
                if (this.channel === 'left') {
                    audioData = deps.leftAudioData;
                } else if (this.channel === 'right') {
                    audioData = deps.rightAudioData;
                } else {
                    // Mono - mix both channels
                    for (let i = 0; i < deps.leftAudioData.length; i++) {
                        sum += deps.leftAudioData[i] + deps.rightAudioData[i];
                    }
                    const avg = sum / (deps.leftAudioData.length * 2);
                    force = avg * window.actuatorGain;
                    audioData = null;
                }

                // Process single channel (left or right)
                if (audioData) {
                    for (let i = 0; i < audioData.length; i++) {
                        sum += audioData[i];
                    }
                    const avg = sum / audioData.length;
                    force = avg * window.actuatorGain;
                }
            }

            // Store amplitude for visual pulsing (smoothed)
            const targetAmp = Math.abs(force);
            this.currentAmplitude += (targetAmp - this.currentAmplitude) * 0.2;

            // Apply force to membrane as an actuator
            if (this.gridX >= 0 && this.gridX <= deps.gridSize &&
                this.gridY >= 0 && this.gridY <= deps.gridSize) {

                // Height above membrane drives coupling strength (inverse square)
                const memSurface = deps.physics.heights[this.gridX] && deps.physics.heights[this.gridX][this.gridY]
                    ? deps.physics.heights[this.gridX][this.gridY] : 0;
                const height = Math.max(0.5, 2 + memSurface * 0.8);
                const heightGain = 4.0 / (1 + Math.pow(height / 4.0, 2));
                const scaledForce = force * heightGain;

                // Gaussian spread — size drives footprint radius
                const fRadius = Math.max(2, Math.round(this.baseSize * 1.5));
                for (let i = -fRadius; i <= fRadius; i++) {
                    for (let j = -fRadius; j <= fRadius; j++) {
                        const gi = this.gridX + i;
                        const gj = this.gridY + j;
                        if (gi >= 0 && gi <= deps.gridSize && gj >= 0 && gj <= deps.gridSize) {
                            const gaussian = Math.exp(-(i*i + j*j) / (fRadius * fRadius * 0.5));
                            deps.physics.velocities[gi][gj] += scaledForce * gaussian * 0.1;
                        }
                    }
                }

                if (this.visual) {
                    this.updateVisual(deps);
                }
            }
        }

        updateVisual(deps) {
            if (!this.visual) return;

            // Track membrane surface — piston motion
            const memHeight = deps.physics.heights[this.gridX] && deps.physics.heights[this.gridX][this.gridY]
                ? deps.physics.heights[this.gridX][this.gridY] : 0;
            this.visual.position.y = 2 + memHeight * 0.8;

            // Opacity pulses with amplitude
            this.visual.material.opacity = 0.6 + (this.currentAmplitude * 0.4);
        }
    }

    /**
     * Collector — samples membrane to produce audio
     */
    class Collector {
        constructor(x, y, config = {}, deps) {
            this.x = x;
            this.y = y;
            this.gridX = Math.round(((y + deps.membraneSize/2) / deps.membraneSize) * deps.gridSize);
            this.gridY = Math.round(((x + deps.membraneSize/2) / deps.membraneSize) * deps.gridSize);

            // Universal settings
            this.mode = config.mode || 'velocity';
            this.gain = config.gain || 50.0;
            this.name = config.name || 'collector';
            this.channel = config.channel || 'mono';
            this.visual = null;

            // For debugging
            this.lastSample = 0;
            this.peakLevel = 0;
        }

        sample(deps) {
            let signal = 0;

            // Read membrane state based on mode
            if (this.gridX >= 0 && this.gridX <= deps.gridSize &&
                this.gridY >= 0 && this.gridY <= deps.gridSize) {

                switch(this.mode) {
                    case 'displacement':
                        signal = deps.physics.heights[this.gridX][this.gridY];
                        break;
                    case 'velocity':
                        signal = deps.physics.velocities[this.gridX][this.gridY];
                        break;
                    case 'acceleration':
                        // TODO: compute from velocity derivative
                        signal = deps.physics.velocities[this.gridX][this.gridY];
                        break;
                }
            }

            // Apply gain
            signal *= this.gain;

            // Clamp to audio range
            signal = Math.max(-1.0, Math.min(1.0, signal));

            // Track for visualization
            this.lastSample = signal;
            this.peakLevel = Math.max(this.peakLevel * 0.99, Math.abs(signal));

            return signal;
        }
    }

    /**
     * Initialize the actuator/collector management system.
     * Sets up raycaster, click handlers, and owns the arrays of actors.
     */
    function init(scene, camera, membrane, physicsRef, options = {}) {
        const _scene = scene;
        const _camera = camera;
        const _membrane = membrane;
        const _physics = physicsRef;
        const _gridSize = options.gridSize;
        const _membraneSize = options.membraneSize;
        const _updateMiniMembrane = options.updateMiniMembrane || (() => {});
        const _mapper = options.mapper || null;
        const _getWorklet = options.getWorklet || (() => null);

        // Dependencies passed to Actuator/Collector methods
        const deps = {
            gridSize: _gridSize,
            membraneSize: _membraneSize,
            mapper: _mapper,
            physics: _physics,
            demoMode: false,
            audioEnabled: false,
            leftAudioData: null,
            rightAudioData: null
        };

        const actuators = [];
        const collectors = [];

        // Raycaster setup
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // Helper: map render-grid actuator to worklet-grid coords
        // Called internally after add/remove — worklet ref is fetched dynamically
        function syncActuatorsToWorklet() {
            const worklet = _getWorklet();
            if (!worklet) return;
            const scale = worklet.gridSize / _gridSize;
            worklet.setActuators(actuators.map(a => ({
                gridX: Math.round(a.gridX * scale),
                gridY: Math.round(a.gridY * scale),
                radius: Math.max(3, Math.round(a.baseSize * 1.5 * scale)),
                channel: a.channel
            })));
        }

        function syncCollectorsToWorklet() {
            const worklet = _getWorklet();
            if (!worklet) return;
            const scale = worklet.gridSize / _gridSize;
            worklet.setCollectors(collectors.map(c => ({
                gridX: Math.round(c.gridX * scale),
                gridY: Math.round(c.gridY * scale),
                mode: c.mode
            })));
        }

        // Add/clear operations — auto-sync to worklet after each change
        function addActuator(x, y, channel = 'mono') {
            const actuator = new Actuator(x, y, channel, deps);
            actuators.push(actuator);

            // Create sphere visual
            const material = new THREE.MeshBasicMaterial({
                color: actuator.baseColor,
                transparent: true,
                opacity: 0.7
            });

            const indicator = new THREE.Mesh(
                new THREE.SphereGeometry(2, 16, 16),
                material
            );
            indicator.position.set(x, 2, y);
            _scene.add(indicator);
            actuator.visual = indicator;

            _updateMiniMembrane();
            syncActuatorsToWorklet();
            return actuator;
        }

        function addCollector(x, y, config = {}) {
            const collector = new Collector(x, y, config, deps);
            collectors.push(collector);

            // Green wireframe sphere to distinguish from actuators
            const color = config.channel === 'left' ? 0x00ff00 : (config.channel === 'right' ? 0x00ff88 : 0x00ff44);
            const indicator = new THREE.Mesh(
                new THREE.SphereGeometry(1.5, 16, 16),
                new THREE.MeshBasicMaterial({
                    color: color,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.8
                })
            );
            indicator.position.set(x, 4, y);
            _scene.add(indicator);
            collector.visual = indicator;

            _updateMiniMembrane();
            syncCollectorsToWorklet();
            console.log(`Added collector at (${x.toFixed(1)}, ${y.toFixed(1)}) - ${config.channel || 'mono'} - ${config.mode || 'velocity'}`);
            return collector;
        }

        function clearActuators() {
            actuators.forEach(act => {
                if (act.visual) _scene.remove(act.visual);
            });
            actuators.length = 0;
            syncActuatorsToWorklet();
            _updateMiniMembrane();
        }

        function clearCollectors() {
            collectors.forEach(col => {
                if (col.visual) _scene.remove(col.visual);
            });
            collectors.length = 0;
            syncCollectorsToWorklet();
            _updateMiniMembrane();
        }

        // Click handler — raycaster event processing
        function handleClick(event) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, _camera);

            // First check if clicking on actuator or collector to remove
            let clickedSphere = false;

            // Check actuators
            for (let i = actuators.length - 1; i >= 0; i--) {
                if (actuators[i].visual) {
                    const intersects = raycaster.intersectObject(actuators[i].visual);
                    if (intersects.length > 0) {
                        _scene.remove(actuators[i].visual);
                        actuators.splice(i, 1);
                        _updateMiniMembrane();
                        syncActuatorsToWorklet();
                        clickedSphere = true;
                        break;
                    }
                }
            }

            // Check collectors if no actuator was clicked
            if (!clickedSphere) {
                for (let i = collectors.length - 1; i >= 0; i--) {
                    if (collectors[i].visual) {
                        const intersects = raycaster.intersectObject(collectors[i].visual);
                        if (intersects.length > 0) {
                            _scene.remove(collectors[i].visual);
                            collectors.splice(i, 1);
                            _updateMiniMembrane();
                            syncCollectorsToWorklet();
                            clickedSphere = true;
                            break;
                        }
                    }
                }
            }

            // If no sphere clicked, add new one on membrane
            if (!clickedSphere) {
                const intersects = raycaster.intersectObject(_membrane);

                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    let channel = 'mono';
                    if (point.x < -20) channel = 'left';
                    else if (point.x > 20) channel = 'right';

                    // Shift+Click adds collector, regular click adds actuator
                    if (event.shiftKey) {
                        addCollector(point.x, point.z, { channel: channel });
                    } else {
                        addActuator(point.x, point.z, channel);
                    }
                }
            }
        }

        // Visual update from worklet snapshot
        function updateVisualsFromSnapshot(snapshot, workletGridSize, renderGridSize) {
            if (!snapshot) return;

            const ws = workletGridSize;
            const wStride = ws + 1;
            const scale = ws / renderGridSize;

            actuators.forEach(actuator => {
                if (!actuator.visual) return;
                const wi = Math.round(actuator.gridX * scale);
                const wj = Math.round(actuator.gridY * scale);
                if (wi >= 0 && wi <= ws && wj >= 0 && wj <= ws) {
                    const memHeight = snapshot[wi * wStride + wj];
                    const waveH = window.paramBus
                        ? window.paramBus.get('visual_wave_height') || 20.0
                        : 20.0;
                    actuator.visual.position.y = memHeight * waveH;
                }
            });
        }

        // Update runtime dependencies (called from monolith's updateAudioData)
        function updateDeps(runtimeState) {
            deps.demoMode = runtimeState.demoMode;
            deps.audioEnabled = runtimeState.audioEnabled;
            deps.leftAudioData = runtimeState.leftAudioData;
            deps.rightAudioData = runtimeState.rightAudioData;
        }

        // Apply actuators on main thread (fallback when worklet is NOT active)
        function applyActuators() {
            actuators.forEach(actuator => {
                actuator.apply(deps);
            });
        }

        // Sample all collectors for audio output
        function sampleAllCollectors() {
            let left = 0, right = 0;
            collectors.forEach(collector => {
                const sample = collector.sample(deps);
                if (collector.channel === 'left') {
                    left += sample;
                } else if (collector.channel === 'right') {
                    right += sample;
                } else {
                    // Mono - send to both
                    left += sample;
                    right += sample;
                }
            });
            return { left, right };
        }

        // Return public API
        return {
            addActuator,
            addCollector,
            clearActuators,
            clearCollectors,
            handleClick,
            updateVisualsFromSnapshot,
            updateDeps,
            applyActuators,
            sampleAllCollectors,
            getActuators: () => actuators,
            getCollectors: () => collectors
        };
    }

    // Export via window (synchronous, no async timing issues)
    window._actorManager = { init };
})();
