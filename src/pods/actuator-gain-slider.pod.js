import { ParameterSliderPod } from './parameter-slider-pod-base.js';

export default class ActuatorGainSliderPod extends ParameterSliderPod {
    static manifest() {
        return {
            type: 'actuator-gain-slider',
            label: 'Input Gain',
            description: 'Actuator gain parameter control',
            version: '1.0.0',
            category: 'actuator-control',
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
            paramId: 'membrane_actuator_gain',
            min: savedState?.min ?? 0.5,
            max: savedState?.max ?? 15.0,
            defaultValue: savedState?.defaultValue ?? 3.0,
            color: savedState?.color ?? '#44ff44',
            drawWaveform(ctx2d, width, height, t) {
                const amp = height * (0.08 + t * 0.38);
                for (let x = 0; x <= width; x++) {
                    const y = height / 2 + amp * Math.sin((x / width) * 3 * Math.PI * 2);
                    if (x === 0) ctx2d.moveTo(x, y);
                    else ctx2d.lineTo(x, y);
                }
            }
        });
    }
}
