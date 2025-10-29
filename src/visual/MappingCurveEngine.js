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