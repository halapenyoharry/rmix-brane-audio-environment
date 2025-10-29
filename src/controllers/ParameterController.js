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