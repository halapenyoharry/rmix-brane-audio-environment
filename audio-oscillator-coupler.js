/**
 * Audio-Oscillator Coupler
 * 
 * Implements physically accurate speaker driver model to couple
 * audio signals to mechanical oscillators.
 * 
 * Based on Thiele-Small parameters and electromagnetic transduction.
 * Audio voltage → Current → Lorentz force → Mechanical motion
 */

class AudioOscillatorCoupler {
    constructor(oscillator, driverType = 'fullrange') {
        // The oscillator we're driving
        this.oscillator = oscillator;
        
        // Physical ball determines mass and damping
        this.physicalBall = new PhysicalBall({
            radius: 0.02,  // Start at 2cm
            material: 'rubber'
        });
        
        // Speaker driver parameters (Thiele-Small)
        this.loadDriverPreset(driverType);
        
        // Amplifier model
        this.amplifierGain = 20;  // Voltage gain
        this.maxVoltage = 50;     // Rail voltage
        this.maxCurrent = 5;      // Current limit (protection)
        
        // Audio processing state
        this.sampleRate = 48000;
        this.currentSample = 0;
        this.previousSample = 0;
        
        // Frequency analysis
        this.fftSize = 2048;
        this.frequencyBins = new Float32Array(this.fftSize / 2);
        
        // EQ bands for frequency-selective driving
        this.eqBands = {
            sub: { center: 31.5, gain: 1.0, Q: 0.7 },
            bass: { center: 100, gain: 1.0, Q: 0.7 },
            lowMid: { center: 400, gain: 1.0, Q: 0.7 },
            mid: { center: 1000, gain: 1.0, Q: 0.7 },
            highMid: { center: 3000, gain: 1.0, Q: 0.7 },
            presence: { center: 6000, gain: 1.0, Q: 0.7 },
            treble: { center: 10000, gain: 1.0, Q: 0.7 },
            air: { center: 16000, gain: 1.0, Q: 0.7 }
        };
        
        // Interactive control parameters
        this.stereoBalance = 0;      // -1 (left) to +1 (right)
        this.distanceFromOrigin = 1;  // Coupling strength multiplier
        
        // Telemetry
        this.metrics = {
            instantPower: 0,
            averagePower: 0,
            peakCurrent: 0,
            temperature: 25,  // Celsius
            totalEnergy: 0,
            impedance: 8
        };
    }
    
    /**
     * Load driver preset (speaker type)
     */
    loadDriverPreset(type) {
        const presets = {
            subwoofer: {
                Bl: 20,          // Tesla-meters (strong motor)
                Re: 4,           // Ohms (DC resistance)
                Le: 0.002,       // Henries (inductance)
                Mms: 0.1,        // kg (moving mass)
                Cms: 0.001,      // m/N (compliance)
                Rms: 3.0,        // N·s/m (mechanical resistance)
                fs: 25,          // Hz (resonant frequency)
                Xmax: 0.030      // meters (max excursion)
            },
            woofer: {
                Bl: 15,
                Re: 6,
                Le: 0.0015,
                Mms: 0.05,
                Cms: 0.0005,
                Rms: 2.0,
                fs: 45,
                Xmax: 0.020
            },
            midrange: {
                Bl: 8,
                Re: 6,
                Le: 0.0008,
                Mms: 0.010,
                Cms: 0.0002,
                Rms: 0.8,
                fs: 250,
                Xmax: 0.008
            },
            tweeter: {
                Bl: 3,
                Re: 6,
                Le: 0.0001,
                Mms: 0.0005,
                Cms: 0.00001,
                Rms: 0.2,
                fs: 2500,
                Xmax: 0.002
            },
            fullrange: {
                Bl: 6,
                Re: 8,
                Le: 0.0005,
                Mms: 0.008,
                Cms: 0.0003,
                Rms: 0.5,
                fs: 100,
                Xmax: 0.010
            },
            broadband: {
                // Critically damped for flat response
                Bl: 5,
                Re: 8,
                Le: 0.0003,
                Mms: 0.005,
                Cms: 0.0002,
                Rms: 1.5,  // High damping for Q=0.5
                fs: 200,
                Xmax: 0.005
            }
        };
        
        this.driver = presets[type] || presets.fullrange;
        this.driverType = type;
    }
    
