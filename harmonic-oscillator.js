/**
 * Harmonic Oscillator Physics Engine
 * 
 * Implements the driven damped harmonic oscillator:
 * m·d²x/dt² + b·dx/dt + k·x = F(t)
 * 
 * This is THE reference implementation for all oscillators in rmix.
 * Mathematical accuracy is non-negotiable.
 * 
 * Based on the universal equation that appears at every scale:
 * - Quantum: electron orbitals
 * - Biological: cell membranes
 * - Mechanical: mass-spring systems
 * - Economic: market cycles
 * - Cosmic: gravitational oscillations
 */

class HarmonicOscillator {
    constructor(options = {}) {
        // Physical parameters (SI units)
        this.mass = options.mass || 0.1;  // kg (100g default like Falstad)
        this.springConstant = options.springConstant || 4299.2;  // N/m (gives ~33 Hz)
        this.dampingCoefficient = options.dampingCoefficient || 2.54;  // N·s/m
        
        // State variables
        this.position = options.initialPosition || 0;  // meters
        this.velocity = options.initialVelocity || 0;  // m/s
        this.acceleration = 0;  // m/s²
        this.time = 0;  // seconds
        
        // Force parameters
        this.forceType = options.forceType || 'sine';
        this.forceAmplitude = options.forceAmplitude || 5.0;  // Newtons
        this.forceFrequency = options.forceFrequency || 8.5;  // Hz
        this.forcePhase = options.forcePhase || 0;  // radians
        this.fourierTerms = options.fourierTerms || 5;
        
        // Custom force function (for audio input later)
        this.customForceFunction = null;
        
        // External force (from coupler)
        this.externalForce = 0;
        
        // Simulation parameters
        this.dt = options.dt || 0.0001;  // 0.1ms timestep for stability
        this.simulationSpeed = options.simulationSpeed || 1.0;
        
        // Energy tracking
        this.kineticEnergy = 0;
        this.potentialEnergy = 0;
        this.totalEnergy = 0;
        this.dissipatedEnergy = 0;  // Cumulative energy lost to damping
        this.inputEnergy = 0;  // Cumulative energy from driving force
        
        // History buffers for visualization
        this.historyLength = options.historyLength || 1000;
        this.positionHistory = [];
        this.velocityHistory = [];
        this.forceHistory = [];
        this.energyHistory = [];
        this.phaseHistory = [];
        
        // Frequency response data
        this.frequencyResponse = new Map();
        
        // Calculate derived properties
        this.updateDerivedProperties();
        
        // Reference values for validation
        this.falstadReference = {
            mass: 100,  // grams
            springConstant: 4299.2,  // N/m
            damping: 2.54,
            naturalFreq: 33,  // Hz
            qFactor: 40.81
        };
    }
    
    /**
     * Update all derived properties when parameters change
     */
    updateDerivedProperties() {
        // Natural angular frequency: ω₀ = √(k/m)
        this.naturalAngularFrequency = Math.sqrt(this.springConstant / this.mass);
        this.naturalFrequency = this.naturalAngularFrequency / (2 * Math.PI);
        
        // Critical damping coefficient: b_c = 2√(mk)
        this.criticalDamping = 2 * Math.sqrt(this.mass * this.springConstant);
        
        // Damping ratio: ζ = b/b_c
        this.dampingRatio = this.dampingCoefficient / this.criticalDamping;
        
        // Q factor: Q = 1/(2ζ) for underdamped systems
        if (this.dampingRatio > 0 && this.dampingRatio < 1) {
            this.qFactor = 1 / (2 * this.dampingRatio);
        } else {
            this.qFactor = this.dampingRatio === 0 ? Infinity : 0;
        }
        
        // System classification
        if (this.dampingRatio < 1) {
            this.systemType = 'underdamped';
            // Damped natural frequency: ω_d = ω₀√(1-ζ²)
            this.dampedNaturalFrequency = this.naturalAngularFrequency * 
                                          Math.sqrt(1 - this.dampingRatio * this.dampingRatio);
        } else if (this.dampingRatio === 1) {
            this.systemType = 'critically_damped';
            this.dampedNaturalFrequency = 0;
        } else {
            this.systemType = 'overdamped';
            this.dampedNaturalFrequency = 0;
        }
        
        // Beta coefficient (Falstad notation)
        this.beta = this.dampingCoefficient;
    }
    
