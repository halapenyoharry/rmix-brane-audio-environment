/**
 * AudioFileManager.js
 * Manages audio file loading, playlists, and playback
 *
 * Features:
 * - Load single or multiple audio files
 * - Playlist management (add, remove, clear)
 * - Playback control (play, pause, stop, next, previous)
 * - Duration calculation
 * - Stereo channel splitting for analysis
 */

class AudioFileManager {
    constructor(audioContext) {
        this.context = audioContext;
        this.playlist = [];          // Array of {name, url, duration, buffer}
        this.currentIndex = 0;
        this.audioElement = null;
        this.sourceNode = null;
        this.analyserL = null;
        this.analyserR = null;
        this.onTrackChange = null;   // Callback when track changes
        this.isPlaying = false;
    }

    /**
     * Load single file into playlist
     * @param {File} file - File object from input element
     * @returns {number} Index in playlist
     */
    async loadFile(file) {
        const url = URL.createObjectURL(file);
        const duration = await this.getAudioDuration(url);

        this.playlist.push({
            name: file.name,
            url: url,
            duration: duration,
            type: file.type
        });

        return this.playlist.length - 1;
    }

    /**
     * Load multiple files (folder or multi-select)
     * @param {FileList} fileList - Files from input element
     * @returns {Array} Playlist array
     */
    async loadFiles(fileList) {
        const promises = Array.from(fileList).map(f => this.loadFile(f));
        await Promise.all(promises);
        return this.playlist;
    }

    /**
     * Get audio duration without loading full file
     * @param {string} url - Object URL or path
     * @returns {number} Duration in seconds
     */
    async getAudioDuration(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.addEventListener('loadedmetadata', () => {
                resolve(audio.duration);
                audio.src = ''; // Release
            });
            audio.addEventListener('error', (e) => {
                reject(e);
            });
            audio.src = url;
        });
    }

    /**
     * Play specific track by index
     * @param {number} index - Track index (null = current)
     */
    async play(index = null) {
        console.log('[play] function started.');

        console.log(`[play] AudioContext state is: ${this.context.state}`);
        if (this.context.state === 'suspended') {
            console.log('[play] Attempting to resume AudioContext...');
            try {
                await this.context.resume();
                console.log(`[play] AudioContext resumed. New state: ${this.context.state}`);
            } catch (e) {
                console.error('[play] Error resuming AudioContext:', e);
                return; // Stop if we can't resume
            }
        }

        if (index !== null) this.currentIndex = index;

        const track = this.playlist[this.currentIndex];
        if (!track) {
            console.warn('[play] No track in playlist. Aborting.');
            return;
        }
        console.log(`[play] Found track: ${track.name}`);

        if (!this.audioElement) {
            console.log('[play] No audioElement exists. Creating a new one.');
            this.audioElement = new Audio();
            this.setupAudioChain();
        } else {
            console.log('[play] Reusing existing audioElement.');
        }

        console.log(`[play] Setting audio src to: ${track.url}`);
        this.audioElement.src = track.url;

        console.log('[play] Calling audioElement.play()...');
        try {
            await this.audioElement.play();
            console.log('[play] audioElement.play() was successful.');
            this.isPlaying = true;
        } catch (e) {
            console.error('[play] Error calling audioElement.play():', e);
            return;
        }

        if (this.onTrackChange) {
            console.log('[play] Calling onTrackChange callback.');
            this.onTrackChange(track, this.currentIndex);
        }
        console.log('[play] function finished.');
    }

    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.isPlaying = false;
        }
    }

    stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.isPlaying = false;
        }
    }

    next() {
        if (this.playlist.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.play();
    }

    previous() {
        if (this.playlist.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.play();
    }

    /**
     * Setup audio chain: Element → Splitter → Analysers
     * Creates stereo analysis nodes for actuator input
     */
    setupAudioChain() {
        if (!this.sourceNode) {
            this.sourceNode = this.context.createMediaElementSource(this.audioElement);

            const splitter = this.context.createChannelSplitter(2);
            this.analyserL = this.context.createAnalyser();
            this.analyserR = this.context.createAnalyser();

            this.analyserL.fftSize = 256;
            this.analyserR.fftSize = 256;
            this.analyserL.smoothingTimeConstant = 0.3;
            this.analyserR.smoothingTimeConstant = 0.3;

            this.sourceNode.connect(splitter);
            this.sourceNode.connect(this.context.destination);
            splitter.connect(this.analyserL, 0);
            splitter.connect(this.analyserR, 1);
        }
    }

    getCurrentTrack() {
        return this.playlist[this.currentIndex];
    }

    getPlaylist() {
        return this.playlist;
    }

    clearPlaylist() {
        this.stop();
        this.playlist.forEach(track => URL.revokeObjectURL(track.url));
        this.playlist = [];
        this.currentIndex = 0;
    }

    removeTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;

        const track = this.playlist[index];
        URL.revokeObjectURL(track.url);
        this.playlist.splice(index, 1);

        // Adjust current index if needed
        if (this.currentIndex >= index && this.currentIndex > 0) {
            this.currentIndex--;
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioFileManager;
}