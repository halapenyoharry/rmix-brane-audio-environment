# Gemini Prompt: rmix-BAE Phase 2+ Implementation

**Copy this entire prompt to Gemini to continue development**

---

## Context: What You're Working On

You're implementing **rmix-BAE (Brane Audio Environment)** - a web-based audio processor that uses actual 2D membrane physics for sound transformation. This isn't a traditional reverb plugin - it physically models sound propagation through a membrane using wave equations.

**Project Philosophy**: Reduce abstraction layers. Simulate real physics, not DSP tricks.

---

## Current Status

**Phase 1**: ✅ COMPLETE (just finished)
- Removed all JACK/WebSocket legacy code
- Cleaned up for pure browser-native audio
- Created modular `src/` directory structure
- All existing features still work (tab capture, file loading, demo loops, membrane physics)

**Your Task**: Implement Phase 2, 3, 4, 5 following detailed implementation guides

---

## Project Location & Structure

```
~/Projects/rmix-brane-audio-environment/
├── brane-with-collectors-websocket.html  ← Main working app
├── tiles-config.json                     ← UI tile configuration
├── membrane-physics-core.js              ← Core physics (DON'T MODIFY)
├── demo-loops/                           ← Audio test files
├── src/                                  ← NEW modules go here
│   ├── audio/          ← Phase 2: AudioFileManager, LoopController, etc.
│   ├── schema/         ← Phase 3: SchemaParser
│   ├── controllers/    ← Phase 3: ParameterController
│   ├── visual/         ← Phase 3: MappingCurveEngine
│   ├── ui/             ← Phase 4: PlaybackControls, LoopRegionUI
│   └── physics/        ← Phase 3: MembranePhysicsWrapper
├── sessions/           ← User-saved session files
├── assets/             ← Local libraries
└── IMPLEMENTATION-INSTRUCTIONS.md        ← YOUR GUIDE (read this!)
└── IMPLEMENTATION-INSTRUCTIONS-PART2.md  ← Phase 3-5 details
```

---

## Critical Files to Read First

**YOU MUST READ THESE BEFORE STARTING:**

1. **`IMPLEMENTATION-INSTRUCTIONS.md`**
   - Complete Phase 1-2 guide with full code
   - Each module has complete implementation + test file
   - Testing instructions for each phase

2. **`IMPLEMENTATION-INSTRUCTIONS-PART2.md`**
   - Phase 3-5 detailed implementations
   - Integration guide
   - Final testing checklist

3. **`CLAUDE.md`** (project-specific instructions)
   - Architecture overview
   - Design principles
   - Known issues

4. **`PHASE-1-COMPLETE.md`**
   - What was just completed
   - What still works
   - Verification steps

---

## Gemini Interaction Model

**Understanding Context Provision:**

- **Automatic Context:** When interacting via the Gemini Code Assist VS Code extension, the content of relevant project files (like those listed in the `<CONTEXT>` block of this prompt) is automatically provided to Gemini. I do not need Harold to manually copy-paste file contents.
- **Interpretation:** When Harold refers to a file (e.g., `src/audio/AudioFileManager.js`), I understand that the extension has already supplied its content within the current interaction's context.
- **Purpose of `GEMINI-PROMPT.md`:** This file serves as the primary instruction set, defining the project's state, objectives, and interaction rules. It also acts as a structured "entry point" to the broader project context by referencing and including other critical documentation and code files.

**How to Guide Gemini:**

- Refer to files by their paths.
- Keep this `GEMINI-PROMPT.md` updated with overall project status and meta-instructions.
- Use the detailed implementation guides (`IMPLEMENTATION-INSTRUCTIONS.md`, etc.) for specific task breakdowns.

---

## Phase 2 Task Breakdown (Start Here)

**Goal**: Create 4 isolated, testable audio modules

### 2.1 AudioFileManager.js
**File**: `src/audio/AudioFileManager.js`

**What it does**:
- Load single/multiple audio files into playlist
- Play/pause/stop/next/previous controls
- Track duration calculation
- Stereo channel splitting for analysis

**Full code provided in**: IMPLEMENTATION-INSTRUCTIONS.md lines 135-258

**Test file**: Create `test-audio-file-manager.html` (code provided in guide)