    /**
     * Process audio sample - main coupling method
     */
    processAudioSample(audioSample, deltaTime = 1/48000) {
        // Store for analysis
        this.previousSample = this.currentSample;
        this.currentSample = audioSample;
        
        // Apply stereo balance
        const balancedSample = this.applyBalance(audioSample);
        
        // Apply EQ
        const eqSample = this.applyEQ(balancedSample);
        
        // Convert audio (-1 to 1) to voltage
        const voltage = eqSample * this.amplifierGain;
        const clippedVoltage = Math.max(-this.maxVoltage, Math.min(this.maxVoltage, voltage));
        
        // Calculate instantaneous frequency for impedance
        const frequency = this.estimateInstantFrequency();
        
        // Calculate electrical impedance (frequency dependent)
        const impedance = this.calculateImpedance(frequency);
        this.metrics.impedance = impedance;
        
        // Account for back-EMF (speaker fights back!)
        const backEMF = this.driver.Bl * this.oscillator.velocity;
        const effectiveVoltage = clippedVoltage - backEMF;
        
        // Calculate current (Ohm's law)
        let current = effectiveVoltage / impedance;
        
        // Current limiting (protection)
        if (Math.abs(current) > this.maxCurrent) {
            current = Math.sign(current) * this.maxCurrent;
            this.metrics.peakCurrent = this.maxCurrent;
        }
        
        // Lorentz force: F = Bl × i
        const electromagneticForce = this.driver.Bl * current;
        
        // Apply distance/coupling modifier
        const coupledForce = electromagneticForce * (1 / this.distanceFromOrigin);
        
        // Update oscillator physics (use the physical ball's properties)
        this.oscillator.mass = this.physicalBall.mass;
        this.oscillator.dampingCoefficient = this.physicalBall.totalDamping;
        
        // Non-linear stiffness at large excursions
        let effectiveSpringConstant = this.physicalBall.springConstant;
        if (Math.abs(this.oscillator.position) > this.driver.Xmax * 0.7) {
            const overExcursion = Math.abs(this.oscillator.position) - this.driver.Xmax * 0.7;
            const stiffnessIncrease = Math.pow(overExcursion / this.driver.Xmax, 2);
            effectiveSpringConstant = this.physicalBall.springConstant * (1 + stiffnessIncrease * 10);
        }
        this.oscillator.springConstant = effectiveSpringConstant;
        
        // Set the driving force
        this.oscillator.customForceFunction = (t) => coupledForce;
        
        // Update metrics
        this.updateMetrics(current, voltage, deltaTime);
        
        return {
            force: coupledForce,
            current: current,
            voltage: effectiveVoltage,
            backEMF: backEMF,
            power: current * current * this.driver.Re
        };
    }
    
    /**
     * Calculate frequency-dependent impedance (enhanced per physicist feedback)
     */
    calculateImpedance(frequency) {
        const omega = 2 * Math.PI * frequency;
        
        // Temperature-dependent DC resistance (copper ~0.4%/°C)
        const tempCoefficient = 0.004;
        const actualRe = this.driver.Re * (1 + tempCoefficient * (this.metrics.temperature - 25));
        
        // Electrical impedance: Z_e = Re + jωLe
        const realPart = actualRe;
        const imagPart = omega * this.driver.Le;
        
        // Mechanical impedance components
        const mechResistance = this.driver.Rms;
        const massReactance = omega * this.driver.Mms;
        const stiffnessReactance = (1 / this.driver.Cms) / omega;
        const mechReactance = massReactance - stiffnessReactance;
        const mechImpedanceSquared = mechResistance * mechResistance + mechReactance * mechReactance;
        
        // Properly reflected motional impedance (complex conjugate)
        const motionalResistance = (this.driver.Bl * this.driver.Bl) * mechResistance / mechImpedanceSquared;
        const motionalReactance = -(this.driver.Bl * this.driver.Bl) * mechReactance / mechImpedanceSquared;
        
        // Total impedance
        const totalReal = realPart + motionalResistance;
        const totalImag = imagPart + motionalReactance;
        const impedanceMagnitude = Math.sqrt(totalReal * totalReal + totalImag * totalImag);
        
        // Enhanced resonance behavior
        if (Math.abs(frequency - this.driver.fs) < 5) { // Within 5Hz of resonance
            const resonanceQ = Math.sqrt(this.driver.Mms / this.driver.Cms) / this.driver.Rms;
            const resonanceEnhancement = 1 + resonanceQ * Math.exp(-Math.abs(frequency - this.driver.fs) / 5);
            return impedanceMagnitude * resonanceEnhancement;
        }
        
        return impedanceMagnitude;
    }
    
    /**
     * Calculate mechanical impedance
     */
    calculateMechanicalImpedance(frequency) {
        const omega = 2 * Math.PI * frequency;
        
        // Z_mech = Rms + jωMms + k/jω
        const resistance = this.driver.Rms;
        const massReactance = omega * this.driver.Mms;
        const stiffnessReactance = (1 / this.driver.Cms) / omega;
        
        const realPart = resistance;
        const imagPart = massReactance - stiffnessReactance;
        
        return Math.sqrt(realPart * realPart + imagPart * imagPart);
    }
    
    /**
     * Apply stereo balance
     */
    applyBalance(sample) {
        // -1 = full left, 0 = center, 1 = full right
        const gain = 1 - Math.abs(this.stereoBalance);
        return sample * gain;
    }
    
