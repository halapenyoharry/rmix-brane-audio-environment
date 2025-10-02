/**
 * Physically Accurate Ball
 * 
 * The visual IS the physics - ball size directly determines mass AND drag
 * through real physical relationships, not independent sliders.
 * 
 * Key insight: When a ball gets bigger:
 * - Mass scales with r³ (volume)
 * - Drag scales with r² (cross-sectional area)  
 * - Surface/Volume ratio = 3/r (gets smaller as ball grows)
 * 
 * This means bigger balls have LESS damping per unit mass naturally!
 */

class PhysicalBall {
    constructor(options = {}) {
        // Material properties
        this.materialDensity = options.density || 1000;  // kg/m³ (water = 1000)
        this.material = options.material || 'rubber';
        
        // Environment properties
        this.airDensity = options.airDensity || 1.225;  // kg/m³ at sea level
        this.dragCoefficient = 0.47;  // Sphere drag coefficient
        
        // Initial size
        this.radius = options.radius || 0.02;  // 2cm default (ping pong ball size)
        
        // Spring properties (independent of ball size)
        this.springConstant = options.springConstant || 100;  // N/m
        
        // Calculate derived properties
        this.updatePhysicsFromRadius();
        
        // Material presets with realistic densities
        this.materials = {
            air: { density: 1.225, color: '#ffffff', opacity: 0.1 },
            helium: { density: 0.164, color: '#ffcccc', opacity: 0.2 },
            foam: { density: 30, color: '#ffffcc', opacity: 0.4 },
            cork: { density: 240, color: '#d4a574', opacity: 0.7 },
            rubber: { density: 1100, color: '#ffdd00', opacity: 0.9 },
            water: { density: 1000, color: '#0088ff', opacity: 0.6 },
            aluminum: { density: 2700, color: '#c0c0c0', opacity: 1.0, metallic: true },
            steel: { density: 7850, color: '#708090', opacity: 1.0, metallic: true },
            lead: { density: 11340, color: '#444444', opacity: 1.0 },
            tungsten: { density: 19300, color: '#333333', opacity: 1.0, metallic: true }
        };
    }
    
    /**
     * Set ball radius - this drives ALL other physics properties
     */
    setRadius(radius) {
        this.radius = Math.max(0.001, Math.min(1.0, radius));  // 1mm to 1m limits
        this.updatePhysicsFromRadius();
    }
    
    /**
     * Update all physics properties based on radius
     */
    updatePhysicsFromRadius() {
        // Volume = (4/3)πr³
        this.volume = (4/3) * Math.PI * Math.pow(this.radius, 3);
        
        // Mass = density × volume
        this.mass = this.materialDensity * this.volume;
        
        // Cross-sectional area = πr²
        this.crossSectionalArea = Math.PI * Math.pow(this.radius, 2);
        
        // Surface area = 4πr²
        this.surfaceArea = 4 * Math.PI * Math.pow(this.radius, 2);
        
        // Surface to volume ratio = 3/r
        this.surfaceToVolumeRatio = 3 / this.radius;
        
        // Aerodynamic drag coefficient (Reynolds number dependent, simplified)
        // F_drag = 0.5 × ρ_air × Cd × A × v²
        const dragForceCoefficient = 0.5 * this.airDensity * this.dragCoefficient * this.crossSectionalArea;
        
        // Effective damping = drag force coefficient / mass
        // This naturally gives us b in: F = -bv
        this.aerodynamicDamping = dragForceCoefficient;
        
        // Total damping includes both aerodynamic and material damping
        this.totalDamping = this.aerodynamicDamping + this.getMaterialDamping();
        
        // Natural frequency ω₀ = √(k/m)
        this.naturalFrequency = Math.sqrt(this.springConstant / this.mass);
        this.naturalFrequencyHz = this.naturalFrequency / (2 * Math.PI);
        
        // Q factor = √(mk)/b
        this.qFactor = Math.sqrt(this.mass * this.springConstant) / this.totalDamping;
        
        // Damping ratio ζ = b/(2√(mk))
        this.dampingRatio = this.totalDamping / (2 * Math.sqrt(this.mass * this.springConstant));
    }
    
