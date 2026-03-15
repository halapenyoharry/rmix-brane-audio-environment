# Project Cleanup Instructions for AI Assistant

**Task:** Organize the RMIX project folder - keep essential files, archive obsolete ones.

---

## Current Situation

The project folder has accumulated prototype files, old experiments, and outdated documentation. We now have a clean unified schema system and need to organize the folder to reflect this.

---

## What to KEEP (Essential Files)

These files are part of the new unified schema system and should stay in the root:

### Core Schema Files
- `SCHEMA-v1.1.md` - Complete specification
- `START-HERE.md` - Quick overview
- `INTEGRATION-GUIDE-SIMPLE.md` - Implementation guide
- `FILE-ARCHITECTURE.md` - Quick reference
- `default-session.json` - Example session
- `default-session.md` - Session documentation

### Essential Project Files
- `README.md` - Main project readme
- `.gitignore` - Git configuration
- `package.json` - Dependencies
- `.git/` - Git repository (DO NOT MOVE)

### Core Library Files
- `three.min.js` - Three.js library
- `OrbitControls.js` - Camera controls

### Core Implementation Files (if they exist)
- `membrane-physics-core.js` - Physics engine
- Any files in `src/` directory (if it exists)

---

## What to ARCHIVE (Old/Experimental Files)

Move these to `archive/prototypes/` subfolder:

### Old HTML Prototypes
- `brane-with-collectors-websocket.html`
- `brane-with-v1actuaters-jack-extensions-working-janky-cone.html`
- `jack-bridge-template.html`
- `membrane-physics-sim.html`
- `membrane-with-ui-controls.html`
- `rmix-final.html`
- `rmix-integrated.html`
- `rmix-prototype.html`
- `test-audio-coupled-oscillator.html`
- `test-combined-oscillator.html`

### Old JavaScript Files
- `audio-interfaces.js`
- `audio-oscillator-coupler.js`
- `falstad-oscillator.js`
- `harmonic-oscillator.js`
- `jack-websocket-bridge.js`
- `physical-ball.js`

### Old Documentation (Now Superseded)
- `FUTURE-ENHANCEMENTS.md` - Old roadmap
- `JACK-BRIDGE-ANALYSIS.md` - Old bridge docs
- `PROGRESS-SUMMARY.md` - Old progress
- `QUICKSTART.md` - Old quickstart
- `STATUS.md` - Old status
- `TESTING-GUIDE.md` - Old testing
- `WEBSOCKET-BRIDGE-README.md` - Old websocket docs

### Old Configuration
- `tiles-config.json` - Replaced by unified schema

### Already Archived
- `old/` directory - Keep this folder as-is

---

## Folder Structure After Cleanup

```
rmix-brane-audio-environment/
│
├── START-HERE.md                     ← NEW: Read first
├── README.md                         ← Keep
├── SCHEMA-v1.1.md                   ← NEW: Schema spec
├── INTEGRATION-GUIDE-SIMPLE.md      ← NEW: Implementation
├── FILE-ARCHITECTURE.md             ← NEW: Quick ref
├── default-session.json             ← NEW: Example session
├── default-session.md               ← NEW: Session docs
│
├── three.min.js                     ← Keep: Library
├── OrbitControls.js                 ← Keep: Library
├── membrane-physics-core.js         ← Keep: Core engine
├── package.json                     ← Keep: Config
├── .gitignore                       ← Keep: Config
│
├── .git/                            ← Keep: DO NOT MOVE
│
├── src/                             ← Keep: Implementation
│   └── (implementation files)
│
├── sessions/                        ← Create: User sessions
│   └── (user .json files)
│
├── old/                             ← Keep: Already archived
│   └── (old files)
│
└── archive/                         ← Create this
    ├── prototypes/                  ← Move old HTML/JS here
    │   ├── brane-with-collectors-websocket.html
    │   ├── rmix-prototype.html
    │   ├── audio-interfaces.js
    │   └── ... (all prototype files)
    │
    └── old-docs/                    ← Move old docs here
        ├── FUTURE-ENHANCEMENTS.md
        ├── PROGRESS-SUMMARY.md
        ├── tiles-config.json
        └── ... (all old docs)
```

---

## Step-by-Step Instructions

### Step 1: Create Archive Directories
```bash
mkdir -p archive/prototypes
mkdir -p archive/old-docs
mkdir -p sessions
```

### Step 2: Move Old HTML Prototypes
```bash
mv brane-with-collectors-websocket.html archive/prototypes/
mv brane-with-v1actuaters-jack-extensions-working-janky-cone.html archive/prototypes/
mv jack-bridge-template.html archive/prototypes/
mv membrane-physics-sim.html archive/prototypes/
mv membrane-with-ui-controls.html archive/prototypes/
mv rmix-final.html archive/prototypes/
mv rmix-integrated.html archive/prototypes/
mv rmix-prototype.html archive/prototypes/
mv test-audio-coupled-oscillator.html archive/prototypes/
mv test-combined-oscillator.html archive/prototypes/
```

