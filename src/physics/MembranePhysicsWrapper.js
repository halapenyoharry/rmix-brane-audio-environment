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