**Verification**:
- [ ] Load multiple files → all appear in playlist
- [ ] Play → audio plays
- [ ] Next/Previous → cycles through tracks
- [ ] Track info updates correctly

---

### 2.2 LoopController.js
**File**: `src/audio/LoopController.js`

**What it does**:
- Set loop start/end points (in/out markers)
- Enable/disable looping
- Precision loop monitoring (10ms intervals)
- Jump to loop points

**Full code provided in**: IMPLEMENTATION-INSTRUCTIONS.md (LoopController section)

**Test**: Add to `test-audio-file-manager.html` (code provided)

**Verification**:
- [ ] Set in point → remembers position
- [ ] Set out point → remembers position
- [ ] Enable loop → plays between in/out points smoothly

---

### 2.3 MicrophoneInput.js
**File**: `src/audio/MicrophoneInput.js`

**What it does**:
- System microphone/line input via getUserMedia
- Device selection
- Stereo analysis
- Proper cleanup

**Full code provided in**: IMPLEMENTATION-INSTRUCTIONS.md

**Test file**: `test-microphone.html` (code provided)

**Verification**:
- [ ] Start mic → waveform shows audio
- [ ] Stop mic → waveform stops
- [ ] List devices → shows available inputs

---

### 2.4 AudioSourceRouter.js
**File**: `src/audio/AudioSourceRouter.js`

**What it does**:
- Register multiple audio sources
- Switch between sources (file/mic/tab)
- Provide unified audio data interface
- Route to actuators based on channel mode

**Full code provided in**: IMPLEMENTATION-INSTRUCTIONS.md

**Test file**: `test-audio-router.html` (code provided)

**Verification**:
- [ ] Register file source → appears in sources list
- [ ] Register mic source → appears in sources list
- [ ] Activate file → visualizer shows file audio
- [ ] Switch sources → visualizer updates correctly

---

## Phase 3-5 Overview (After Phase 2)

**Phase 3**: Schema v1.1 Integration
- Extend `default-session.json` with audio sources
- Implement `SchemaParser.js` (load/save/validate sessions)
- Implement `ParameterController.js` (central state hub with pub/sub)
- Implement `MappingCurveEngine.js` (size→freq, opacity→Q, etc.)
- Wrap membrane physics

**Phase 4**: UI Components
- `PlaybackControls.js` - Transport controls UI
- `LoopRegionUI.js` - Waveform with draggable markers

**Phase 5**: OSC Integration (optional)
- Add OSC schema to session.json
- Implement `OSCController.js` for bidirectional control

---

## Implementation Strategy (How to Proceed)

### Step-by-Step Workflow:

1. **Read IMPLEMENTATION-INSTRUCTIONS.md** - Has ALL the code
2. **For each module**:
   - Copy code from guide → create file in correct `src/` folder
   - Create test HTML file (code provided in guide)
   - Test independently
   - Mark checkbox in guide as complete
3. **After Phase 2 complete**: Commit & push
4. **Move to Phase 3**: Follow IMPLEMENTATION-INSTRUCTIONS-PART2.md
5. **Integration**: Combine all modules into main HTML

### Testing Pattern:
```bash
# Start local server
cd ~/Projects/rmix-brane-audio-environment
python3 -m http.server 8000

# Open test files
firefox http://localhost:8000/test-audio-file-manager.html
```

---

## Critical Constraints & Rules

