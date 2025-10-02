/**
 * Audio Input Interfaces
 * 
 * Provides unified interface for different audio sources:
 * - Web Audio API (browser microphone/system audio)
 * - JACK via zen-jack-bridge WebSocket
 * - Audio file playback
 */

class AudioInterface {
    constructor(coupler) {
        this.coupler = coupler;
        this.isActive = false;
        this.sampleRate = 48000;
    }
    
    start() {
        throw new Error("Subclass must implement start()");
    }
    
    stop() {
        this.isActive = false;
    }
}

/**
 * Web Audio API Interface
 */
class WebAudioInterface extends AudioInterface {
    constructor(coupler, options = {}) {
        super(coupler);
        
        this.audioContext = null;
        this.analyser = null;
        this.processor = null;
        this.source = null;
        
        this.bufferSize = options.bufferSize || 256;
        this.smoothing = options.smoothing || 0.8;
        
        // Processing modes
        this.mode = options.mode || 'instant';  // instant, rms, peak, spectrum
    }
    
    async start() {
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        
        // Create analyser for frequency data
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = this.smoothing;
        
        // Get user media (microphone)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            this.source = this.audioContext.createMediaStreamSource(stream);
            
            // Create script processor for raw samples
            this.processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
            
            // Connect chain
            this.source.connect(this.analyser);
            this.analyser.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            
            // Process audio
            this.processor.onaudioprocess = (e) => this.processAudio(e);
            
            this.isActive = true;
            console.log("Web Audio started successfully");
            
        } catch (error) {
            console.error("Failed to start Web Audio:", error);
            throw error;
        }
    }
    
    processAudio(audioEvent) {
        if (!this.isActive) return;
        
        const inputBuffer = audioEvent.inputBuffer;
        const samples = inputBuffer.getChannelData(0);
        const deltaTime = inputBuffer.length / this.sampleRate;
        
        switch (this.mode) {
            case 'instant':
                // Use most recent sample
                const instantSample = samples[samples.length - 1];
                this.coupler.processAudioSample(instantSample, deltaTime);
                break;
                
            case 'rms':
                // RMS average
                const sum = samples.reduce((acc, val) => acc + val * val, 0);
                const rms = Math.sqrt(sum / samples.length);
                this.coupler.processAudioSample(rms, deltaTime);
                break;
                
            case 'peak':
                // Peak value in buffer
                const peak = Math.max(...samples.map(Math.abs));
                this.coupler.processAudioSample(peak, deltaTime);
                break;
                
            case 'spectrum':
                // Frequency domain processing
                this.processSpectrum(deltaTime);
                break;
        }
    }
    
    processSpectrum(deltaTime) {
        // Get frequency data
        const freqData = new Float32Array(this.analyser.frequencyBinCount);
        this.analyser.getFloatFrequencyData(freqData);
        
        // Find dominant frequency bin
        let maxBin = 0;
        let maxValue = -Infinity;
        
        for (let i = 0; i < freqData.length; i++) {
            if (freqData[i] > maxValue) {
                maxValue = freqData[i];
                maxBin = i;
            }
        }
        
        // Convert bin to frequency
        const binFreq = (maxBin * this.sampleRate) / (this.analyser.fftSize);
        
        // Convert dB to linear
        const linearValue = Math.pow(10, maxValue / 20);
        
        // Process with frequency awareness
        this.coupler.processAudioSample(linearValue, deltaTime);
    }
    
    stop() {
        super.stop();
        
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        if (this.source) {
            this.source.disconnect();
            // Stop all tracks
            if (this.source.mediaStream) {
                this.source.mediaStream.getTracks().forEach(track => track.stop());
            }
            this.source = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
    
    setMode(mode) {
        this.mode = mode;
    }
}

/**
 * JACK Interface via zen-jack-bridge WebSocket
 */
class JackInterface extends AudioInterface {
    constructor(coupler, options = {}) {
        super(coupler);
        
        this.wsUrl = options.wsUrl || 'ws://localhost:8889';
        this.ws = null;
        this.reconnectInterval = 5000;
        this.reconnectTimer = null;
        
        // Buffer for smooth playback
        this.sampleBuffer = [];
        this.bufferSize = options.bufferSize || 256;
    }
    
    start() {
        this.connect();
    }
    
    connect() {
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log("Connected to zen-jack-bridge");
                this.isActive = true;
                
                // Send configuration
                this.ws.send(JSON.stringify({
                    type: 'config',
                    sampleRate: this.sampleRate,
                    channels: 1
                }));
            };
            
            this.ws.onmessage = (event) => {
                this.processJackData(event.data);
            };
            
            this.ws.onerror = (error) => {
                console.error("WebSocket error:", error);
            };
            
            this.ws.onclose = () => {
                console.log("Disconnected from zen-jack-bridge");
                this.isActive = false;
                
                // Auto-reconnect
                if (this.reconnectTimer === null) {
                    this.reconnectTimer = setTimeout(() => {
                        this.reconnectTimer = null;
                        this.connect();
                    }, this.reconnectInterval);
                }
            };
            
        } catch (error) {
            console.error("Failed to connect to JACK:", error);
            throw error;
        }
    }
    
    processJackData(data) {
        if (!this.isActive) return;
        
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'audio') {
                const samples = message.samples;
                const deltaTime = samples.length / this.sampleRate;
                
                // Process each sample
                samples.forEach(sample => {
                    // JACK sends float samples in [-1, 1] range
                    this.coupler.processAudioSample(sample, 1 / this.sampleRate);
                });
                
            } else if (message.type === 'error') {
                console.error("JACK error:", message.message);
            }
            
        } catch (error) {
            console.error("Error processing JACK data:", error);
        }
    }
    
    stop() {
        super.stop();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    // Send audio back to JACK (for feedback loops)
    sendToJack(samples) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'audio',
                samples: samples
            }));
        }
    }
}

