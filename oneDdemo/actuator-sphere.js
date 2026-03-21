// Sphere actuator geometry.
// Given a sphere's state, returns the footprint it projects onto the 1D grid.
// Pure geometry. No knowledge of membrane state or coupling type.

export function sphereFootprint(centerY, radius, position, N, velocity) {
    const indices = [];
    const heights = [];

    for (let i = 0; i < N; i++) {
        const dx = i - position;
        if (Math.abs(dx) >= radius) continue;

        // Bottom surface of sphere at this grid point
        const surfaceHeight = centerY - Math.sqrt(radius * radius - dx * dx);

        indices.push(i);
        heights.push(surfaceHeight);
    }

    return {
        indices,    // which grid points fall inside the footprint
        heights,    // ball bottom surface height at each of those points
        velocity    // vertical velocity of the driver (for glue coupling)
    };
}
