# Shmup Inc

## Story Levels

Story levels are defined in `content/levels` using JSON5 `LevelDefinition` data with pressure profiles, hazards, shop rules, and win/end conditions. Runtime support lives in `src/game/systems/LevelRunner.ts`, and story beats are data-driven via `content/beats` with HTML/CSS overlays.

## Content Authoring (Dev Only)

- Editor route: start the dev server and open `/content` to browse and edit JSON content packs.
- File structure: `content/levels`, `content/waves`, `content/hazards`, `content/beats`, `content/shops`, plus supporting packs for `content/enemies`, `content/weapons`, `content/ships`, and `content/guns` (all `.json5`).
- Weapons are unified in `content/weapons`; ships define `mounts` (zone + size) in `content/ships`, weapons declare supported `zones` + `size`, and each weapon references a gun model in `content/guns` via `gunId`.
- Validation: `npm run content:validate`
- Scaffold a level: `npm run content:scaffold -- level L3_NAME`
- Print a level summary: `npm run content:print -- level L2_SQUEEZE`

The editor uses a dev-only API to read/write files under `content/`, runs schema validation on save, and can launch a level into the Beat → Shop → Play flow.