    /**
     * Calculate the driving force at time t
     * This is F(t) in the differential equation
     */
    getDrivingForce(t) {
        // External force takes highest precedence (from coupler)
        if (this.externalForce !== 0) {
            return this.externalForce;
        }
        
        // Custom force function takes precedence (for audio input)
        if (this.customForceFunction) {
            return this.customForceFunction(t);
        }
        
        const omega = 2 * Math.PI * this.forceFrequency;
        const phase = this.forcePhase;
        
        switch (this.forceType) {
            case 'none':
                return 0;
                
            case 'constant':
                return this.forceAmplitude;
                
            case 'sine':
                return this.forceAmplitude * Math.sin(omega * t + phase);
                
            case 'cosine':
                return this.forceAmplitude * Math.cos(omega * t + phase);
                
            case 'square':
                // Square wave: sign(sin(ωt))
                return this.forceAmplitude * Math.sign(Math.sin(omega * t + phase));
                
            case 'sawtooth':
                // Sawtooth: linear ramp from -1 to 1
                const sawPhase = ((omega * t + phase) % (2 * Math.PI)) / (2 * Math.PI);
                return this.forceAmplitude * (2 * sawPhase - 1);
                
            case 'triangle':
                // Triangle wave: linear up and down
                const triPhase = ((omega * t + phase) % (2 * Math.PI)) / Math.PI;
                if (triPhase < 1) {
                    return this.forceAmplitude * (2 * triPhase - 1);
                } else {
                    return this.forceAmplitude * (3 - 2 * triPhase);
                }
                
            case 'fourier_square':
                return this.getFourierSquare(t, omega, phase);
                
            case 'fourier_sawtooth':
                return this.getFourierSawtooth(t, omega, phase);
                
            case 'fourier_triangle':
                return this.getFourierTriangle(t, omega, phase);
                
            default:
                return 0;
        }
    }
    
    /**
     * Fourier series for square wave
     * Square = (4/π) * Σ(sin((2n-1)ωt)/(2n-1)) for n=1 to N
     */
    getFourierSquare(t, omega, phase) {
        let sum = 0;
        for (let n = 1; n <= this.fourierTerms; n++) {
            const harmonic = 2 * n - 1;  // Odd harmonics only
            sum += Math.sin(harmonic * omega * t + phase) / harmonic;
        }
        return this.forceAmplitude * (4 / Math.PI) * sum;
    }
    
    /**
     * Fourier series for sawtooth wave
     * Sawtooth = (2/π) * Σ((-1)^(n+1) * sin(nωt)/n) for n=1 to N
     */
    getFourierSawtooth(t, omega, phase) {
        let sum = 0;
        for (let n = 1; n <= this.fourierTerms; n++) {
            const sign = (n % 2 === 0) ? -1 : 1;
            sum += sign * Math.sin(n * omega * t + phase) / n;
        }
        return this.forceAmplitude * (2 / Math.PI) * sum;
    }
    
    /**
     * Fourier series for triangle wave
     * Triangle = (8/π²) * Σ((-1)^((n-1)/2) * sin(nωt)/n²) for odd n
     */
    getFourierTriangle(t, omega, phase) {
        let sum = 0;
        for (let n = 1; n <= this.fourierTerms; n++) {
            const oddN = 2 * n - 1;  // Odd harmonics only
            const sign = ((n - 1) % 2 === 0) ? 1 : -1;
            sum += sign * Math.sin(oddN * omega * t + phase) / (oddN * oddN);
        }
        return this.forceAmplitude * (8 / (Math.PI * Math.PI)) * sum;
    }
    
