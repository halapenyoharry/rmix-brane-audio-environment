/**
 * Falstad Harmonic Oscillator - Complete Implementation
 * 
 * Combines the physics engine with D3.js visualization
 * Matches Falstad's behavior exactly while maintaining mathematical rigor
 * 
 * This is the reference oscillator for the entire rmix project.
 */

class FalstadOscillator {
    constructor(containerId, options = {}) {
        // Container for visualization
        this.container = d3.select(`#${containerId}`);
        this.width = options.width || 800;
        this.height = options.height || 600;
        
        // Physics engine - THE source of truth
        this.physics = new HarmonicOscillator(options.physics || {});
        
        // Visualization settings
        this.vizConfig = {
            // Spring visualization
            springWidth: 40,
            springCoils: 12,
            springRestLength: 200,
            
            // Mass visualization
            massRadius: 20,
            massColor: '#ffdd00',  // Falstad yellow (no outline)
            
            // Graph settings
            graphHeight: 150,
            timeWindow: 10,  // seconds to show
            
            // Colors (dark cyber aesthetic)
            backgroundColor: '#0a1323',
            gridColor: 'rgba(0, 255, 255, 0.1)',
            axisColor: 'rgba(0, 255, 255, 0.3)',
            textColor: '#00ffff',
            resonanceColor: '#ff00ff',
            
            // Update rate
            fps: 60,
            
            // Scale controls (Falstad compatibility)
            timeScale: options.timeScale || 10,  // seconds to show in graph
            verticalScale: options.verticalScale || 1.0,  // amplitude multiplier
            
            // Display toggles
            showVelocity: true,
            showExternalForce: false,
            showSpringForce: false,
            showDampingForce: false
        };
        
        // D3 scales
        this.scales = {
            position: null,
            time: null,
            frequency: null,
            energy: null
        };
        
        // Animation state
        this.animationId = null;
        this.lastTime = null;
        this.isPaused = false;
        
        // Initialize visualization
        this.initVisualization();
        
        // Start animation
        this.animate();
    }
    
    /**
     * Initialize D3 visualization elements
     */
    initVisualization() {
        // Clear container
        this.container.selectAll('*').remove();
        
        // Create main SVG
        this.svg = this.container.append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background', this.vizConfig.backgroundColor);
        
        // Create layer groups
        this.layers = {
            grid: this.svg.append('g').attr('class', 'grid-layer'),
            spring: this.svg.append('g').attr('class', 'spring-layer'),
            mass: this.svg.append('g').attr('class', 'mass-layer'),
            graphs: this.svg.append('g').attr('class', 'graphs-layer'),
            info: this.svg.append('g').attr('class', 'info-layer'),
            reference: this.svg.append('g').attr('class', 'reference-layer')
        };
        
        // Position elements
        const centerY = this.height * 0.3;
        const centerX = this.width * 0.5;
        
        // Initialize scales
        this.scales.position = d3.scaleLinear()
            .domain([-0.1, 0.1])  // ±10cm range
            .range([centerX - 150, centerX + 150]);
        
        this.scales.time = d3.scaleLinear()
            .domain([0, this.vizConfig.timeWindow])
            .range([50, this.width - 50]);
        
        this.scales.frequency = d3.scaleLog()
            .domain([0.1, 100])
            .range([50, this.width - 50]);
        
        this.scales.energy = d3.scaleLinear()
            .domain([0, 10])
            .range([this.height - 50, this.height - 200]);
        
        // Draw static elements
        this.drawGrid();
        this.drawAxes();
        this.initSpring();
        this.initMass();
        this.initGraphs();
    }
    
    /**
     * Draw background grid
     */
    drawGrid() {
        // No grid - clean display per user preference
        // Grid only added if it serves measurement purpose
    }
    
    /**
     * Draw axes for graphs
     */
    drawAxes() {
        const centerY = this.height * 0.3;
        
        // Position axis
        this.layers.graphs.append('line')
            .attr('x1', this.width * 0.2)
            .attr('y1', centerY)
            .attr('x2', this.width * 0.8)
            .attr('y2', centerY)
            .style('stroke', this.vizConfig.axisColor)
            .style('stroke-width', 2);
        
        // Time axis for position graph
        const graphY = this.height * 0.6;
        this.layers.graphs.append('line')
            .attr('x1', 50)
            .attr('y1', graphY)
            .attr('x2', this.width - 50)
            .attr('y2', graphY)
            .style('stroke', this.vizConfig.axisColor)
            .style('stroke-width', 1);
    }
    
