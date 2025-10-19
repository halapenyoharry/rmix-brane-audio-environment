# RMIX Audio Environment Development Plan

## Current Assets
✅ **Wave Physics Core** (membrane-physics-core.js)
- Wave equation solver running at 1% GPU
- Mouse strike interaction
- Configurable boundaries (fixed/free/infinite, square/circle)
- Real-time height field with damping

## Integration Plan

### Phase 1: Audio Source Integration
**Need from Harry:** How you want to inject audio signals
- [ ] Convert audio samples to membrane strikes
- [ ] Map frequency to position or wave parameters
- [ ] Multiple simultaneous sources

### Phase 2: JACK Bridge Integration
**Need from Harry:** JACK bridge code/extension
- [ ] Connect membrane physics to JACK
- [ ] Route collector outputs to JACK channels
- [ ] Real-time audio streaming

### Phase 3: Collector Implementation
- [ ] Omnidirectional collectors (sample at point)
- [ ] Cardioid pattern collectors
- [ ] Figure-8/ribbon collectors
- [ ] Custom drawn collection shapes

### Phase 4: Actuator System
**Need from Harry:** Actuator interface code
- [ ] Oscillator-based sources
- [ ] File playback sources
- [ ] Live input sources

### Phase 5: Visualization Enhancement
**Need from Harry:** Any special shader requirements
- [ ] Signal flow visualization
- [ ] Frequency coloring
- [ ] Phase patterns

## Architecture
```
Audio Input → Source Nodes → Membrane Physics (existing)
                                    ↓
Collectors (new) → JACK Bridge → Audio Output
                ↓
        Visual Feedback (enhanced)
```