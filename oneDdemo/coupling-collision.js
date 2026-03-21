// Collision coupling — one-way constraint (mallet/uncoupled).
// The actuator can push the membrane down on contact.
// When the actuator lifts, the membrane springs back freely.
// Does NOT touch the driven array — membrane is always free for the wave equation.

export function applyCollision(mem, footprint) {
    for (let j = 0; j < footprint.indices.length; j++) {
        const i = footprint.indices[j];
        const surfaceHeight = footprint.heights[j];

        // Membrane is above the ball surface — ball is pushing through
        if (mem.heights[i] > surfaceHeight) {
            mem.heights[i] = surfaceHeight;
            mem.velocities[i] = 0;
        }
        // If membrane is below ball surface — no contact, membrane is free
    }
}
