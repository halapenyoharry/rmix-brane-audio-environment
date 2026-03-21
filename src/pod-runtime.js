export class Pod {
    constructor(ctx, savedState) {
        this.ctx = ctx;
        this.savedState = savedState || {};
        this.container = null;
    }

    static manifest() {
        return {
            type: 'pod',
            label: 'Pod',
            description: '',
            version: '1.0.0',
            category: 'utility',
            defaultSize: { w: 160, h: 90 },
            resizable: true,
            singleton: false,
            ports: {
                inputs: [],
                outputs: []
            }
        };
    }

    render(container = this.container) {
        this.container = container;
    }

    update(dt) {
        void dt;
    }

    serialize() {
        return {};
    }

    destroy() {}
}

export class PodContext {
    constructor(services) {
        this.services = services;
    }

    readPort(portName) {
        return this.services.readPort(portName);
    }

    writePort(portName, data) {
        this.services.writePort(portName, data);
    }

    getAudioContext() {
        return this.services.getAudioContext();
    }

    createAnalyser(options) {
        return this.services.createAnalyser(options);
    }

    getParameter(paramId) {
        return this.services.getParameter(paramId);
    }

    setParameter(paramId, value) {
        return this.services.setParameter(paramId, value);
    }

    onParameterChange(paramId, callback) {
        return this.services.onParameterChange(paramId, callback);
    }

    getGridSize() {
        return this.services.getGridSize();
    }

    getPosition() {
        return this.services.getPosition();
    }

    getSize() {
        return this.services.getSize();
    }

    requestRemove() {
        return this.services.requestRemove();
    }

    log(level, message) {
        return this.services.log(level, message);
    }
}

export class PodRegistry {
    constructor() {
        this.types = new Map();
    }

    register(PodClass) {
        const manifest = PodClass.manifest();
        this.types.set(manifest.type, PodClass);
        return manifest;
    }

    getTypes() {
        return Array.from(this.types.keys());
    }

    getManifest(type) {
        const PodClass = this.types.get(type);
        return PodClass ? PodClass.manifest() : null;
    }

    create(type, ctx, savedState) {
        const PodClass = this.types.get(type);
        if (!PodClass) {
            throw new Error(`Unknown pod type: ${type}`);
        }
        return new PodClass(ctx, savedState);
    }

    async loadFromFile(path) {
        const module = await import(path);
        const PodClass = module.default;
        this.register(PodClass);
        return PodClass;
    }
}