    /**
     * Get material-specific internal damping
     */
    getMaterialDamping() {
        // Different materials have different internal friction
        const materialDampingFactors = {
            air: 0.001,
            helium: 0.001,
            foam: 0.5,
            cork: 0.3,
            rubber: 0.2,
            water: 0.1,
            aluminum: 0.01,
            steel: 0.005,
            lead: 0.02,
            tungsten: 0.003
        };
        
        return (materialDampingFactors[this.material] || 0.1) * this.mass;
    }
    
    /**
     * Set material type - changes density and visual properties
     */
    setMaterial(materialName) {
        if (this.materials[materialName]) {
            this.material = materialName;
            this.materialDensity = this.materials[materialName].density;
            this.updatePhysicsFromRadius();
            return this.materials[materialName];
        }
        return null;
    }
    
    /**
     * Get scaling factors for different radii
     */
    getScalingBehavior(newRadius) {
        const ratio = newRadius / this.radius;
        
        return {
            massScale: Math.pow(ratio, 3),         // r³
            dragScale: Math.pow(ratio, 2),         // r²
            dampingPerMassScale: 1 / ratio,        // 1/r
            naturalFreqScale: Math.pow(ratio, -1.5), // 1/r^(3/2) assuming constant k
            qFactorScale: ratio                     // r (less relative damping)
        };
    }
    
    /**
     * Get visual properties based on physics
     */
    getVisualProperties() {
        const material = this.materials[this.material] || this.materials.rubber;
        
        return {
            radius: this.radius * 1000,  // Convert to mm for display
            color: material.color,
            opacity: material.opacity,
            metallic: material.metallic || false,
            
            // Mass affects visual "weight"
            massIndicator: Math.log10(this.mass + 1),
            
            // Damping affects "fluid resistance" visual
            fluidViscosity: this.dampingRatio,
            
            // Natural frequency affects "color temperature"
            frequencyColor: this.frequencyToColor(this.naturalFrequencyHz),
            
            // Q factor affects "ring" or "glow"
            resonanceGlow: Math.min(1, this.qFactor / 100)
        };
    }
    
    /**
     * Convert frequency to color (low = red, high = blue)
     */
    frequencyToColor(freqHz) {
        // Map 1 Hz to 10000 Hz onto hue spectrum
        const logFreq = Math.log10(Math.max(1, freqHz));
        const hue = 240 - (logFreq / 4) * 240;  // Blue (240) to Red (0)
        return `hsl(${hue}, 100%, 50%)`;
    }
    
    /**
     * Get telemetry for display
     */
    getTelemetry() {
        return {
            // Size
            radius_mm: (this.radius * 1000).toFixed(1),
            diameter_mm: (this.radius * 2000).toFixed(1),
            
            // Mass properties
            mass_g: (this.mass * 1000).toFixed(2),
            density_kg_m3: this.materialDensity.toFixed(0),
            volume_cm3: (this.volume * 1e6).toFixed(2),
            
            // Surface properties
            surfaceArea_cm2: (this.surfaceArea * 10000).toFixed(2),
            crossSection_cm2: (this.crossSectionalArea * 10000).toFixed(2),
            surfaceVolumeRatio_per_cm: (this.surfaceToVolumeRatio * 10).toFixed(2),
            
            // Dynamic properties
            naturalFreq_Hz: this.naturalFrequencyHz.toFixed(1),
            qFactor: this.qFactor.toFixed(2),
            dampingRatio: this.dampingRatio.toFixed(3),
            
            // Forces
            dragCoefficient: this.dragCoefficient.toFixed(2),
            effectiveDamping_Ns_per_m: this.totalDamping.toFixed(4),
            
            // Behavior prediction
            behavior: this.getBehaviorDescription()
        };
    }
    
    /**
     * Describe expected behavior based on properties
     */
    getBehaviorDescription() {
        if (this.radius < 0.005) {
            return "Dust-like: stops almost instantly";
        } else if (this.radius < 0.02) {
            return "BB/small ball: quick damping";
        } else if (this.radius < 0.05) {
            return "Ping pong: moderate damping";
        } else if (this.radius < 0.15) {
            return "Tennis/baseball: sustained oscillation";
        } else {
            return "Bowling ball: very sustained oscillation";
        }
    }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhysicalBall;
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.PhysicalBall = PhysicalBall;
}