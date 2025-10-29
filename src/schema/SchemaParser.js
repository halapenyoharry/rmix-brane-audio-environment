/**
 * SchemaParser.js
 * Loads, validates, and saves session JSON files
 *
 * Features:
 * - Load session from file/URL
 * - Validate schema version and structure
 * - Check sourceId references
 * - Validate parameter ranges
 * - Save session to JSON file (browser download)
 */

class SchemaParser {
    constructor() {
        this.supportedVersion = "1.1";
    }

    /**
     * Load session from file path or URL
     * @param {string} filepath - Path to session JSON file
     * @returns {Object} Parsed and validated session
     */
    async loadSession(filepath) {
        try {
            const response = await fetch(filepath);
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.statusText}`);
            }

            const text = await response.text();
            const session = JSON.parse(text);

            this.validate(session);

            console.log(`Loaded session: ${session.name} (v${session.version})`);
            return session;

        } catch (error) {
            console.error('Session load failed:', error);
            throw error;
        }
    }

    /**
     * Validate session structure and data
     * @param {Object} session - Session object to validate
     */
    validate(session) {
        // Version check
        if (session.version !== this.supportedVersion) {
            throw new Error(
                `Unsupported version: ${session.version} (expected ${this.supportedVersion})`
            );
        }

        // Required top-level properties
        const required = ['version', 'name', 'sources', 'actuators', 'collectors', 'parameters'];
        for (const prop of required) {
            if (!session.hasOwnProperty(prop)) {
                throw new Error(`Missing required property: ${prop}`);
            }
        }

        // Validate sourceId references in actuators
        const sourceIds = new Set(session.sources.map(s => s.id));
        session.actuators.forEach(act => {
            if (act.sourceId && !sourceIds.has(act.sourceId)) {
                throw new Error(`Invalid sourceId in actuator: ${act.sourceId}`);
            }
        });

        // Validate parameter ranges
        this.validateParameters(session.parameters);

        console.log('Session validation passed');
    }

    /**
     * Validate all parameters have valid ranges
     * @param {Object} parameters - Parameters object from session
     */
    validateParameters(parameters) {
        Object.values(parameters).forEach(group => {
            Object.values(group).forEach(param => {
                // Skip non-numeric parameters
                if (param.type === 'enum' || typeof param.value !== 'number') {
                    return;
                }

                if (param.value < param.min || param.value > param.max) {
                    throw new Error(
                        `Parameter ${param.id} value ${param.value} out of range [${param.min}, ${param.max}]`
                    );
                }
            });
        });
    }

    /**
     * Save session to JSON file (browser download)
     * @param {Object} session - Session object to save
     * @param {string} filename - Filename (default: session name)
     */
    saveSession(session, filename = null) {
        // Update modified timestamp
        session.modified = new Date().toISOString();

        // Generate filename
        const fname = filename || `${session.name}.json`;

        // Serialize with formatting
        const json = JSON.stringify(session, null, 2);

        // Browser download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`Session saved: ${fname}`);
    }

    /**
     * Create a new empty session
     * @param {string} name - Session name
     * @returns {Object} New session object
     */
    createNewSession(name = 'untitled') {
        return {
            version: this.supportedVersion,
            name: name,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            sources: [],
            actuators: [],
            collectors: [],
            modulators: [],
            parameters: {},
            mappingCurves: {},
            uiLayout: {},
            metadata: {}
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchemaParser;
}