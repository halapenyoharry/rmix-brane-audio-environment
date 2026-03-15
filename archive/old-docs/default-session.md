# Default Session Documentation

**File:** `default-session.json`  
**Purpose:** Minimal working example to get started

---

## Structure Overview

This session file contains:
- 1 test oscillator (440Hz sine wave)
- 1 actuator (ball on membrane)
- 1 collector (audio output point)
- Essential membrane physics parameters
- All required mapping curves

---

## Sources

**`source_demo`** - Test oscillator
- Generates 440Hz sine wave
- FFT analysis: 2048 bins, Hann window
- Use for testing without external audio

To add JACK input, add a new source:
```json
{
  "id": "source_guitar",
  "type": "jack",
  "label": "Guitar Input",
  "config": {
    "jackPort": "system:capture_1"
  }
}
```

---

## Actuators (Balls)

**`ball_demo`** - Single test actuator
- Position: Center of membrane (0, 0), 5mm above surface
- Size: 15mm radius
- Opacity: 0.7 (moderate Q factor)

### What Each Property Does:

**position.x, position.y** - Location on membrane (-50 to +50)  
**position.z** - Height above membrane (0-20) → affects gain  
**size.radius_mm** - Ball size (2-50mm) → affects frequency  
**appearance.opacity** - Transparency (0.1-1.0) → affects Q factor

### Gesture Controls:
- Drag left/right: Change size (frequency)
- Drag up/down: Change z-height (gain)
- Scroll wheel: Change opacity (Q factor)

### Computed Properties:
These are NOT in the file, calculated at runtime:
- frequency_center_hz: From size using mapping curve
- q_factor: From opacity using mapping curve
- gain: From z-height using mapping curve
- color: From frequency using mapping curve

---

## Collectors

**`collector_demo`** - Single audio output
- Position: 20mm to the right of center
- Mode: Point sampling (reads single grid point)
- Output: Master stereo bus, left channel

Collectors read membrane displacement and convert to audio output.

---

## Parameters

### Membrane Physics

**wave_speed** (0.3)
- How fast waves propagate through membrane
- Higher = faster wave motion
- Smoothed: Yes (50ms exponential)

**damping** (0.00265)
- Energy loss per cycle
- Lower = bouncier, longer sustain
- Higher = more viscous, quick decay
- Smoothed: No (physics accuracy)

**boundary_type** ("fixed")
- fixed: Drum head (Dirichlet boundary)
- free: Reflecting boundary (Neumann)
- infinite: Absorbing boundary

### Visual

**color_map** ("interpolateSpectral")
- D3 color scale for membrane height visualization
- Options: Spectral, Viridis, Plasma, Inferno, Turbo

---

## Mapping Curves

These define how spatial properties map to audio properties.

### actuator_size_to_frequency
- **Formula:** freq = freq_max × (size / size_max)^(-2)
- **Effect:** Smaller balls respond to higher frequencies
- **Example:** 2mm ball → 20kHz, 50mm ball → 20Hz

### actuator_transparency_to_q
- **Formula:** q = q_min + (1 - opacity) × (q_max - q_min)
- **Effect:** Transparent balls = wide Q (all freqs), Opaque = narrow Q (selective)
- **Example:** opacity 0.1 → q=90 (very selective), opacity 1.0 → q=0.1 (broad)

### actuator_z_to_gain
- **Formula:** gain = base_gain / (1 + (z / scale)^2)
- **Effect:** Closer to membrane = stronger coupling
- **Example:** z=0 → gain=10, z=10 → gain=2.5, z=20 → gain=0.625

### actuator_gaussian_spread
- **Formula:** sigma = size × spread_factor
- **Effect:** Larger balls influence wider area on membrane
- **Example:** 10mm ball → 20mm spread, 30mm ball → 60mm spread

### frequency_to_color
- **Formula:** hue = 240 - (log10(freq) / log10(20000)) × 240
- **Effect:** Visual feedback - frequency determines ball color
- **Example:** 20Hz → red, 1kHz → green, 20kHz → blue

---

## Modifying This File

### Safe to Edit:
- actuator positions, sizes, opacity
- parameter values (within min/max ranges)
- enabled flags
- UI colors

### Validate Before Editing:
- All `sourceId` references must point to existing source `id`
- Numeric values must respect min/max ranges
- IDs must be unique within their category
- `fftSize` must be power of 2

### Adding a New Actuator:
1. Copy the `ball_demo` object
2. Change the `id` to something unique
3. Change `position`, `size`, `opacity` as desired
4. Ensure `sourceId` points to an existing source

### Adding a New Source:
1. Add to `sources` array
2. Give it a unique `id`
3. Set `type` to: "jack", "file", "microphone", or "oscillator"
4. Configure `config` section based on type
5. Create actuators that reference this source

---

## Performance Settings

**target_fps**: 60  
**auto_quality**: true - automatically reduces quality if FPS drops  
**quality_threshold**: 55 - FPS below this triggers quality reduction

Auto-quality will:
- Reduce mesh density if FPS < 55
- Reduce grid size if FPS < 45  
- Disable some collectors if FPS < 30

---

## Validation Rules

The parser checks these on load:
- Version compatibility
- All ID references are valid
- Numeric parameters within ranges
- Required fields present
- No duplicate IDs

---

## Next Steps

1. Load this file in your application
2. Test that the oscillator creates membrane waves
3. Try dragging the ball around
4. Add your own sources and actuators
5. Save to a new session file

See INTEGRATION-GUIDE.md for implementation details.