    /**
     * 4th Order Runge-Kutta integration
     * Most accurate method for ODEs - no energy drift!
     */
    update() {
        const dt = this.dt * this.simulationSpeed;
        
        // Store previous energy for dissipation tracking
        const previousEnergy = this.totalEnergy;
        
        // RK4 integration
        // k1 = f(t, y)
        const k1 = this.computeDerivatives(
            this.time,
            this.position,
            this.velocity
        );
        
        // k2 = f(t + dt/2, y + k1*dt/2)
        const k2 = this.computeDerivatives(
            this.time + dt / 2,
            this.position + k1.velocity * dt / 2,
            this.velocity + k1.acceleration * dt / 2
        );
        
        // k3 = f(t + dt/2, y + k2*dt/2)
        const k3 = this.computeDerivatives(
            this.time + dt / 2,
            this.position + k2.velocity * dt / 2,
            this.velocity + k2.acceleration * dt / 2
        );
        
        // k4 = f(t + dt, y + k3*dt)
        const k4 = this.computeDerivatives(
            this.time + dt,
            this.position + k3.velocity * dt,
            this.velocity + k3.acceleration * dt
        );
        
        // Weighted average: y(t+dt) = y(t) + (k1 + 2k2 + 2k3 + k4) * dt/6
        this.position += (k1.velocity + 2*k2.velocity + 2*k3.velocity + k4.velocity) * dt / 6;
        this.velocity += (k1.acceleration + 2*k2.acceleration + 2*k3.acceleration + k4.acceleration) * dt / 6;
        
        // Update acceleration for display
        this.acceleration = k1.acceleration;
        
        // Update time
        this.time += dt;
        
        // Update energy
        this.updateEnergy();
        
        // Track energy dissipation
        const energyChange = this.totalEnergy - previousEnergy;
        if (energyChange < 0) {
            this.dissipatedEnergy += Math.abs(energyChange);
        }
        
        // Track input energy from driving force
        const drivingForce = this.getDrivingForce(this.time);
        const inputPower = drivingForce * this.velocity;
        this.inputEnergy += inputPower * dt;
        
        // Update history
        this.updateHistory(drivingForce);
    }
    
    /**
     * Compute derivatives for RK4
     * Returns velocity and acceleration at given state
     */
    computeDerivatives(t, position, velocity) {
        // Get driving force at this time
        const drivingForce = this.getDrivingForce(t);
        
        // Spring force: F_spring = -kx (Hooke's law)
        const springForce = -this.springConstant * position;
        
        // Damping force: F_damping = -bv
        const dampingForce = -this.dampingCoefficient * velocity;
        
        // Total force: F = F_drive + F_spring + F_damping
        const totalForce = drivingForce + springForce + dampingForce;
        
        // Acceleration: a = F/m (Newton's second law)
        const acceleration = totalForce / this.mass;
        
        return {
            velocity: velocity,  // dx/dt = v
            acceleration: acceleration  // dv/dt = a
        };
    }
    
    /**
     * Calculate current energy state
     */
    updateEnergy() {
        // Kinetic energy: E_k = (1/2)mv²
        this.kineticEnergy = 0.5 * this.mass * this.velocity * this.velocity;
        
        // Potential energy: E_p = (1/2)kx²
        this.potentialEnergy = 0.5 * this.springConstant * this.position * this.position;
        
        // Total mechanical energy
        this.totalEnergy = this.kineticEnergy + this.potentialEnergy;
    }
    
    /**
     * Update history buffers for visualization
     */
    updateHistory(currentForce) {
        // Add current state to history
        this.positionHistory.push(this.position);
        this.velocityHistory.push(this.velocity);
        this.forceHistory.push(currentForce);
        this.energyHistory.push({
            kinetic: this.kineticEnergy,
            potential: this.potentialEnergy,
            total: this.totalEnergy
        });
        
        // Calculate phase difference between drive and response
        const drivePhase = (2 * Math.PI * this.forceFrequency * this.time + this.forcePhase) % (2 * Math.PI);
        const responsePhase = Math.atan2(this.velocity, this.position * this.naturalAngularFrequency);
        const phaseDiff = responsePhase - drivePhase;
        this.phaseHistory.push(phaseDiff);
        
        // Trim history to max length
        if (this.positionHistory.length > this.historyLength) {
            this.positionHistory.shift();
            this.velocityHistory.shift();
            this.forceHistory.shift();
            this.energyHistory.shift();
            this.phaseHistory.shift();
        }
    }
    
    /**
     * Calculate frequency response at given frequency
     * |H(ω)| = 1/√[(1-(ω/ω₀)²)² + (2ζω/ω₀)²]
     */
    getFrequencyResponse(frequency) {
        const omega = 2 * Math.PI * frequency;
        const omega0 = this.naturalAngularFrequency;
        const ratio = omega / omega0;
        
        // Real and imaginary parts of transfer function
        const real = 1 - ratio * ratio;
        const imag = 2 * this.dampingRatio * ratio;
        
        // Magnitude and phase
        const magnitude = 1 / Math.sqrt(real * real + imag * imag);
        const phase = Math.atan2(-imag, real);
        
        return {
            frequency: frequency,
            magnitude: magnitude,
            magnitudeDB: 20 * Math.log10(magnitude),  // Convert to dB
            phase: phase,
            phaseDegrees: phase * 180 / Math.PI
        };
    }
    
