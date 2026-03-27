/**
 * ParamBus — Single-owner parameter store for BAE.
 *
 * Replaces window globals (window.waveSpeed, window.damping, etc.)
 * as the authoritative source of truth for membrane parameters.
 *
 * Contract:
 *   - Every parameter has exactly one owner: this bus.
 *   - UI controls write here via set().
 *   - The frame loop reads here via get() and forwards to the worklet.
 *   - Nothing else stores or shadows these values.
 *
 * Architecture contract references:
 *   Rule 2 — Single State Ownership
 *   Rule 3 — Strict Modular Boundaries
 */

const PARAM_DEFAULTS = {
    membrane_wave_speed:    0.3,
    membrane_damping:       0.00265,
    membrane_actuator_gain: 3.0,
    display_smoothing:      0.3,
};

export class ParamBus {
    constructor(defaults = PARAM_DEFAULTS) {
        /** @type {Map<string, number>} */
        this._values = new Map();
        /** @type {Map<string, Set<function>>} */
        this._listeners = new Map();
        /** @type {Map<string, number>} Tracks what was last forwarded to worklet */
        this._lastForwarded = new Map();

        for (const [key, val] of Object.entries(defaults)) {
            this._values.set(key, val);
        }
    }

    /**
     * Get the current value of a parameter.
     * @param {string} id
     * @returns {number|undefined}
     */
    get(id) {
        return this._values.get(id);
    }

    /**
     * Set a parameter value. Fires change listeners if the value changed.
     * @param {string} id
     * @param {number} value
     */
    set(id, value) {
        const prev = this._values.get(id);
        if (prev === value) return;
        this._values.set(id, value);
        const listeners = this._listeners.get(id);
        if (listeners) {
            for (const fn of listeners) {
                try { fn(value, prev, id); } catch (e) { console.error(`ParamBus listener error [${id}]:`, e); }
            }
        }
    }

    /**
     * Subscribe to changes on a parameter.
     * @param {string} id
     * @param {function(number, number, string): void} fn — (newVal, oldVal, id)
     * @returns {function} unsubscribe
     */
    on(id, fn) {
        if (!this._listeners.has(id)) {
            this._listeners.set(id, new Set());
        }
        this._listeners.get(id).add(fn);
        return () => this._listeners.get(id)?.delete(fn);
    }

    /**
     * Check if a parameter changed since the last time forwardToWorklet() read it.
     * Used by the frame loop to avoid spamming the worklet message port.
     * @param {string} id
     * @returns {boolean}
     */
    isDirty(id) {
        return this._values.get(id) !== this._lastForwarded.get(id);
    }

    /**
     * Mark a parameter as forwarded. Called by the frame loop after
     * sending the value to the worklet.
     * @param {string} id
     */
    markForwarded(id) {
        this._lastForwarded.set(id, this._values.get(id));
    }

    /**
     * Bulk read for the frame loop. Returns only changed params since last forward.
     * @returns {Map<string, number>} dirty params
     */
    getDirtyParams() {
        const dirty = new Map();
        for (const [id, val] of this._values) {
            if (val !== this._lastForwarded.get(id)) {
                dirty.set(id, val);
            }
        }
        return dirty;
    }

    /**
     * Mark all current values as forwarded.
     */
    markAllForwarded() {
        for (const [id, val] of this._values) {
            this._lastForwarded.set(id, val);
        }
    }

    /**
     * Bridge: write current values to window globals for legacy code
     * that hasn't been migrated yet. Call this from the frame loop
     * during the transition period. Remove once all consumers read
     * from the bus directly.
     */
    syncToWindowGlobals() {
        window.waveSpeed = this._values.get('membrane_wave_speed');
        window.damping = this._values.get('membrane_damping');
        window.actuatorGain = this._values.get('membrane_actuator_gain');
        window.displaySmoothing = this._values.get('display_smoothing');
    }

    /**
     * Bridge: read window globals into the bus. Use this ONCE at boot
     * to capture any values set by tiles-config.json's legacy slider init,
     * then never again — the bus is the authority after boot.
     */
    syncFromWindowGlobals() {
        if (window.waveSpeed != null) this._values.set('membrane_wave_speed', Number(window.waveSpeed));
        if (window.damping != null) this._values.set('membrane_damping', Number(window.damping));
        if (window.actuatorGain != null) this._values.set('membrane_actuator_gain', Number(window.actuatorGain));
        if (window.displaySmoothing != null) this._values.set('display_smoothing', Number(window.displaySmoothing));
    }
}

/** Singleton instance — import this from anywhere */
export const paramBus = new ParamBus();
