/**
 * Membrane Physics Core Module
 * Extracted from harold-membrane-physics-3d.html
 * 
 * Pure membrane physics simulation without UI dependencies
 */

class MembranePhysics {
    constructor(options = {}) {
        // Membrane parameters
        this.gridSize = options.gridSize || 100;
        this.membraneSize = options.membraneSize || 100;
        this.waveSpeed = options.waveSpeed || 0.3;
        this.damping = options.damping || 0.00265; // Spacetime impedance
        this.boundaryType = options.boundaryType || 'fixed'; // 'fixed', 'free', 'infinite'
        this.boundaryShape = options.boundaryShape || 'square'; // 'square', 'circle'
        this.boundaryStiffness = options.boundaryStiffness || 1.0; // 0=free, 1=fixed
        this.boundaryAbsorption = options.boundaryAbsorption || 0.0; // 0=reflect, 1=absorb
        
        // Physics arrays
        this.heights = [];
        this.velocities = [];
        
        // Initialize arrays
        this.initializeArrays();
    }
    
    initializeArrays() {
        this.heights = new Array(this.gridSize + 1);
        this.velocities = new Array(this.gridSize + 1);
        for (let i = 0; i <= this.gridSize; i++) {
            this.heights[i] = new Array(this.gridSize + 1).fill(0);
            this.velocities[i] = new Array(this.gridSize + 1).fill(0);
        }
    }
    