    /**
     * Generate full frequency response curve
     */
    generateFrequencyResponseCurve(minFreq = 0.1, maxFreq = 100, points = 200) {
        const response = [];
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        
        for (let i = 0; i < points; i++) {
            // Logarithmic frequency spacing
            const logFreq = logMin + (i / (points - 1)) * (logMax - logMin);
            const freq = Math.pow(10, logFreq);
            response.push(this.getFrequencyResponse(freq));
        }
        
        return response;
    }
    
    /**
     * Check if system is near resonance
     */
    isNearResonance(tolerance = 0.1) {
        const freqRatio = this.forceFrequency / this.naturalFrequency;
        return Math.abs(freqRatio - 1) < tolerance;
    }
    
    /**
     * Get resonance strength (0 to 1)
     */
    getResonanceStrength() {
        const freqRatio = this.forceFrequency / this.naturalFrequency;
        const response = this.getFrequencyResponse(this.forceFrequency);
        const maxResponse = this.getFrequencyResponse(this.naturalFrequency);
        return Math.min(1, response.magnitude / maxResponse.magnitude);
    }
    
    /**
     * Set external force (from audio coupler)
     */
    setExternalForce(force) {
        this.externalForce = force;
    }
    
    /**
     * Reset to initial conditions
     */
    reset() {
        this.position = 0;
        this.velocity = 0;
        this.acceleration = 0;
        this.time = 0;
        this.dissipatedEnergy = 0;
        this.inputEnergy = 0;
        this.externalForce = 0;
        
        // Clear history
        this.positionHistory = [];
        this.velocityHistory = [];
        this.forceHistory = [];
        this.energyHistory = [];
        this.phaseHistory = [];
        
        this.updateEnergy();
    }
    
    /**
     * Get current system state for display
     */
    getState() {
        return {
            // Time
            time: this.time,
            
            // Position and derivatives
            position: this.position,
            velocity: this.velocity,
            acceleration: this.acceleration,
            
            // Energy
            kineticEnergy: this.kineticEnergy,
            potentialEnergy: this.potentialEnergy,
            totalEnergy: this.totalEnergy,
            dissipatedEnergy: this.dissipatedEnergy,
            inputEnergy: this.inputEnergy,
            energyDissipationRate: this.dampingCoefficient * this.velocity * this.velocity,
            
            // System properties
            naturalFrequency: this.naturalFrequency,
            dampingRatio: this.dampingRatio,
            qFactor: this.qFactor,
            systemType: this.systemType,
            
            // Force
            currentForce: this.getDrivingForce(this.time),
            forceFrequency: this.forceFrequency,
            forceAmplitude: this.forceAmplitude,
            
            // Resonance
            nearResonance: this.isNearResonance(),
            resonanceStrength: this.getResonanceStrength(),
            
            // Phase
            phaseDifference: this.phaseHistory[this.phaseHistory.length - 1] || 0
        };
    }
    
    /**
     * Get Falstad-compatible display values
     */
    getFalstadDisplay() {
        return {
            time: this.time.toFixed(2) + ' s',
            naturalFreq: this.naturalFrequency.toFixed(1) + ' Hz',
            forceFreq: this.forceFrequency.toFixed(1) + ' Hz',
            mass: (this.mass * 1000).toFixed(0) + 'g',
            k: this.springConstant.toFixed(1) + ' N/m',
            beta: this.beta.toFixed(2),
            zeta: this.dampingRatio.toFixed(3),
            systemType: this.systemType,
            Q: this.qFactor.toFixed(2)
        };
    }
    
    /**
     * Validate against Falstad reference values
     */
    validateAgainstFalstad() {
        const tolerance = 0.01;  // 1% tolerance
        
        return {
            massMatch: Math.abs(this.mass * 1000 - this.falstadReference.mass) / this.falstadReference.mass < tolerance,
            springMatch: Math.abs(this.springConstant - this.falstadReference.springConstant) / this.falstadReference.springConstant < tolerance,
            dampingMatch: Math.abs(this.dampingCoefficient - this.falstadReference.damping) / this.falstadReference.damping < tolerance,
            freqMatch: Math.abs(this.naturalFrequency - this.falstadReference.naturalFreq) / this.falstadReference.naturalFreq < tolerance,
            qMatch: Math.abs(this.qFactor - this.falstadReference.qFactor) / this.falstadReference.qFactor < tolerance
        };
    }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HarmonicOscillator;
}