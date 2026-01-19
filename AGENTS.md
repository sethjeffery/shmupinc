# AGENTS.md — Shmup Inc.

## Overview

**Shmup Inc.** is a small, browser-based vertical shoot-’em-up (shmup) demo project.

- “Inc.” stands for **Incremental** (not corporate satire).
- This is a hobby project and technical / design demo.
- It is not intended for app stores, monetisation, or live-service features.

This file exists to preserve **design intent, mechanical direction, and constraints**
so future AI agents can contribute without losing the spirit of the game.

---

## Core Game Pillars (Do Not Violate)

### 1. Classic Shmup Feel, Modern Execution

Shmup Inc. aims to feel like a _real_ shmup, not a casual arcade toy.

Key expectations:

- Enemies enter, swoop, pause, loop, and exit.
- Movement patterns are deliberate and authored.
- Difficulty comes from **timing, geometry, and overlap**, not raw numbers.
- “Enemies drifting straight down” is considered incorrect behaviour.

Enemy behaviour must feel designed, readable, and intentional.

---

### 2. One-Finger, Low-Friction Play

- Drag/touch to move
- Auto-fire (no fire button)
- No complex input combinations
- Immediately playable on mobile and desktop

Anything that adds friction to moment-to-moment control should be avoided.

---

### 3. Incremental Progression (Lightweight, Not Idle)

Progression exists to:

- add variety
- unlock new weapons and playstyles
- encourage replay after failure

Progression should **not**:

- rely on idle timers or offline progress
- require spreadsheets or heavy optimisation
- overshadow the core shmup gameplay

Upgrades should feel tangible and readable, not abstract.

---

### 4. Data-Driven Design

Most behaviour should be defined via data, not bespoke logic.

Examples:

- Enemy definitions
- Movement scripts
- Fire scripts
- Wave definitions
- Bullet specifications
- Weapon definitions

Adding new content should usually mean:

> composing scripts or editing data  
> not  
> writing new per-entity update logic

---

## Visual & Design Style

### Aesthetic Direction

- Minimalist, vector-based visuals
- Clean neon accents
- Dark backgrounds
- Shapes and motion over textures and detail

Avoid:

- pixel art
- detailed sprites
- photorealism
- visual clutter

---

### Background Philosophy

There are two distinct visual zones:

1. **The playfield**
   - A clear, focused gameplay area
   - Parallax stars, dust, motion cues
   - Must prioritise readability above all else

2. **The outer area (menus, letterboxing, UI background)**
   - Exists to frame the playfield and UI
   - Should feel intentional, restrained, and calm
   - May use gradients, noise, subtle grids, or interface-like elements
   - Must not compete with gameplay or UI controls

The outer area is _not_ gameplay space.

---

### Readability Rules

- Player bullets and enemy bullets must be clearly distinguishable.
- Background visuals must never compete with enemies or bullets.
- Motion hierarchy matters more than visual detail.

---

## UI & Navigation Philosophy

- Gameplay is rendered with Phaser.
- Menus and hangar/shop are HTML/CSS overlays.
- UI routing is explicit and simple.

Expected routes:

- `menu`
- `play`
- `pause`
- `hangar`
- `gameover`

Menus should be:

- minimal
- fast to navigate
- touch-friendly
- consistent with the hangar/shop UI style

Avoid building a full UI framework.

---

## Bullets, Weapons, and Combat

Bullets are first-class gameplay entities.

Expected bullet categories:

- Orbs: medium speed, simple, readable
- Darts: fast, precise, narrow
- Missiles: gentle homing, readable trajectories
- Bombs: slow, high-impact, area-of-effect

Guidelines:

- Homing must be soft, not perfect tracking.
- AoE must be clearly telegraphed.
- Fairness and readability take priority over spectacle.

Weapons and upgrades should change _how the game feels_, not just numbers.

---

## Performance Constraints

- Must run smoothly in mobile browsers.
- Avoid per-frame allocations.
- Prefer object pooling.
- Avoid large textures, heavy shaders, or complex physics.

Visual improvements must be justified by performance cost.

---

## What Not To Do

- Do not add idle-game mechanics.
- Do not introduce heavy ECS or physics frameworks.
- Do not overcomplicate state management.
- Do not convert HTML/CSS UI into Phaser UI without strong reason.
- Do not introduce unnecessary realism or simulation complexity.

This is a focused shmup demo, not a general engine.

---

## How AI Agents Should Work on This Project

Before implementing changes:

1. Identify which core pillar(s) the change supports.
2. Check whether it increases complexity or friction.
3. Prefer data-driven or compositional solutions.
4. Preserve clarity, restraint, and responsiveness.

When unsure:

- Propose alternatives.
- Keep changes small and reversible.
- Ask before expanding scope.

---

## Summary

Shmup Inc. is:

- a vertical shoot-’em-up
- with deliberate, scripted enemy behaviour
- light incremental progression
- minimalist vector visuals
- designed for fast, readable, one-finger play

Respect simplicity, clarity, and intent.
