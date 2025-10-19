# RMIX Unified Parameter Schema Proposal

**Version:** 1.1  
**Date:** October 7, 2025  
**Purpose:** Single source of truth for membrane physics, audio processing, and visual rendering

---

## Overview

This schema replaces `tiles-config.json` and becomes the canonical definition for:
- Membrane physics parameters
- Audio source configuration
- Actuator (ball) behavior and properties
- Visual rendering parameters
- UI component generation
- Modulation and automation
- Performance optimization

**Key Design Principle:** One JSON file that can be saved/loaded to reproduce the entire environment, similar to a Comfy UI workflow.

**File Format:** JSON5 (supports comments and trailing commas) for human/AI editing.

---

## Review Score: 9/10 ✓

**Strengths:**
- Perfect separation of concerns (sources → actuators → collectors)
- Deterministic update flow with clear timing semantics
- Physicist-friendly units and relationships
- Artist-friendly spatial → audio mappings
- Computed properties elegantly solve sync issues

**Critical Additions (v1.1):**
1. Per-parameter smoothing (curves depend on controls)
2. Latency compensation
3. Performance auto-tuning
4. Modulation system (LFOs, envelopes, audio followers)
5. Force model clarification
6. Gesture sensitivity controls

---

[Full schema content continues as in original document...]