### Step 3: Move Old JavaScript Files
```bash
mv audio-interfaces.js archive/prototypes/
mv audio-oscillator-coupler.js archive/prototypes/
mv falstad-oscillator.js archive/prototypes/
mv harmonic-oscillator.js archive/prototypes/
mv jack-websocket-bridge.js archive/prototypes/
mv physical-ball.js archive/prototypes/
```

### Step 4: Move Old Documentation
```bash
mv FUTURE-ENHANCEMENTS.md archive/old-docs/
mv JACK-BRIDGE-ANALYSIS.md archive/old-docs/
mv PROGRESS-SUMMARY.md archive/old-docs/
mv QUICKSTART.md archive/old-docs/
mv STATUS.md archive/old-docs/
mv TESTING-GUIDE.md archive/old-docs/
mv WEBSOCKET-BRIDGE-README.md archive/old-docs/
mv tiles-config.json archive/old-docs/
```

### Step 5: Verify Root Directory
After cleanup, root should contain ONLY:
- Schema docs (SCHEMA-v1.1.md, START-HERE.md, etc.)
- Core libraries (three.min.js, OrbitControls.js)
- Core implementation (membrane-physics-core.js)
- Config files (package.json, .gitignore)
- Folders: .git, src, sessions, archive, old

### Step 6: Create Archive README
Create `archive/README.md` to explain what's archived:
```markdown
# Archived Files

This folder contains old prototypes and documentation from the project's development history.

## prototypes/
Old HTML prototypes and experimental JavaScript files. These were used during development but are superseded by the unified schema system.

## old-docs/
Old documentation files that have been replaced by the new schema documentation (SCHEMA-v1.1.md and related files).

These files are kept for historical reference but are no longer actively maintained.
```

---

## Validation Checklist

After cleanup, verify:

- [ ] Root directory has 15 or fewer items
- [ ] All new schema files present (START-HERE.md, SCHEMA-v1.1.md, etc.)
- [ ] All prototypes moved to archive/prototypes/
- [ ] All old docs moved to archive/old-docs/
- [ ] .git/ directory untouched
- [ ] three.min.js and OrbitControls.js still in root
- [ ] archive/README.md created
- [ ] sessions/ directory exists (empty is OK)

---

## Files That Should Remain in Root

After cleanup, root should contain approximately:

**Documentation (6 files):**
- START-HERE.md
- README.md
- SCHEMA-v1.1.md
- INTEGRATION-GUIDE-SIMPLE.md
- FILE-ARCHITECTURE.md
- default-session.md

**Data (1 file):**
- default-session.json

**Libraries (2 files):**
- three.min.js
- OrbitControls.js

**Core Engine (1 file):**
- membrane-physics-core.js

**Config (2 files):**
- package.json
- .gitignore

**Folders (5 directories):**
- .git/
- src/ (if exists)
- sessions/
- archive/
- old/

**Total:** ~12 files + 5 folders = 17 items in root (clean!)

---

## Special Instructions

### DO NOT MOVE:
- `.git/` directory - Critical for version control
- `.DS_Store` - System file, ignore it
- Any file containing "consciousness-topology" - This might be important

### IF UNCERTAIN:
- Leave it in root and note it in your response
- Better to ask than to move something critical

### WHEN COMPLETE:
Provide a summary:
1. How many files moved to archive/prototypes/
2. How many files moved to archive/old-docs/
3. How many files remaining in root
4. List any files you were uncertain about

---

## Example Commands (Copy-Paste Ready)

If you're using bash/terminal:

```bash
# Create directories
mkdir -p archive/prototypes archive/old-docs sessions

# Move prototypes (one command)
mv brane-with-collectors-websocket.html brane-with-v1actuaters-jack-extensions-working-janky-cone.html jack-bridge-template.html membrane-physics-sim.html membrane-with-ui-controls.html rmix-final.html rmix-integrated.html rmix-prototype.html test-audio-coupled-oscillator.html test-combined-oscillator.html archive/prototypes/ 2>/dev/null

# Move old JS
mv audio-interfaces.js audio-oscillator-coupler.js falstad-oscillator.js harmonic-oscillator.js jack-websocket-bridge.js physical-ball.js archive/prototypes/ 2>/dev/null

# Move old docs
mv FUTURE-ENHANCEMENTS.md JACK-BRIDGE-ANALYSIS.md PROGRESS-SUMMARY.md QUICKSTART.md STATUS.md TESTING-GUIDE.md WEBSOCKET-BRIDGE-README.md tiles-config.json archive/old-docs/ 2>/dev/null

# Create archive README
cat > archive/README.md << 'EOF'
# Archived Files

This folder contains old prototypes and documentation from the project's development history.

## prototypes/
Old HTML prototypes and experimental JavaScript files. These were used during development but are superseded by the unified schema system.

## old-docs/
Old documentation files that have been replaced by the new schema documentation (SCHEMA-v1.1.md and related files).

These files are kept for historical reference but are no longer actively maintained.
EOF

# List what's left in root
echo "Files in root after cleanup:"
ls -la
```

---

## Success Criteria

The cleanup is successful when:
1. Root directory is uncluttered (≤17 items)
2. All essential files easily visible
3. Old experiments archived but accessible
4. Project structure matches new schema system
5. Nothing critical was moved or deleted

---

**When you're done, report back with a summary of what was moved and what remains.**
