# SHMUP INC – In-Game Dialogue & Story System

---

## Overview

The SHMUP INC dialogue system is a **real-time, non-intrusive narrative layer** designed specifically for arcade gameplay.

It must:

- Preserve pacing
- Avoid interrupting player control (except at defined moments)
- Integrate directly with gameplay events
- Be fully data-driven and moddable
- Support campaign-style progression without forcing heavy cutscenes

This is a **combat-integrated communications system**.

---

# Design Principles

## 1. Arcade First

- Dialogue must never compromise gameplay clarity.
- The player ship must never be obscured.
- Most dialogue is non-blocking.

## 2. Minimal Interruption

- No long cutscenes.
- No extended control locks.
- Micro-pauses allowed (≤2 seconds).

## 3. Diegetic Framing

- Dialogue appears as radio/comms transmissions.
- UI fits within HUD aesthetic.
- Narrative integrates with gameplay mechanics.

## 4. Moddable & Declarative

- Story beats must be defined in data.
- No hardcoding per level.
- Triggers and actions must be event-driven.

---

# Dialogue Categories

---

## 1. Mid-Action Comms (Non-Blocking)

### Purpose

Add atmosphere, tutorial hints, and reactive commentary during combat.

### Characteristics

- Appears during gameplay
- No player control interruption
- Auto-dismiss on timer
- Max 1–2 lines
- Small UI footprint (top HUD region)

### Examples

- “Woah, these enemies are fast!”
- “Energy spike detected.”
- “Watch your left flank!”

### Constraints

- Must not overlap player ship.
- Must respect cooldown between messages.
- Should avoid appearing during heavy bullet density moments.

---

## 2. Micro-Pause Comms (Between Waves)

### Purpose

Deliver slightly higher-impact messages without full cutscenes.

### Characteristics

- Triggered pre-wave or post-wave
- Enemies paused briefly (≤2 seconds)
- Player may or may not retain movement
- Slight music ducking allowed

### Examples

- “Boss incoming.”
- “Great job. Prepare for next sector.”
- “That was too easy…”

### Constraints

- Must feel punchy, not cinematic.
- No letterbox bars.
- Total interruption time must be minimal.

---

## 3. Pre-Game Beat (Opening Framing)

### Purpose

Set tone and tutorialize control activation.

### Example Flow

```
[BLACK SCREEN]
Player: "Where... where am I?"
[Pause]
Player: "Something's not right..."
[Fade in level – no player control]
Friend: "You're awake. I'll activate your controls."
[Control unlock]
Gameplay begins
```

### Characteristics

- Short (≤15 seconds total)
- Fade-based transition
- First wave designed as tutorial ease
- Establishes narrative hook

---

# UI & Presentation Rules

---

## Placement

- Primary: Top-center HUD area
- Alternate: Top-left on smaller screens
- Never bottom (player region)
- Must avoid critical enemy spawn zones where possible

---

## Visual Style

- Semi-transparent dark panel (low opacity)
- Neon accent border matching game palette
- Small avatar portrait
- Drop shadow text for readability
- Fast slide/fade animation (≤200ms)
- Subtle radio/static effect optional

---

## Typography

- High contrast
- Short lines only
- Avoid paragraph blocks
- Emphasis via color or subtle animation (not bold blocks)

---

# System Behaviour Requirements

---

## Message Density Control

The system must enforce:

- Only one active message at a time
- Cooldown between messages
- Suppression during boss peak phases (optional)
- Priority system for conflicts

---

## Trigger Types

Dialogue can be triggered by:

- Wave start
- Wave end
- Boss spawn
- Enemy spawn (specific type)
- Player HP threshold
- Timer
- Custom gameplay events

Dialogue must not directly depend on specific level classes.

---

## Conditions

Dialogue should support conditional display:

- First-time only
- Repeat with alternate text
- Based on flags
- Based on player performance
- Based on difficulty

This allows light branching without building a full narrative tree.

---

## State & Flags

The system must support:

- Per-run flags
- Persistent campaign flags
- “Seen” tracking
- Conditional variations

This enables replay value without re-showing intro beats every run.

---

# Gameplay Integration Hooks

Dialogue beats may optionally:

- Freeze enemies
- Lock player controls
- Slow time
- Duck music
- Trigger sound stinger
- Shake camera (light intensity)
- Highlight UI elements (tutorial context)

These hooks must be optional and configurable.

---

# Priority & Interrupt Rules

Each dialogue beat must define:

- Priority level
- Whether interruptible
- Whether it replaces or queues
- Whether it suppresses other beats temporarily

This prevents overlap and race conditions.

---

# Scope Boundaries (Important)

This system intentionally does NOT include:

- Deep branching dialogue trees
- Complex player dialogue choices
- Long cinematic sequences
- RPG-style conversation loops

Those may be layered later if the design direction shifts.

---

# Narrative Tone Guidelines

SHMUP INC dialogue should:

- Be sharp
- Be reactive
- Be slightly self-aware
- Avoid long exposition
- Tie directly to gameplay moments

Dialogue should feel like part of combat, not a break from it.

---

# Success Criteria

The dialogue system succeeds if:

- Players remain in flow
- Dialogue enhances atmosphere without slowing play
- First-time players understand mechanics naturally
- Replays feel faster (due to conditional suppression)
- Modders can easily add or remove beats

---

# Future Expansion (Not Required for v1)

Possible later additions:

- Light player choices
- Character relationship system
- Dynamic adaptive dialogue based on skill
- Seasonal or mod-based story packs
- Voice clips
- Animated portrait effects

---

# Final Philosophy

The SHMUP INC dialogue system is:

> A reactive combat comms layer, not a cutscene engine.

It exists to:

- Enhance tension
- Support tutorialization
- Provide character flavor
- Reinforce boss moments
- Maintain arcade pacing
