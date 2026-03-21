import { Pod } from '../pod-runtime.js';

const KEY_MAP = {
    a: 0,
    w: 1,
    s: 2,
    e: 3,
    d: 4,
    f: 5,
    t: 6,
    g: 7,
    y: 8,
    h: 9,
    u: 10,
    j: 11,
    k: 12
};

const NOTE_POSITION_MAP = {
    0: 0.06,
    1: 0.12,
    2: 0.19,
    3: 0.25,
    4: 0.32,
    5: 0.43,
    6: 0.49,
    7: 0.57,
    8: 0.63,
    9: 0.71,
    10: 0.77,
    11: 0.84,
    12: 0.94
};

const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11, 12];
const BLACK_NOTES = [1, 3, null, 6, 8, 10, null];
const WHITE_LABELS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export default class KeyboardInstrumentPod extends Pod {
    static manifest() {
        return {
            type: 'keyboard-instrument',
            label: 'Keyboard',
            description: 'Keyboard instrument that outputs audio for core actuators',
            version: '1.0.0',
            category: 'instrument',
            defaultSize: { w: 320, h: 100 },
            resizable: false,
            singleton: true,
            ports: {
                inputs: [],
                outputs: [
                    { name: 'audio-out', type: 'audio' }
                ]
            }
        };
    }

    constructor(ctx, savedState) {
        super(ctx, savedState);
        this.octave = savedState?.octave ?? 4;
        this.forceRadius = savedState?.radius ?? 3;
        this.forceValue = savedState?.value ?? 2.5;
        this.color = savedState?.color ?? '#00e5ff';
        this.blockSize = savedState?.blockSize ?? 128;
        this.activeNotes = new Map();
        this.activeKeyBindings = new Map();
        this.elements = null;
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
    }

    render(container = this.container) {
        super.render(container);
        if (!container || this.elements) {
            this.syncVisuals();
            return;
        }

        container.style.cssText = `
            width: 100%; height: 100%; display: flex; flex-direction: column;
            background: rgba(10, 14, 39, 0.85); border-radius: 6px;
            overflow: hidden; user-select: none;
            border: 1px solid rgba(0, 229, 255, 0.15);
        `;

        const topBar = document.createElement('div');
        topBar.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 4px 8px; height: 24px; flex-shrink: 0;
            background: rgba(0, 229, 255, 0.08);
            border-bottom: 1px solid rgba(0, 229, 255, 0.15);
            color: ${this.color}; font-size: 10px;
        `;

        const octaveControls = document.createElement('div');
        octaveControls.style.cssText = 'display: flex; align-items: center; gap: 6px;';

        const downButton = this.createMiniButton('◀', () => {
            this.octave = clamp(this.octave - 1, 1, 7);
            this.syncVisuals();
        });
        const octaveLabel = document.createElement('span');
        octaveLabel.style.cssText = 'min-width: 24px; text-align: center;';
        const upButton = this.createMiniButton('▶', () => {
            this.octave = clamp(this.octave + 1, 1, 7);
            this.syncVisuals();
        });

        octaveControls.appendChild(downButton);
        octaveControls.appendChild(octaveLabel);
        octaveControls.appendChild(upButton);

        const modeLabel = document.createElement('span');
        modeLabel.textContent = 'audio-out';
        modeLabel.style.opacity = '0.7';

        topBar.appendChild(octaveControls);
        topBar.appendChild(modeLabel);
        container.appendChild(topBar);

        const keysContainer = document.createElement('div');
        keysContainer.style.cssText = 'flex: 1; position: relative; display: flex; padding: 2px 2px 4px 2px;';

        const keys = [];

        WHITE_NOTES.forEach((note, index) => {
            const key = document.createElement('div');
            key.style.cssText = `
                flex: 1; margin: 0 1px; position: relative; z-index: 1;
                display: flex; align-items: flex-end; justify-content: center;
                padding-bottom: 2px; cursor: pointer; border-radius: 0 0 3px 3px;
                border: 1px solid rgba(0, 0, 0, 0.3); font-size: 7px;
                color: rgba(0, 0, 0, 0.35); transition: background 0.05s, box-shadow 0.05s;
            `;
            key.textContent = WHITE_LABELS[index];
            this.attachPointerHandlers(key, note);
            keysContainer.appendChild(key);
            keys.push({ element: key, note, black: false });
        });

        BLACK_NOTES.forEach((note, index) => {
            if (note === null) return;
            const key = document.createElement('div');
            const leftPct = ((index + 0.7) / WHITE_NOTES.length) * 100;
            key.style.cssText = `
                position: absolute; left: ${leftPct}%; top: 2px; z-index: 2;
                width: ${100 / WHITE_NOTES.length * 0.6}%; height: 58%;
                cursor: pointer; border-radius: 0 0 2px 2px;
                border: 1px solid rgba(0, 229, 255, 0.1);
                transition: background 0.05s, box-shadow 0.05s;
            `;
            this.attachPointerHandlers(key, note);
            keysContainer.appendChild(key);
            keys.push({ element: key, note, black: true });
        });

        container.appendChild(keysContainer);

        document.addEventListener('keydown', this.boundKeyDown);
        document.addEventListener('keyup', this.boundKeyUp);

        this.elements = {
            octaveLabel,
            keys
        };

        this.syncVisuals();
    }

    update() {
        this.ctx.writePort('audio-out', this.buildAudioBuffer());
    }

    serialize() {
        return {
            octave: this.octave,
            radius: this.forceRadius,
            value: this.forceValue,
            color: this.color,
            blockSize: this.blockSize
        };
    }

    destroy() {
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
    }

    createMiniButton(label, onClick) {
        const button = document.createElement('span');
        button.textContent = label;
        button.style.cssText = 'cursor: pointer; opacity: 0.7; font-size: 9px;';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
        return button;
    }

    attachPointerHandlers(element, note) {
        const startNote = () => {
            const id = `${this.octave}:${note}`;
            element.dataset.activeNoteId = id;
            this.noteOn(id, note, this.octave);
        };

        const stopNote = () => {
            const id = element.dataset.activeNoteId;
            if (!id) return;
            this.noteOff(id);
            delete element.dataset.activeNoteId;
        };

        element.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            startNote();
        });

        element.addEventListener('mouseup', () => {
            stopNote();
        });

        element.addEventListener('mouseleave', () => {
            stopNote();
        });

        element.addEventListener('touchstart', (event) => {
            event.preventDefault();
            event.stopPropagation();
            startNote();
        }, { passive: false });

        element.addEventListener('touchend', (event) => {
            event.preventDefault();
            stopNote();
        });
    }

    handleKeyDown(event) {
        if (event.repeat) return;
        if (this.shouldIgnoreKeyEvent(event)) return;

        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
            event.preventDefault();
            this.octave = clamp(this.octave + 1, 1, 7);
            this.syncVisuals();
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
            event.preventDefault();
            this.octave = clamp(this.octave - 1, 1, 7);
            this.syncVisuals();
            return;
        }

        const note = KEY_MAP[event.key.toLowerCase()];
        if (note === undefined) return;

        event.preventDefault();
        const id = `${this.octave}:${note}`;
        this.activeKeyBindings.set(event.key.toLowerCase(), id);
        this.noteOn(id, note, this.octave);
    }

    handleKeyUp(event) {
        if (this.shouldIgnoreKeyEvent(event)) return;

        const note = KEY_MAP[event.key.toLowerCase()];
        if (note === undefined) return;

        event.preventDefault();
        const key = event.key.toLowerCase();
        const id = this.activeKeyBindings.get(key);
        if (!id) return;
        this.activeKeyBindings.delete(key);
        this.noteOff(id);
    }

    shouldIgnoreKeyEvent(event) {
        const target = event.target;
        if (!target || !target.tagName) return false;
        const tagName = target.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    }

    noteOn(id, note, octave) {
        const existing = this.activeNotes.get(id);
        this.activeNotes.set(id, {
            note,
            octave,
            phase: existing?.phase ?? 0
        });
        this.syncVisuals();
    }

    noteOff(id) {
        if (!this.activeNotes.has(id)) return;
        this.activeNotes.delete(id);
        this.syncVisuals();
    }

    midiToFrequency(pitch) {
        return 440 * Math.pow(2, (pitch - 69) / 12);
    }

    buildAudioBuffer() {
        const buffer = new Float32Array(this.blockSize);
        if (this.activeNotes.size === 0) {
            return buffer;
        }

        const sampleRate = this.ctx.getAudioContext()?.sampleRate ?? 48000;
        const activeNotes = Array.from(this.activeNotes.entries());

        for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex++) {
            let mixedSample = 0;

            activeNotes.forEach(([id, noteState]) => {
                const pitch = noteState.octave * 12 + noteState.note;
                const frequency = this.midiToFrequency(pitch);
                mixedSample += Math.sin(noteState.phase);
                noteState.phase += (2 * Math.PI * frequency) / sampleRate;
                if (noteState.phase > Math.PI * 2) {
                    noteState.phase -= Math.PI * 2;
                }
                this.activeNotes.set(id, noteState);
            });

            const normalizedSample = mixedSample / Math.max(1, activeNotes.length);
            buffer[sampleIndex] = normalizedSample * 0.35;
        }

        return buffer;
    }

    syncVisuals() {
        if (!this.elements) return;

        this.elements.octaveLabel.textContent = `C${this.octave}`;

        this.elements.keys.forEach(({ element, note, black }) => {
            const isActive = this.activeNotes.has(`${this.octave}:${note}`);
            if (black) {
                element.style.background = isActive
                    ? `linear-gradient(to bottom, ${this.color}, #01232a)`
                    : 'linear-gradient(to bottom, #222, #000)';
                element.style.boxShadow = isActive ? `0 0 10px ${this.color}` : 'none';
            } else {
                element.style.background = isActive
                    ? `linear-gradient(to bottom, #d7fbff, ${this.color})`
                    : 'linear-gradient(to bottom, #e8e8e8, #ffffff)';
                element.style.boxShadow = isActive ? `inset 0 0 0 1px ${this.color}` : 'none';
            }
        });
    }
}
