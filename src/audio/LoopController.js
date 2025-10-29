/**
 * LoopController.js
 * Controls loop regions (in/out points) for live sampling
 *
 * Features:
 * - Set loop start/end points
 * - Enable/disable looping
 * - Jump to loop points
 * - Precise loop monitoring (10ms check interval)
 */

class LoopController {
    constructor(audioElement) {
        this.audio = audioElement;
        this.loopStart = 0;        // Seconds
        this.loopEnd = null;       // Null = end of file
        this.isLooping = false;
        this.updateInterval = null;
    }

    /**
     * Set loop region in seconds
     * @param {number} startSec - Start time
     * @param {number} endSec - End time
     */
    setLoopRegion(startSec, endSec) {
        this.loopStart = Math.max(0, startSec);
        this.loopEnd = endSec;
    }

    /**
     * Enable loop monitoring
     * Checks playback position every 10ms for precision
     */
    enableLoop() {
        if (this.isLooping) return;
        this.isLooping = true;

        this.updateInterval = setInterval(() => {
            if (!this.audio) return;

            const current = this.audio.currentTime;
            const end = this.loopEnd || this.audio.duration;

            // Loop back when reaching end point
            if (current >= end) {
                this.audio.currentTime = this.loopStart;
            }
        }, 10); // Check every 10ms for precision
    }

    /**
     * Disable loop monitoring
     */
    disableLoop() {
        this.isLooping = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.audio.loop = false;
    }

    /**
     * Jump to loop start point
     */
    jumpToStart() {
        if (this.audio) {
            this.audio.currentTime = this.loopStart;
        }
    }

    /**
     * Set in point from current playback position
     */
    setInPoint() {
        if (this.audio) {
            this.loopStart = this.audio.currentTime;
        }
    }

    /**
     * Set out point from current playback position
     */
    setOutPoint() {
        if (this.audio) {
            this.loopEnd = this.audio.currentTime;
        }
    }

    /**
     * Clear loop points to defaults
     */
    clearPoints() {
        this.loopStart = 0;
        this.loopEnd = null;
    }

    /**
     * Get current loop region info
     * @returns {Object} {start, end, duration}
     */
    getRegion() {
        const duration = this.audio ? this.audio.duration : 0;
        return {
            start: this.loopStart,
            end: this.loopEnd || duration,
            duration: (this.loopEnd || duration) - this.loopStart
        };
    }

    /**
     * Cleanup when destroying
     */
    destroy() {
        this.disableLoop();
        this.audio = null;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoopController;
}