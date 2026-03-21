import { ParameterSliderPod } from './parameter-slider-pod-base.js';

export default class DampingSliderPod extends ParameterSliderPod {
    static manifest() {
        return {
            type: 'damping-slider',
            label: 'Damping',
            description: 'Membrane damping parameter control',
            version: '1.0.0',
            category: 'physics-control',
            defaultSize: { w: 160, h: 90 },
            resizable: false,
            singleton: true,
            ports: {
                inputs: [],
                outputs: [
                    { name: 'param-out', type: 'parameter' }
                ]
            }
        };
    }

    constructor(ctx, savedState) {
        super(ctx, savedState, {
            paramId: 'membrane_damping',
            min: savedState?.min ?? 0,
            max: savedState?.max ?? 0.05,
            defaultValue: savedState?.defaultValue ?? 0.01,
            color: savedState?.color ?? '#ff4444',
            drawWaveform(ctx2d, width, height, t) {
                const decayRate = 1 + t * 18;
                const amp = height * 0.38;
                for (let x = 0; x <= width; x++) {
                    const tx = x / width;
                    const env = Math.exp(-decayRate * tx);
                    const y = height / 2 + amp * env * Math.sin(tx * 5 * Math.PI * 2);
                    if (x === 0) ctx2d.moveTo(x, y);
                    else ctx2d.lineTo(x, y);
                }
            }
        });
    }
}
