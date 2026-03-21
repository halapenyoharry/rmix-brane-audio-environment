// 1D membrane physics — damped wave equation with driven-point support.
// Pure physics. No knowledge of actuators or coupling.

export function createMembrane(N) {
    return {
        N,
        heights: new Float64Array(N),
        velocities: new Float64Array(N),
        driven: new Uint8Array(N) // 1 = owned by actuator, wave equation skips
    };
}

export function stepMembrane(mem, waveSpeed, damping, dt) {
    const c2 = waveSpeed * waveSpeed;
    const h = mem.heights;
    const v = mem.velocities;
    const d = mem.driven;
    const N = mem.N;

    // Update velocities from wave equation (skip driven points)
    for (let i = 1; i < N - 1; i++) {
        if (d[i]) continue;
        const laplacian = h[i - 1] - 2 * h[i] + h[i + 1];
        v[i] += c2 * laplacian * dt;
        v[i] *= (1 - damping);
    }

    // Update positions (skip driven points)
    for (let i = 1; i < N - 1; i++) {
        if (d[i]) continue;
        h[i] += v[i] * dt;
    }

    // Fixed boundaries
    h[0] = 0;
    h[N - 1] = 0;
}
