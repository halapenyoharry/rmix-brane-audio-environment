import { Pod } from '../pod-runtime.js';

function hexToRgb(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

export function drawParameterWaveform(canvas, config, value) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const t = (value - config.min) / (config.max - config.min);

    ctx.strokeStyle = `rgba(${hexToRgb(config.color)}, 0.12)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.strokeStyle = config.color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = config.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();

    config.drawWaveform(ctx, width, height, t);

    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(${hexToRgb(config.color)}, 0.7)`;
    ctx.font = '8px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(value.toPrecision(4), width - 2, height - 2);
}

export class ParameterSliderPod extends Pod {
    constructor(ctx, savedState, config) {
        super(ctx, savedState);
        this.config = config;
        const savedValue = Number(savedState?.value);
        this.value = Number.isFinite(savedValue)
            ? savedValue
            : (ctx.getParameter(config.paramId) ?? config.defaultValue);
        this.ctx.setParameter(this.config.paramId, this.value);
        this.elements = null;
    }

    render(container = this.container) {
        super.render(container);
        if (!container || this.elements) {
            this.syncVisuals();
            return;
        }

        container.style.cssText = 'width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 6px; gap: 5px;';

        const canvas = document.createElement('canvas');
        canvas.width = this.ctx.getSize().w - 12;
        canvas.height = this.ctx.getSize().h - 28;
        canvas.style.cssText = 'width: 100%; flex: 1; display: block; cursor: default;';
        container.appendChild(canvas);

        const track = document.createElement('div');
        track.style.cssText = `
            width: 100%; height: 4px;
            background: rgba(${hexToRgb(this.config.color)}, 0.2);
            border-radius: 2px; position: relative; cursor: pointer; flex-shrink: 0;
        `;

        const thumb = document.createElement('div');
        thumb.style.cssText = `
            position: absolute;
            width: 12px; height: 12px;
            background: ${this.config.color};
            border-radius: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            cursor: pointer;
            box-shadow: 0 0 8px ${this.config.color};
        `;

        track.appendChild(thumb);
        container.appendChild(track);

        const setValue = (value) => {
            const clamped = Math.max(this.config.min, Math.min(this.config.max, value));
            this.value = clamped;
            this.ctx.setParameter(this.config.paramId, clamped);
            this.ctx.writePort('param-out', { id: this.config.paramId, value: clamped });
            this.syncVisuals();
        };

        let isDragging = false;
        thumb.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            isDragging = true;
            thumb.style.transform = 'translate(-50%, -50%) scale(1.3)';
            const rect = track.getBoundingClientRect();
            const onMove = (moveEvent) => {
                if (!isDragging) return;
                const pct = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                setValue(this.config.min + pct * (this.config.max - this.config.min));
            };
            const onUp = () => {
                isDragging = false;
                thumb.style.transform = 'translate(-50%, -50%)';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            onMove(event);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        track.addEventListener('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const step = (this.config.max - this.config.min) * 0.02;
            setValue(this.value + (event.deltaY < 0 ? step : -step));
        }, { passive: false });

        this.elements = { canvas, thumb };
        this.syncVisuals();
    }

    update() {
        const current = this.ctx.getParameter(this.config.paramId);
        if (typeof current === 'number' && current !== this.value) {
            this.value = current;
        }
    }

    syncVisuals() {
        if (!this.elements) return;
        const pct = (this.value - this.config.min) / (this.config.max - this.config.min);
        this.elements.thumb.style.left = `${pct * 100}%`;
        drawParameterWaveform(this.elements.canvas, this.config, this.value);
    }

    serialize() {
        return {
            value: this.ctx.getParameter(this.config.paramId) ?? this.value,
            min: this.config.min,
            max: this.config.max,
            defaultValue: this.config.defaultValue,
            color: this.config.color
        };
    }
}
