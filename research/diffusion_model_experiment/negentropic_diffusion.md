Negentropic Initialization of Diffusion Models via Paused Audio-Driven Finite-Difference Wave Simulations

(Or: How I Accidentally Bypassed AI Slop While Trying to Stop a Strobe Effect)

Author: Harold Young [humxn]

Abstract

Current latent diffusion models initialize image generation using pure Gaussian noise. This state represents maximum entropy and zero structural hierarchy. Consequently, the model must calculate all compositional structure from text prompts alone, frequently resulting in visually generic outputs ("slop"). We propose a negentropic initialization method. By driving a 2D finite-difference wave equation simulation with an audio signal, applying an exponential smoothing filter to average the visual output, and pausing the wave propagation ($c^2 = 0$), we extract a static heightmap. This heightmap represents the physical topology of acoustic energy. Using this heightmap as an img2img initialization state constrains the diffusion model to a mathematically balanced compositional scaffolding, significantly improving the structural organization of the generated image.

1. Introduction

This discovery was an accident that occurred during the development of "rmix" (formerly Brane Audio Environment), a Web Audio system designed to visualize audio frequencies on a simulated 2D membrane.

The original goal was to accurately simulate physics at the audio sample rate (48,000 Hz). A visual aliasing problem occurred because the monitor refresh rate (~60-100 Hz) was undersampling the physics simulation, resulting in a severe visual strobe effect. To fix this, an exponential low-pass smoothing filter was applied to the display heights. This allowed the human eye to see the time-averaged energy envelope (the standing wave nodes and antinodes) instead of instantaneous, strobing peaks.

During testing, a "freeze" function was implemented to stop the wave propagation. It became apparent that the resulting static patterns possessed inherent structural hierarchy, symmetry, and balance. This led to the hypothesis: what if a diffusion model started with this physical structure instead of randomized pixels?

2. Methodology

2.1 The Physics Engine

The system runs a 2D wave equation simulation. Rather than using force injection (which physically models an object passing through the membrane), the system uses geometric "glue coupling." The audio signal dictates the vertical displacement of an actuator (a sphere). At the contact points, the membrane surface and the actuator share exact geometry.

The wave equation calculates the propagation of these displacements across a grid based on user-defined wave speed ($c$) and damping values.

2.2 The "Freeze" State and Topography Extraction

When the system is paused, the wave speed is set to zero. This eliminates the Laplacian term in the wave equation, stopping information from traveling between grid cells. However, the audio signal continues to drive the actuator points, and the exponential display smoothing continues to run.

The resulting state is a locked physical heightmap of wave interference patterns. This heightmap is exported as a grayscale PNG, where luminance values directly correspond to vertical membrane displacement.

2.3 Diffusion Initialization

The grayscale PNG is uploaded to a local ComfyUI instance running Stable Diffusion XL (SDXL). Instead of initializing the generation with a tensor of Gaussian noise, the diffusion model uses the grayscale heightmap as the starting state (via img2img or a depth-control mechanism). The user then provides a text prompt.

3. Discussion: Why This Works

Standard diffusion models default to the most statistically probable pixel arrangements found in their training data when building structure from noise. This often results in a lack of strong compositional intent.

By starting with a frozen wave simulation, we provide the model with a negentropic foundation. The mathematics of standing waves inherently produce:

Hierarchy: Fundamental modes and harmonic frequencies create primary and secondary visual focal points.

Symmetry and Breaking: Boundary reflections create organized patterns, while complex audio inputs create natural variations within that symmetry.

Physical Balance: The conservation of energy within the simulated boundary distributes intensity in a way that aligns with physical laws.

The diffusion model is no longer required to calculate basic compositional organization. It treats the topological energy distribution as structural scaffolding. It calculates the final pixels according to the text prompt, but the placement of those pixels is strictly guided by the physical wave interference pattern.

4. Conclusion

Using a paused 2D acoustic wave simulation as an initialization state for a diffusion model provides a physically structured starting point. This prevents the model from defaulting to statistically average compositions, resulting in images that possess the structural characteristics of actual physical systems.