    /**
     * Initialize spring visualization
     */
    initSpring() {
        const centerX = this.width * 0.5;
        const topAnchor = this.height * 0.1;
        
        // Spring path (will be updated during animation)
        this.springPath = this.layers.spring.append('path')
            .attr('class', 'spring')
            .style('stroke', this.vizConfig.textColor)
            .style('stroke-width', 2)
            .style('fill', 'none');
        
        // Fixed anchor point (at top)
        this.layers.spring.append('rect')
            .attr('x', centerX - 20)
            .attr('y', topAnchor - 5)
            .attr('width', 40)
            .attr('height', 10)
            .style('fill', this.vizConfig.axisColor);
    }
    
    /**
     * Initialize mass visualization
     */
    initMass() {
        const centerX = this.width * 0.5;
        const centerY = this.height * 0.3;
        
        // Mass circle
        this.massCircle = this.layers.mass.append('circle')
            .attr('class', 'mass')
            .attr('r', this.vizConfig.massRadius)
            .attr('cx', centerX)
            .attr('cy', centerY)
            .style('fill', this.vizConfig.massColor);
            // No stroke - clean Falstad style
        
        // Velocity arrow
        this.velocityArrow = this.layers.mass.append('line')
            .attr('class', 'velocity-arrow')
            .style('stroke', '#00ff00')
            .style('stroke-width', 3)
            .style('marker-end', 'url(#arrowhead)');
        
        // Create arrowhead marker
        this.svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('markerWidth', 10)
            .attr('markerHeight', 10)
            .attr('refX', 8)
            .attr('refY', 3)
            .attr('orient', 'auto')
            .append('polygon')
            .attr('points', '0 0, 10 3, 0 6')
            .style('fill', '#00ff00');
    }
    
    /**
     * Initialize graphs
     */
    initGraphs() {
        // Position vs Time graph
        this.positionGraph = {
            group: this.layers.graphs.append('g')
                .attr('transform', `translate(0, ${this.height * 0.5})`),
            path: null,
            data: []
        };
        
        // Create path for position graph
        this.positionGraph.path = this.positionGraph.group.append('path')
            .style('stroke', this.vizConfig.textColor)
            .style('stroke-width', 2)
            .style('fill', 'none');
        
        // Frequency response graph
        this.freqResponseGraph = {
            group: this.layers.graphs.append('g')
                .attr('transform', `translate(0, ${this.height * 0.75})`),
            path: null,
            resonanceLine: null
        };
        
        // Create frequency response curve
        this.freqResponseGraph.path = this.freqResponseGraph.group.append('path')
            .style('stroke', this.vizConfig.textColor)
            .style('stroke-width', 2)
            .style('fill', 'none');
        
        // Resonance indicator line
        this.freqResponseGraph.resonanceLine = this.freqResponseGraph.group.append('line')
            .style('stroke', this.vizConfig.resonanceColor)
            .style('stroke-width', 1)
            .style('stroke-dasharray', '5,5');
        
        // Energy bars
        this.energyBars = {
            group: this.layers.graphs.append('g')
                .attr('transform', `translate(${this.width - 100}, ${this.height * 0.3})`),
            kinetic: null,
            potential: null,
            total: null
        };
        
        // Create energy bars
        const barWidth = 20;
        const barSpacing = 25;
        
        // Kinetic energy (green)
        this.energyBars.kinetic = this.energyBars.group.append('rect')
            .attr('x', 0)
            .attr('width', barWidth)
            .style('fill', '#00ff00');
        
        // Potential energy (blue)
        this.energyBars.potential = this.energyBars.group.append('rect')
            .attr('x', barSpacing)
            .attr('width', barWidth)
            .style('fill', '#0088ff');
        
        // Total energy (white)
        this.energyBars.total = this.energyBars.group.append('rect')
            .attr('x', barSpacing * 2)
            .attr('width', barWidth)
            .style('fill', '#ffffff')
            .style('opacity', 0.5);
    }
    
    
    /**
     * Update spring visualization
     */
    updateSpring() {
        const centerX = this.width * 0.5;
        const topAnchor = this.height * 0.1;
        const centerY = this.height * 0.3;
        const massY = centerY + this.physics.position * 500 * this.vizConfig.verticalScale; // Same scale as mass
        
        // Calculate spring compression/extension
        const springLength = massY - topAnchor - this.vizConfig.massRadius;
        const compressionRatio = springLength / this.vizConfig.springRestLength;
        
        // Generate spring path (vertical zigzag)
        // Adjust coil count based on spring length
        const baseCoils = this.vizConfig.springCoils;
        const coils = Math.max(4, Math.min(20, Math.round(baseCoils * compressionRatio)));
        const coilWidth = this.vizConfig.springWidth;
        const coilHeight = springLength / coils;
        
        let path = `M ${centerX} ${topAnchor}`;
        
        for (let i = 0; i < coils; i++) {
            const y1 = topAnchor + i * coilHeight;
            const y2 = topAnchor + (i + 0.5) * coilHeight;
            const y3 = topAnchor + (i + 1) * coilHeight;
            
            path += ` L ${centerX - coilWidth/2} ${y2}`;
            path += ` L ${centerX} ${y3}`;
        }
        
        this.springPath.attr('d', path);
        
        // Color based on compression/extension
        const springColor = compressionRatio < 1 ? 
            d3.interpolateRgb('#00ffff', '#ff0000')(1 - compressionRatio) :
            d3.interpolateRgb('#00ffff', '#00ff00')(compressionRatio - 1);
        
        this.springPath.style('stroke', springColor);
    }
    
