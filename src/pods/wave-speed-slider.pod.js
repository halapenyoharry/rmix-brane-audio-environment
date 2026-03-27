import { ParameterSliderPod } from './parameter-slider-pod-base.js';

export default class WaveSpeedSliderPod extends ParameterSliderPod {
    static manifest() {
        return {
            type: 'wave-speed-slider',
            label: 'Wave Speed',
            description: 'Membrane wave speed parameter control',
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
            paramId: 'membrane_wave_speed',
            min: savedState?.min ?? 0.00005,
            max: savedState?.max ?? 0.333,
            defaultValue: savedState?.defaultValue ?? 0.3,
            color: savedState?.color ?? '#4444ff',
            drawWaveform(ctx2d, width, height, t) {
                const cycles = 1 + t * 7;
                const amp = height * 0.35;
                for (let x = 0; x <= width; x++) {
                    const y = height / 2 + amp * Math.sin((x / width) * cycles * Math.PI * 2);
                    if (x === 0) ctx2d.moveTo(x, y);
                    else ctx2d.lineTo(x, y);
                }
            }
        });
    }
}
