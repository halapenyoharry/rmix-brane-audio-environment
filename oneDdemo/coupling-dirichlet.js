// Dirichlet coupling — geometric bond (speaker driver/bonded).
// The actuator dictates the membrane height at every point in its footprint.
// The wave equation is suspended at those points.
// Adjacent free points pull from the enforced heights via the laplacian,
// so waves propagate naturally from the footprint edges.

export function applyDirichlet(mem, footprint) {
    // Clear all driven flags first — footprint may have changed size
    mem.driven.fill(0);

    for (let j = 0; j < footprint.indices.length; j++) {
        const i = footprint.indices[j];

        mem.driven[i] = 1;
        mem.heights[i] = footprint.heights[j];
        mem.velocities[i] = footprint.velocity;
    }
}