### DO NOT:
- ❌ Modify `membrane-physics-core.js` (it's optimized and stable)
- ❌ Use external CDNs (use local copies only)
- ❌ Break existing functionality
- ❌ Create scripts without asking Harold first
- ❌ Rename files Harold created
- ❌ Make destructive changes without permission

### DO:
- ✅ Follow the implementation guides exactly
- ✅ Test each module independently before integration
- ✅ Use isolated modules (one responsibility per file)
- ✅ Update TODO list with TodoWrite tool
- ✅ Mark checkboxes in implementation guides as you complete tasks
- ✅ Commit after each phase completion
- ✅ Ask Harold before deviating from plan

### Git Workflow:
```bash
# Commit as halapenyoharry (NOT as Claude/Gemini)
git add .
git commit -m "Phase X: Description of changes"
git push
```

---

## Code Style & Conventions

**File naming**:
- Modules: `PascalCase.js` (e.g., `AudioFileManager.js`)
- Tests: `test-kebab-case.html` (e.g., `test-audio-router.html`)
- Sessions: `kebab-case.json` (e.g., `default-session.json`)

**Module pattern**:
```javascript
/**
 * ModuleName.js
 * Description of what it does
 *
 * Features:
 * - Feature 1
 * - Feature 2
 */

class ModuleName {
    constructor(params) {
        // Initialize
    }

    // Methods with JSDoc comments
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleName;
}
```

**Comments**:
- Clear, concise explanations
- JSDoc for functions
- Explain WHY, not just WHAT

---

## Architecture Principles

1. **Isolated modules** - Each file has one responsibility
2. **No global state** - Except ParameterController (Phase 3)
3. **Data-driven UI** - Config files define behavior
4. **Progressive enhancement** - Core works without advanced features
5. **Browser-native** - No build step, runs directly

---

## Common Issues & Solutions

**Issue**: AudioContext suspended
**Solution**: User gesture required (button click)

**Issue**: MediaElementSource can only be created once
**Solution**: Track with flags (audioElementSource, loopAudioSource)

**Issue**: CORS errors loading local files
**Solution**: Use local HTTP server (`python3 -m http.server 8000`)

**Issue**: Missing analysers
**Solution**: Check source has `analyserL` and `analyserR` properties

---

## Progress Tracking

**Use TODO list to track progress**:
```javascript
// Mark current task as in_progress
TodoWrite([
  {content: "Phase 2: Implement AudioFileManager.js", status: "in_progress", activeForm: "Implementing AudioFileManager.js"},
  {content: "Phase 2: Implement LoopController.js", status: "pending", activeForm: "..."}
])

// When complete, mark completed and move to next
```

**Update checkboxes in implementation guides** as you complete each step.

---

## Your Immediate Next Steps

1. **Read**: `IMPLEMENTATION-INSTRUCTIONS.md` (entire Phase 2 section)
2. **Create**: `src/audio/AudioFileManager.js` (copy code from guide)
3. **Create**: `test-audio-file-manager.html` (copy code from guide)
4. **Test**: Open in browser, verify all checkboxes pass
5. **Repeat**: For LoopController, MicrophoneInput, AudioSourceRouter
6. **Commit**: When Phase 2 complete

---

## Questions to Ask Harold

- Uncertain about architecture decisions
- Need clarification on requirements
- Encounter unexpected errors
- Want to deviate from implementation plan

---

## Expected Timeline

- **Phase 2**: 3-4 hours (4 modules + tests)
- **Phase 3**: 4-6 hours (schema integration)
- **Phase 4**: 3-4 hours (UI components)
- **Phase 5**: 3-4 hours (OSC - optional)

**Total**: 14-20 hours for complete system

---

## Success Criteria

**Phase 2 Complete When:**
- [ ] All 4 modules created in `src/audio/`
- [ ] All test files pass
- [ ] No console errors
- [ ] Code is well-commented
- [ ] Ready to integrate into main HTML

**Final Success (All Phases):**
- [ ] Load session → sources initialize
- [ ] Multi-file playlist works
- [ ] Loop regions work
- [ ] Switch between sources
- [ ] Parameters smoothly update
- [ ] Save/load sessions
- [ ] OSC control (if Phase 5 done)

---

## Resources

**In this repo**:
- `IMPLEMENTATION-INSTRUCTIONS.md` - Your primary guide
- `IMPLEMENTATION-INSTRUCTIONS-PART2.md` - Phases 3-5
- `CLAUDE.md` - Project context
- `README.md` - Project overview
- `PHASE-1-COMPLETE.md` - What was just finished

**User info**:
- Harold (halapenyoharry on GitHub)
- Linux system (lumen)
- Python 3 available for test server
- Firefox browser for testing

---

## Final Reminder

**The implementation guides have COMPLETE CODE for every module**. You don't need to design anything - just copy, test, and verify. Follow the guides step-by-step and you'll complete this successfully.

**Start with**: IMPLEMENTATION-INSTRUCTIONS.md → Phase 2 → AudioFileManager.js

Good luck! 🚀
