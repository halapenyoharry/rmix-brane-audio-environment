# RMIX-BAE UI Element Inventory

This document lists the required UI elements for the rmix-brane-audio-environment interface. The goal is a modular, "control tile" based system inspired by Open Sound Control (OSC) interfaces.

## Core UI Components

The UI is built from a collection of draggable "tiles". Each tile contains a single control.

### 1. Main Visualization

-   **Description:** The primary 3D rendering of the physics-based membrane. It's the main interactive surface.
-   **Interactions:**
    -   Click: Add an "Actuator" to the membrane at the clicked point.
    -   Shift+Click: Add a "Collector" to the membrane at the clicked point.
    -   Click on Actuator/Collector: Remove it.
    -   Orbit/Pan/Zoom: Standard 3D viewport controls.

### 2. Control Tiles

These are draggable panels that contain individual controls.

#### Button/Toggle Tiles

-   **Tab Audio Capture (Toggle)**
    -   **Icon:** 🎵
    -   **Function:** Toggles audio input from another browser tab.
    -   **State:** Should have a clear "on" (glowing/active) and "off" state.
    -   **Feedback:** Displays a mini waveform/spectrum analyzer when active.

-   **Demo Loop Player (Button)**
    -   **Icon:** ▶
    -   **Function:** Plays/pauses pre-loaded audio loops.
    -   **State:** Should indicate "playing" vs. "paused".
    -   **Feedback:** Displays a mini waveform/spectrum analyzer when active.

-   **Load Audio File (Button)**
    -   **Icon:** 📁
    -   **Function:** Opens a system file dialog to select a local audio file.
    -   **Feedback:** Displays a mini waveform/spectrum analyzer when a file is playing.

-   **Clear All (Button)**
    -   **Icon:** ×
    -   **Function:** Removes all actuators and collectors from the membrane.

-   **Toggle Fullscreen (Button)**
    -   **Icon:** ⛶
    -   **Function:** Toggles browser fullscreen mode.

#### Slider Tiles

-   **Wave Speed Slider**
    -   **Function:** Controls the propagation speed of waves on the membrane.
    -   **Range:** `0.05` to `0.3`

-   **Damping Slider**
    -   **Function:** Controls the rate at which waves lose energy.
    --   **Range:** `0.001` to `0.05`

-   **Actuator Gain Slider**
    -   **Function:** Controls the force multiplier for audio actuators.
    -   **Range:** `0.5` to `5.0`

#### Informational Tiles

-   **Mini-Membrane Display**
    -   **Function:** Provides a 2D, top-down SVG view of the membrane.
    -   **Content:** Displays real-time positions of all actuators and collectors as colored dots.

## On-Canvas Elements

These are objects that appear directly on the 3D membrane.

-   **Actuator Visual**
    -   **Description:** A 3D sphere representing a point where audio energy is applied to the membrane.
    -   **Styling:** Should be distinct from collectors. Currently a solid colored sphere. Color can indicate audio channel (L/R/Mono).

-   **Collector Visual**
    -   **Description:** A 3D sphere representing a point where the membrane's movement is sampled to produce audio.
    -   **Styling:** Should be distinct from actuators. Currently a wireframe sphere.