    /**
     * Update mass visualization
     */
    updateMass() {
        const centerX = this.width * 0.5;
        const centerY = this.height * 0.3;
        const massY = centerY + this.physics.position * 500 * this.vizConfig.verticalScale; // Apply vertical scale
        
        // Update mass position (vertical movement)
        this.massCircle
            .attr('cx', centerX)
            .attr('cy', massY)
            .attr('r', this.vizConfig.massRadius);  // Allow dynamic radius
        
        // Update velocity arrow (vertical)
        if (this.vizConfig.showVelocity) {
            const velocityScale = 1000;  // Scale factor for visibility
            const arrowLength = this.physics.velocity * velocityScale;
            
            this.velocityArrow
                .attr('x1', centerX)
                .attr('y1', massY)
                .attr('x2', centerX)
                .attr('y2', massY + arrowLength)
                .style('opacity', Math.min(1, Math.abs(this.physics.velocity) * 10))
                .style('display', 'block');
        } else {
            this.velocityArrow.style('display', 'none');
        }
        
        // Glow effect at resonance
        if (this.physics.isNearResonance()) {
            const resonanceStrength = this.physics.getResonanceStrength();
            this.massCircle
                .style('filter', `drop-shadow(0 0 ${20 * resonanceStrength}px ${this.vizConfig.resonanceColor})`);
        } else {
            this.massCircle.style('filter', 'none');
        }
    }
    
    /**
     * Update graphs
     */
    updateGraphs() {
        // Update position graph
        const currentTime = this.physics.time;
        const timeWindow = this.vizConfig.timeWindow;
        
        // Add current position to graph data
        this.positionGraph.data.push({
            time: currentTime,
            position: this.physics.position
        });
        
        // Remove old data
        while (this.positionGraph.data.length > 0 && 
               this.positionGraph.data[0].time < currentTime - timeWindow) {
            this.positionGraph.data.shift();
        }
        
        // Update time scale domain
        this.scales.time.domain([currentTime - timeWindow, currentTime]);
        
        // Generate path
        const line = d3.line()
            .x(d => this.scales.time(d.time))
            .y(d => 50 + d.position * 500 * this.vizConfig.verticalScale)  // Apply vertical scale
            .curve(d3.curveMonotoneX);
        
        this.positionGraph.path.attr('d', line(this.positionGraph.data));
        
        // Update frequency response
        this.updateFrequencyResponse();
        
        // Update energy bars
        this.updateEnergyBars();
    }
    