    /**
     * Strike the membrane at a specific position
     * @param {number} x - X position (-membraneSize/2 to +membraneSize/2)
     * @param {number} y - Y position (-membraneSize/2 to +membraneSize/2)
     * @param {number} force - Strike force (amplitude)
     * @param {number} radius - Impact radius in grid cells
     */
    strikeMembrane(x, y, force = 2.0, radius = 6) {
        // Convert world coordinates to grid coordinates
        const gridX = Math.round((x / this.membraneSize + 0.5) * this.gridSize);
        const gridY = Math.round((y / this.membraneSize + 0.5) * this.gridSize);
        
        // Apply Gaussian-distributed force
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const gi = gridX + i;
                const gj = gridY + j;
                
                if (gi >= 0 && gi <= this.gridSize && gj >= 0 && gj <= this.gridSize) {
                    const dist2 = i * i + j * j;
                    const gaussian = Math.exp(-dist2 / (radius * radius * 0.5));
                    this.velocities[gi][gj] += force * gaussian * 0.1;
                }
            }
        }
    }
    
    /**
     * Apply continuous force at a position (for actuators)
     * @param {number} x - X position
     * @param {number} y - Y position  
     * @param {number} force - Force magnitude
     */
    applyForce(x, y, force) {
        const gridX = Math.round((x / this.membraneSize + 0.5) * this.gridSize);
        const gridY = Math.round((y / this.membraneSize + 0.5) * this.gridSize);
        
        if (gridX >= 0 && gridX <= this.gridSize && 
            gridY >= 0 && gridY <= this.gridSize) {
            this.velocities[gridX][gridY] += force * 0.1;
        }
    }
    
    /**
     * Update physics simulation by one timestep
     * Implements the wave equation: ∂²u/∂t² = c²∇²u - γ∂u/∂t
     */
    updatePhysics() {
        const newHeights = new Array(this.gridSize + 1).fill(0)
            .map(() => new Array(this.gridSize + 1).fill(0));
        
        // Apply wave equation with finite differences
        for (let i = 1; i < this.gridSize; i++) {
            for (let j = 1; j < this.gridSize; j++) {
                // Calculate Laplacian (∇²u)
                const laplacian = (
                    this.heights[i + 1][j] + this.heights[i - 1][j] +
                    this.heights[i][j + 1] + this.heights[i][j - 1] -
                    4 * this.heights[i][j]
                );
                
                // Update velocity: v += c²∇²u
                this.velocities[i][j] += this.waveSpeed * this.waveSpeed * laplacian;
                
                // Apply damping: v *= (1 - γ)
                this.velocities[i][j] *= (1 - this.damping);
                
                // Update height: u += v
                newHeights[i][j] = this.heights[i][j] + this.velocities[i][j];
            }
        }
        
        // Apply boundary conditions
        this.applyBoundaryConditions(newHeights);
        
        this.heights = newHeights;
    }
    
    /**
     * Apply boundary conditions based on type and shape
     */
    applyBoundaryConditions(newHeights) {
        if (this.boundaryType === 'infinite') {
            // Absorbing boundary - gradually absorb energy at edges
            const absorbWidth = 2;
            
            for (let i = 0; i <= this.gridSize; i++) {
                for (let j = 0; j <= this.gridSize; j++) {
                    let dampingFactor = 1.0;
                    
                    // Calculate distance from nearest edge
                    const distFromLeft = i;
                    const distFromRight = this.gridSize - i;
                    const distFromTop = j;
                    const distFromBottom = this.gridSize - j;
                    const minDist = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);
                    
                    // Apply absorption in boundary layer
                    if (minDist < absorbWidth) {
                        dampingFactor = 0.1 + 0.9 * (minDist / absorbWidth);
                    }
                    
                    this.velocities[i][j] *= dampingFactor;
                }
            }
        } else if (this.boundaryShape === 'circle') {
            // Circular boundary
            const centerX = this.gridSize / 2;
            const centerY = this.gridSize / 2;
            const radius = this.gridSize / 2;
            
            for (let i = 0; i <= this.gridSize; i++) {
                for (let j = 0; j <= this.gridSize; j++) {
                    const dist = Math.sqrt((i - centerX) ** 2 + (j - centerY) ** 2);
                    if (dist > radius - 10) {
                        const fade = Math.max(0, (radius - dist) / 10);
                        if (this.boundaryType === 'fixed') {
                            newHeights[i][j] *= fade;
                            this.velocities[i][j] *= fade;
                        } else if (this.boundaryType === 'free') {
                            newHeights[i][j] *= fade;
                        }
                    }
                }
            }
        } else {
            // Square boundary
            if (this.boundaryType === 'fixed') {
                // Fixed boundary (Dirichlet): u = 0 at edges
                for (let i = 0; i <= this.gridSize; i++) {
                    newHeights[0][i] = 0;
                    newHeights[this.gridSize][i] = 0;
                    newHeights[i][0] = 0;
                    newHeights[i][this.gridSize] = 0;
                }
            } else if (this.boundaryType === 'free') {
                // Semi-free boundary (Robin): blend based on stiffness
                for (let i = 1; i < this.gridSize; i++) {
                    newHeights[0][i] = newHeights[1][i] * (1 - this.boundaryStiffness);
                    newHeights[this.gridSize][i] = newHeights[this.gridSize-1][i] * (1 - this.boundaryStiffness);
                    newHeights[i][0] = newHeights[i][1] * (1 - this.boundaryStiffness);
                    newHeights[i][this.gridSize] = newHeights[i][this.gridSize-1] * (1 - this.boundaryStiffness);
                }
                // Handle corners
                newHeights[0][0] = newHeights[1][1] * (1 - this.boundaryStiffness);
                newHeights[0][this.gridSize] = newHeights[1][this.gridSize-1] * (1 - this.boundaryStiffness);
                newHeights[this.gridSize][0] = newHeights[this.gridSize-1][1] * (1 - this.boundaryStiffness);
                newHeights[this.gridSize][this.gridSize] = newHeights[this.gridSize-1][this.gridSize-1] * (1 - this.boundaryStiffness);
            }
        }
    }
    
    /**
     * Get height map for rendering
     * @returns {Float32Array} Flattened array of heights
     */
    getHeightMap() {
        const heightMap = new Float32Array((this.gridSize + 1) * (this.gridSize + 1));
        let index = 0;
        for (let i = 0; i <= this.gridSize; i++) {
            for (let j = 0; j <= this.gridSize; j++) {
                heightMap[index++] = this.heights[i][j];
            }
        }
        return heightMap;
    }
    
    /**
     * Get height at specific grid position
     */
    getHeightAt(gridX, gridY) {
        if (gridX >= 0 && gridX <= this.gridSize && 
            gridY >= 0 && gridY <= this.gridSize) {
            return this.heights[gridX][gridY];
        }
        return 0;
    }
    
    /**
     * Reset membrane to flat state
     */
    reset() {
        this.initializeArrays();
    }
    
    /**
     * Set wave speed (c = √(T/ρ))
     */
    setWaveSpeed(speed) {
        this.waveSpeed = Math.max(0.05, Math.min(0.8, speed));
    }
    
    /**
     * Set damping coefficient
     */
    setDamping(damping) {
        this.damping = Math.max(0, Math.min(0.01, damping));
    }
    
    /**
     * Set boundary type
     */
    setBoundaryType(type) {
        if (['fixed', 'free', 'infinite'].includes(type)) {
            this.boundaryType = type;
        }
    }
    
    /**
     * Set boundary shape
     */
    setBoundaryShape(shape) {
        if (['square', 'circle'].includes(shape)) {
            this.boundaryShape = shape;
        }
    }
    
    /**
     * Update grid resolution (requires reinit)
     */
    setGridSize(size) {
        this.gridSize = Math.max(10, Math.min(200, size));
        this.initializeArrays();
    }
}

/**
 * Actuator class for audio-driven membrane control
 */
class MembraneActuator {
    constructor(x, y, membrane) {
        this.x = x;
        this.y = y;
        this.membrane = membrane;
        this.amplitude = 0;
        this.frequency = 440; // Hz
        this.phase = 0;
        this.gain = 1.0;
        this.active = true;
    }
    
    /**
     * Apply actuator force to membrane
     * @param {number} deltaTime - Time step in seconds
     */
    apply(deltaTime) {
        if (!this.active) return;
        
        // Calculate sinusoidal force
        this.phase += 2 * Math.PI * this.frequency * deltaTime;
        const force = this.amplitude * Math.sin(this.phase) * this.gain;
        
        // Apply to membrane
        this.membrane.applyForce(this.x, this.y, force);
    }
    
    /**
     * Set actuator from audio data
     * @param {number} audioLevel - Audio amplitude (0-1)
     */
    setFromAudio(audioLevel) {
        this.amplitude = audioLevel * 10; // Scale to membrane units
    }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MembranePhysics, MembraneActuator };
}