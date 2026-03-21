# BAE Research Document: Geometric Bonding in Wave Equation Topologies
**Subject:** Kinematic Constraints for Coupled Drivers vs. Force-Based Uncoupled Masses
**Date:** March 2026

## Abstract
Current physical interactions with the membrane rely on penalty forces, which calculate an intersection depth and apply a proportional opposing force. While sufficient for uncoupled collisions (e.g., a bouncing mallet), penalty forces fail to simulate a coupled driver. The result is a calculation gap—an observable arch where the membrane fails to adhere perfectly to the driver's surface. This paper defines the mathematical and architectural shift required to achieve gapless geometric bonding for arbitrary shapes using Dirichlet boundary conditions.

---

## 1. The Penalty Force Limitation
When a solid object intersects a calculated wave grid using a force-based collision model, the system calculates a restoring force based on the depth of the intersection. The membrane's internal tension opposes this downward force.

Because the system relies on this equilibrium to position the membrane, the membrane never fully reaches the physical boundary of the object. It hovers at the exact point where the object's downward penalty force equals the membrane's upward tension. This creates the visible "arch gap" underneath the driver.

To eliminate this gap and simulate a bonded material, the system must stop treating the driver as a force generator and start treating it as a kinematic constraint.

## 2. Mathematical Definition of the Geometric Bond
A bonded driver dictates the exact displacement of the membrane. The membrane cannot exist inside the object, nor can it separate from it.

To achieve this, the physics engine must dynamically apply a Dirichlet boundary condition to the specific grid coordinates occupied by the driver.

### 2.1 Footprint Detection
For any arbitrary shape, the driver must maintain a 2D projection of its physical geometry. Let $S$ be the set of all grid coordinates $(x,y)$ that fall within the boundary of the object.

### 2.2 The State Override (Dirichlet Boundary)
For all points $(x,y) \in S$, the standard finite difference calculation for the wave equation is suspended. Instead, the membrane height $u$ and vertical velocity $v$ are explicitly overwritten by the object's surface height function $Z_{surface}$ and vertical velocity $V_{driver}$.

For a sphere of radius $R$ centered at $(x_c, y_c, z_c)$, the explicit state override for points inside the footprint is:

$$
u(x,y,t) = z_c(t) - \sqrt{R^2 - (x - x_c(t))^2 - (y - y_c(t))^2}
$$

For an arbitrary geometric shape, the override uses a discrete height map matrix provided by the driver:

$$
u(x,y,t) = Z_{surface}(x,y,t)
$$

Simultaneously, the velocity for these points must be locked to the object's motion:

$$
\frac{\partial u}{\partial t}(x,y,t) = V_{driver}(x,y,t)
$$

### 2.3 The Surrounding Topology
For all points $(x,y) \notin S$, the physics engine continues to calculate the standard two-dimensional wave equation:

$$
\frac{\partial^2 u}{\partial t^2} = c^2 \left( \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} \right) - \gamma \frac{\partial u}{\partial t}
$$

Because the finite difference method calculates the next state of a point based on the current state of its neighbors, the grid points immediately outside the boundary $S$ will use the strictly enforced height of the driver to calculate their own tension. This mathematically guarantees that the surrounding membrane is pulled perfectly taut against the physical edge of the shape, with zero calculation gaps.

---

## 3. Architectural Implementation Contract
To implement this without violating the established BAE Single State Ownership rules, the interface between the core Actuator and the physics engine must be expanded.

The `forceGateway` must be upgraded to a `physicsGateway` that accepts two distinct types of physical intent:

1.  **Force Intent (Uncoupled):** Used by bouncing objects. The gateway receives `{ gridX, gridY, forceValue }` and applies it to the velocity array.
2.  **Geometric Intent (Coupled):** Used by bonded drivers. The gateway receives a data object containing the coordinate footprint array and the corresponding $Z$-height array. The gateway bypasses the velocity addition and directly overwrites the position arrays in the physics state.

By routing both intents through the gateway, the physics engine layer remains isolated, and the membrane acts as a pure calculator of the data provided to it.