    /**
     * Update frequency response graph
     */
    updateFrequencyResponse() {
        // Generate frequency response curve
        const response = this.physics.generateFrequencyResponseCurve(0.1, 100, 100);
        
        // Create path
        const line = d3.line()
            .x(d => this.scales.frequency(d.frequency))
            .y(d => -d.magnitudeDB * 2)  // Scale for visibility
            .curve(d3.curveBasis);
        
        this.freqResponseGraph.path.attr('d', line(response));
        
        // Update resonance line
        const resonanceX = this.scales.frequency(this.physics.naturalFrequency);
        this.freqResponseGraph.resonanceLine
            .attr('x1', resonanceX)
            .attr('y1', -50)
            .attr('x2', resonanceX)
            .attr('y2', 50);
        
        // Highlight current driving frequency
        const currentFreqX = this.scales.frequency(this.physics.forceFrequency);
        
        // Add or update current frequency indicator
        let currentIndicator = this.freqResponseGraph.group.select('.current-freq');
        if (currentIndicator.empty()) {
            currentIndicator = this.freqResponseGraph.group.append('circle')
                .attr('class', 'current-freq')
                .attr('r', 5)
                .style('fill', this.vizConfig.massColor);
        }
        
        const currentResponse = this.physics.getFrequencyResponse(this.physics.forceFrequency);
        currentIndicator
            .attr('cx', currentFreqX)
            .attr('cy', -currentResponse.magnitudeDB * 2);
    }
    
    /**
     * Update energy bars
     */
    updateEnergyBars() {
        const maxEnergy = Math.max(this.physics.kineticEnergy, 
                                   this.physics.potentialEnergy, 
                                   this.physics.totalEnergy, 
                                   0.1);
        
        // Update scale
        this.scales.energy.domain([0, maxEnergy]);
        
        // Update bars
        const barHeight = 100;
        
        this.energyBars.kinetic
            .attr('y', -this.physics.kineticEnergy / maxEnergy * barHeight)
            .attr('height', this.physics.kineticEnergy / maxEnergy * barHeight);
        
        this.energyBars.potential
            .attr('y', -this.physics.potentialEnergy / maxEnergy * barHeight)
            .attr('height', this.physics.potentialEnergy / maxEnergy * barHeight);
        
        this.energyBars.total
            .attr('y', -this.physics.totalEnergy / maxEnergy * barHeight)
            .attr('height', this.physics.totalEnergy / maxEnergy * barHeight);
    }
    
    /**
     * Animation loop
     */
    animate() {
        if (this.isPaused) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // Update physics
        const now = performance.now();
        if (this.lastTime) {
            const realDt = (now - this.lastTime) / 1000;  // Convert to seconds
            
            // Run multiple physics steps for stability
            const stepsPerFrame = Math.ceil(realDt / this.physics.dt);
            for (let i = 0; i < stepsPerFrame; i++) {
                this.physics.update();
            }
        }
        this.lastTime = now;
        
        // Update visualizations
        this.updateSpring();
        this.updateMass();
        this.updateGraphs();
        
        // Continue animation
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    /**
     * Control methods
     */
    pause() {
        this.isPaused = true;
    }
    
    play() {
        this.isPaused = false;
    }
    
    reset() {
        this.physics.reset();
        this.positionGraph.data = [];
    }
    
    /**
     * Get control API for tiles
     */
    getControlAPI() {
        return {
            // Direct parameter setters
            setMass: (m) => {
                this.physics.mass = m;
                this.physics.updateDerivedProperties();
            },
            setSpringConstant: (k) => {
                this.physics.springConstant = k;
                this.physics.updateDerivedProperties();
            },
            setDamping: (b) => {
                this.physics.dampingCoefficient = b;
                this.physics.updateDerivedProperties();
            },
            setForceType: (type) => {
                this.physics.forceType = type;
            },
            setForceAmplitude: (A) => {
                this.physics.forceAmplitude = A;
            },
            setForceFrequency: (f) => {
                this.physics.forceFrequency = f;
            },
            setSimulationSpeed: (speed) => {
                this.physics.simulationSpeed = speed;
            },
            
            // Control methods
            pause: () => this.pause(),
            play: () => this.play(),
            reset: () => this.reset(),
            
            // Get state
            getState: () => this.physics.getState(),
            getFrequencyResponse: () => this.physics.generateFrequencyResponseCurve()
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.container.selectAll('*').remove();
    }
}

// Make available globally for testing
window.FalstadOscillator = FalstadOscillator;