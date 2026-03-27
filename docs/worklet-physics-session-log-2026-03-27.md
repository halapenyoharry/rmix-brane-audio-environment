# Worklet Physics Session Log — 2026-03-27

## What we set out to do
Make the membrane visualization physically accurate and visually useful at the same time. The worklet runs physics at 48kHz (audio rate), but the display updates at 60-100Hz — these are fundamentally different timescales and the visual was aliasing badly.

## What worked

### Adaptive snapshot rate
The worklet now measures the actual monitor refresh rate via `requestAnimationFrame` timing and matches its snapshot interval. No more hardcoded 60Hz assumption. Lumen's 100Hz display gets 100Hz snapshots.

### Glue coupling (replacing force injection)
Replaced the old Gaussian force-injection actuator model with geometric glue coupling from the 1D demo. The actuator sphere surface IS the membrane surface at contact points. The wave equation is suspended at driven points (Dirichlet boundary). Waves radiate naturally from footprint edges via the Laplacian seeing enforced heights. This is physically correct — the 1D demo (`oneDdemo/coupling-glue.js`) proved the math.

### Display smoothing (exponential low-pass)
Added a per-sample exponential low-pass filter on display heights. Audio output stays raw (unsmoothed). The display acts like a camera with adjustable shutter speed. Eliminates temporal aliasing (strobing) while preserving spatial patterns. User-controllable via the pink smoothing slider.

### Adaptive smoothing tied to wave speed
smoothFactor scales inversely with waveSpeed: slow physics → responsive display (see every ripple), fast physics → creamy display (see energy envelope). Override via manual slider.

### Power-curve sliders
Damping and wave speed sliders now use power curves (5.0 and 4.0 respectively) so most of the slider travel covers the low end of the range where the interesting physics happens.

### Freeze button
Sets waveSpeed=0, stopping wave propagation. Actuators still drive the membrane (audio still couples). Creates frozen topographic heightmaps of acoustic energy distribution — the basis for the negentropic diffusion hypothesis.

### Heightmap export
📷 button exports current membrane state as grayscale PNG. ComfyUI pipeline scripted for img2img generation using heightmaps as structured initialization.

### Actuator visual tracking from worklet snapshot
When worklet is active, actuator ball positions read from worklet snapshot heights instead of stale main-thread physics array.

### Null guards on worklet node methods
setWaveSpeed, setDamping, setActuatorGain, setSnapshotRate now check `this.node` before posting messages, preventing TypeError during initialization race.

## What didn't work / problems found

### Time-averaging snapshots (mean of all samples in frame)
Attempted to average heights across all samples in the snapshot interval. Symmetric oscillations average to zero — the membrane appeared flat because positive and negative peaks cancel. Replaced with exponential smoothing which preserves the envelope.

### Smoothing too aggressive
Initial smoothFactor of 0.002 had a cutoff of ~15Hz, making all audio-frequency oscillations invisible. C4 (262Hz) on the piano with zero damping showed no propagation. Fixed by making smoothing adaptive and adding the manual slider.

### Sphere rest dome (DC artifact from geometry)
The sphere surface at non-center footprint points is above zero at rest (curvature). This created a permanent dome that propagated as waves even with zero audio input. Fixed by subtracting the rest shape: displacement now scales by `sqrt(r²-d²)/r` so all points are zero at rest.

### Legacy slider disconnect
The pod parameter store (`ctx.setParameter`) was disconnected from `window.waveSpeed` which the monolith actually reads. Slider changes weren't reaching the worklet. Fixed by updating the legacy tile config (`tiles-config.json`) which writes directly to window globals.

### Actuator footprint too small
With radius scaling through `workletGridSize/gridSize` (32/100 = 0.32), actuator footprints collapsed to 1 grid cell. Single-cell driven points produce minimal Laplacian gradient. Fixed with `Math.max(3, ...)` minimum radius.

## Architecture notes

### The smoothing lives in the right layer
Per the DC cone paper's layer discipline:
- Layer 2 (physics): wave equation, unmodified, correct
- Layer 3 (rendering): smoothing filter, adjustable, separate
- Audio output: raw physics, never smoothed

### The "creamy" branch was accidentally correct
The old creamy branch ran physics at frame rate (~60Hz). This was implicitly a perfect anti-aliasing filter — you can't produce frequencies above half the frame rate. The worklet version achieves the same visual with explicit smoothing while running physics 800x faster underneath.

## Version
v0.4.0-worklet-physics
