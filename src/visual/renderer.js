/**
 * Three.js Renderer — scene, camera, lighting, geometry, material, mesh update.
 *
 * Plain IIFE revealing module. Not an ES module (yet) because the monolith's
 * main <script> is synchronous and needs window._renderer at parse time.
 * When the monolith becomes a module, convert to real exports.
 *
 * API:
 *   window._renderer.init(container) → { scene, camera, renderer, controls, membrane, material }
 *   window._renderer.updateMesh(snapshot, workletGridSize, renderGridSize, fallbackHeights?)
 *   window._renderer.rebuildGeometry(newGridSize)
 */
(function () {
    // ── Module state (set by init, used by updateMesh/rebuildGeometry) ──
    let _scene, _camera, _renderer, _controls;
    let _membrane, _material, _geometry;
    const _membraneSize = 200;

    /**
     * Initialize the Three.js scene, camera, renderer, controls, lighting,
     * geometry, material, and membrane mesh. Appends the canvas to `container`.
     *
     * Returns refs that the monolith needs for things we haven't extracted yet
     * (raycasting, actuator sphere management, animate loop, etc).
     *
     * @param {HTMLElement} container
     * @returns {{ scene, camera, renderer, controls, membrane, material }}
     */
    function init(container) {
        // Scene
        _scene = new THREE.Scene();
        _scene.background = new THREE.Color(0x0a0e27);

        // Camera — elevated centered view, membrane fills frame
        _camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.01,
            5000
        );
        _camera.position.set(0, 120, 60);
        _camera.lookAt(0, 0, 0);

        // WebGL renderer
        _renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: document.createElement('canvas')
        });
        _renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(_renderer.domElement);

        // Orbit controls
        _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
        _controls.enableDamping = true;
        _controls.dampingFactor = 0.05;
        _controls.target.set(0, 0, 0);

        // Lighting — Harold's midnight alaska aesthetic
        const ambientLight = new THREE.AmbientLight(0x1a237e, 0.4);
        _scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0x00e5ff, 0.6);
        directionalLight.position.set(100, 100, 50);
        _scene.add(directionalLight);

        // Geometry
        _geometry = new THREE.PlaneGeometry(_membraneSize, _membraneSize, 100, 100);

        // Shader material — full spectrum sweep centered on cyan at rest
        _material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                waveHeight: { value: 20.0 },
                opacity: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying float vHeight;

                void main() {
                    vPosition = position;
                    vHeight = position.z;
                    vNormal = normal;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float opacity;
                uniform float time;

                varying vec3 vNormal;
                varying vec3 vPosition;
                varying float vHeight;

                vec3 hsl2rgb(float h, float s, float l) {
                    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
                }

                void main() {
                    float t = (vHeight + 10.0) / 20.0;
                    t = clamp(t, 0.0, 1.0);

                    // Full spectrum sweep centered on cyan at rest (height=0, t=0.5)
                    float hue = mod(0.5 + (t - 0.5) * 0.75, 1.0);
                    vec3 color = hsl2rgb(hue, 1.0, 0.5);

                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    float diff = max(dot(vNormal, lightDir), 0.0);
                    color *= (0.7 + diff * 0.3);

                    gl_FragColor = vec4(color, opacity);
                }
            `,
            transparent: false,
            side: THREE.DoubleSide,
            wireframe: false,
            depthWrite: true,
            depthTest: true
        });

        // Membrane mesh
        _membrane = new THREE.Mesh(_geometry, _material);
        _membrane.rotation.x = -Math.PI / 2;
        _scene.add(_membrane);

        // Resize handler
        function handleResize() {
            _camera.aspect = window.innerWidth / window.innerHeight;
            _camera.updateProjectionMatrix();
            _renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', handleResize);

        return {
            scene: _scene,
            camera: _camera,
            renderer: _renderer,
            controls: _controls,
            membrane: _membrane,
            material: _material
        };
    }

    /**
     * Update geometry vertex positions from a worklet height snapshot.
     * Handles bilinear upsampling when workletGridSize !== renderGridSize.
     * Handles the fallback path (main-thread physics heights as 2D array).
     *
     * @param {Float32Array|null} snapshot — flat array from worklet, or null for fallback
     * @param {number} workletGridSize — grid dimension the worklet operates at
     * @param {number} renderGridSize — grid dimension of the Three.js PlaneGeometry
     * @param {number[][]} [fallbackHeights] — 2D array from main-thread physics (fallback only)
     */
    function updateMesh(snapshot, workletGridSize, renderGridSize, fallbackHeights) {
        const positions = _membrane.geometry.attributes.position.array;
        const waveH = _material.uniforms.waveHeight.value;

        if (snapshot) {
            const ws = workletGridSize;
            const wStride = ws + 1;
            const rs = renderGridSize;
            const rStride = rs + 1;

            if (ws === rs) {
                // Same resolution — direct copy
                for (let i = 0; i <= rs; i++) {
                    for (let j = 0; j <= rs; j++) {
                        const posIdx = (i * rStride + j) * 3 + 2;
                        positions[posIdx] = snapshot[i * wStride + j] * waveH;
                    }
                }
            } else {
                // Bilinear upsample from worklet grid to render grid
                const scale = ws / rs;
                for (let i = 0; i <= rs; i++) {
                    for (let j = 0; j <= rs; j++) {
                        const fi = i * scale;
                        const fj = j * scale;
                        const i0 = Math.min(Math.floor(fi), ws - 1);
                        const j0 = Math.min(Math.floor(fj), ws - 1);
                        const i1 = Math.min(i0 + 1, ws);
                        const j1 = Math.min(j0 + 1, ws);
                        const ti = fi - i0;
                        const tj = fj - j0;

                        const h00 = snapshot[i0 * wStride + j0];
                        const h10 = snapshot[i1 * wStride + j0];
                        const h01 = snapshot[i0 * wStride + j1];
                        const h11 = snapshot[i1 * wStride + j1];

                        const h = (1 - ti) * (1 - tj) * h00 +
                                  ti * (1 - tj) * h10 +
                                  (1 - ti) * tj * h01 +
                                  ti * tj * h11;

                        const posIdx = (i * rStride + j) * 3 + 2;
                        positions[posIdx] = h * waveH;
                    }
                }
            }
        } else if (fallbackHeights) {
            // Fallback: main-thread physics
            for (let i = 0; i <= renderGridSize; i++) {
                for (let j = 0; j <= renderGridSize; j++) {
                    const index = (i * (renderGridSize + 1) + j) * 3 + 2;
                    positions[index] = fallbackHeights[i][j] * waveH;
                }
            }
        }

        _membrane.geometry.attributes.position.needsUpdate = true;
        _membrane.geometry.computeVertexNormals();
    }

    /**
     * Rebuild the membrane geometry at a new grid resolution.
     * Disposes the old geometry to prevent leaks.
     *
     * @param {number} newGridSize
     */
    function rebuildGeometry(newGridSize) {
        _membrane.geometry.dispose();
        _membrane.geometry = new THREE.PlaneGeometry(
            _membraneSize, _membraneSize, newGridSize, newGridSize
        );
    }

    // Expose on window for synchronous access by the main script
    window._renderer = { init: init, updateMesh: updateMesh, rebuildGeometry: rebuildGeometry };
})();