/**
 * Audio File Interface
 */
class AudioFileInterface extends AudioInterface {
    constructor(coupler, options = {}) {
        super(coupler);
        
        this.audioContext = null;
        this.source = null;
        this.analyser = null;
        this.processor = null;
    }
    
    async loadFile(file) {
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Read file
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        // Create source
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = audioBuffer;
        
        // Create analyser
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        // Create processor
        this.processor = this.audioContext.createScriptProcessor(256, 1, 1);
        
        // Connect chain
        this.source.connect(this.analyser);
        this.analyser.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        
        // Process audio
        this.processor.onaudioprocess = (e) => {
            const samples = e.inputBuffer.getChannelData(0);
            const deltaTime = samples.length / this.audioContext.sampleRate;
            
            // Process most recent sample
            const sample = samples[samples.length - 1];
            this.coupler.processAudioSample(sample, deltaTime);
        };
    }
    
    start() {
        if (this.source) {
            this.source.start();
            this.isActive = true;
        }
    }
    
    stop() {
        super.stop();
        
        if (this.source) {
            this.source.stop();
            this.source = null;
        }
        
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

/**
 * Audio Interface Manager
 */
class AudioInterfaceManager {
    constructor(coupler) {
        this.coupler = coupler;
        this.currentInterface = null;
        this.interfaces = {
            webAudio: null,
            jack: null,
            file: null
        };
    }
    
    async selectSource(sourceType, options = {}) {
        // Stop current interface
        if (this.currentInterface) {
            this.currentInterface.stop();
        }
        
        // Create and start new interface
        switch (sourceType) {
            case 'microphone':
            case 'webAudio':
                if (!this.interfaces.webAudio) {
                    this.interfaces.webAudio = new WebAudioInterface(this.coupler, options);
                }
                this.currentInterface = this.interfaces.webAudio;
                await this.currentInterface.start();
                break;
                
            case 'jack':
                if (!this.interfaces.jack) {
                    this.interfaces.jack = new JackInterface(this.coupler, options);
                }
                this.currentInterface = this.interfaces.jack;
                this.currentInterface.start();
                break;
                
            case 'file':
                if (!this.interfaces.file) {
                    this.interfaces.file = new AudioFileInterface(this.coupler, options);
                }
                this.currentInterface = this.interfaces.file;
                if (options.file) {
                    await this.currentInterface.loadFile(options.file);
                    this.currentInterface.start();
                }
                break;
                
            default:
                throw new Error(`Unknown audio source: ${sourceType}`);
        }
        
        return this.currentInterface;
    }
    
    stop() {
        if (this.currentInterface) {
            this.currentInterface.stop();
            this.currentInterface = null;
        }
    }
    
    getStatus() {
        return {
            active: this.currentInterface ? this.currentInterface.isActive : false,
            source: this.currentInterface ? this.currentInterface.constructor.name : 'none'
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AudioInterfaceManager,
        WebAudioInterface,
        JackInterface,
        AudioFileInterface
    };
}

if (typeof window !== 'undefined') {
    window.AudioInterfaceManager = AudioInterfaceManager;
    window.WebAudioInterface = WebAudioInterface;
    window.JackInterface = JackInterface;
    window.AudioFileInterface = AudioFileInterface;
}