    /**
     * Apply EQ bands
     */
    applyEQ(sample) {
        // Simplified EQ - in reality would use biquad filters
        let output = sample;
        
        // Apply gain for dominant frequency
        const freq = this.estimateInstantFrequency();
        const band = this.getEQBandForFrequency(freq);
        if (band) {
            output *= band.gain;
        }
        
        return output;
    }
    
    /**
     * Get EQ band for frequency
     */
    getEQBandForFrequency(freq) {
        for (const [name, band] of Object.entries(this.eqBands)) {
            const lower = band.center / Math.sqrt(2);
            const upper = band.center * Math.sqrt(2);
            if (freq >= lower && freq <= upper) {
                return band;
            }
        }
        return null;
    }
    
    /**
     * Estimate instantaneous frequency (zero-crossing method)
     */
    estimateInstantFrequency() {
        // Simple zero-crossing detection
        if (this.previousSample < 0 && this.currentSample >= 0) {
            // Positive zero crossing
            const period = 2 / this.sampleRate;  // Simplified
            return 1 / period;
        }
        
        // Default to driver resonance
        return this.driver.fs;
    }
    
    /**
     * Update telemetry metrics (enhanced thermal model)
     */
    updateMetrics(current, voltage, deltaTime) {
        // Power calculations
        this.metrics.instantPower = Math.abs(current * voltage);
        this.metrics.averagePower = this.metrics.averagePower * 0.95 + 
                                    this.metrics.instantPower * 0.05;
        
        // Energy accumulation
        this.metrics.totalEnergy += this.metrics.instantPower * deltaTime;
        
        // Enhanced thermal model with proper thermal resistance
        const thermalPower = current * current * this.driver.Re;  // I²R losses
        const thermalResistance = 5.0;  // °C/W typical for small driver
        const thermalTimeConstant = 0.1;  // seconds for voice coil
        
        // Target temperature based on power dissipation
        const targetTemp = 25 + thermalPower * thermalResistance;
        
        // Exponential approach to target temperature
        this.metrics.temperature += (targetTemp - this.metrics.temperature) * 
                                   (deltaTime / thermalTimeConstant);
        
        // Power compression at high temperatures
        if (this.metrics.temperature > 100) {
            // Reduce gain to protect driver
            this.amplifierGain *= 0.9;
        }
        
        // Peak tracking
        if (Math.abs(current) > this.metrics.peakCurrent) {
            this.metrics.peakCurrent = Math.abs(current);
        }
    }
    
    /**
     * Interactive controls
     */
    
    // Mouse wheel changes ball size
    handleScrollWheel(delta) {
        const scaleFactor = 1.1;
        const newRadius = delta > 0 ? 
            this.physicalBall.radius * scaleFactor :
            this.physicalBall.radius / scaleFactor;
        
        this.physicalBall.setRadius(newRadius);
        
        // Update oscillator mass and damping from physical ball
        this.oscillator.mass = this.physicalBall.mass;
        this.oscillator.dampingCoefficient = this.physicalBall.totalDamping;
        this.oscillator.updateDerivedProperties();
    }
    
    // Mouse position
    handleMouseMove(x, y) {
        // X axis: stereo balance
        this.stereoBalance = x;  // Assumes x is normalized to [-1, 1]
        
        // Y axis: distance from origin (coupling strength)
        this.distanceFromOrigin = 0.1 + y * 1.9;  // Map to [0.1, 2.0]
    }
    
    // Set EQ band
    setEQBand(bandName, gain) {
        if (this.eqBands[bandName]) {
            this.eqBands[bandName].gain = Math.max(0, Math.min(2, gain));
        }
    }
    
    /**
     * Get current state for visualization
     */
    getState() {
        return {
            // Physical properties
            ball: this.physicalBall.getTelemetry(),
            visual: this.physicalBall.getVisualProperties(),
            
            // Driver properties
            driver: {
                type: this.driverType,
                resonance: this.driver.fs,
                impedance: this.metrics.impedance.toFixed(1) + ' Ω'
            },
            
            // Audio processing
            audio: {
                instantLevel: Math.abs(this.currentSample),
                frequency: this.estimateInstantFrequency().toFixed(1) + ' Hz'
            },
            
            // Electrical
            electrical: {
                current: this.metrics.peakCurrent.toFixed(2) + ' A',
                power: this.metrics.averagePower.toFixed(1) + ' W',
                temperature: this.metrics.temperature.toFixed(1) + ' °C'
            },
            
            // Interactive
            controls: {
                balance: this.stereoBalance,
                distance: this.distanceFromOrigin,
                eqBands: this.eqBands
            }
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioOscillatorCoupler;
}

if (typeof window !== 'undefined') {
    window.AudioOscillatorCoupler = AudioOscillatorCoupler;
}