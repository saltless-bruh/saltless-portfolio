# `/effort` Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A usable, rigged `/effort` panel in `napping`.

**Architecture:** Pure `src/client/effort.ts` (state, moves, slide-back, rows, replies); copy in
`content.json` `napping.effort`, validated in `src/content.ts`, passed through `nappingCfg`;
`src/client/agent.ts` opens the panel and routes keys/taps; `src/css.ts` adds the stepped colour.

**Tech Stack:** TypeScript, `node --test`, esbuild, DOM.

**Spec:** `docs/superpowers/specs/2026-11-20-effort-picker-design.md`

## Global Constraints

- Every panel row ends at or before column 40. Animations `step-end`, none under reduced motion.
- Tab is `preventDefault`ed everywhere in `napping`.

## Review Focus

- Enter pressed again mid-slide → ignored, no double reply (Task 2).
- Tab while the snap-back timer runs → no stuck `off` (Task 2).
- `/EFFORT` / spaced input → opens the panel (normalize) (Task 2).
- Tap outside the panel while open → panel keeps the keyboard (Task 2).
- Labels list without `lazy` in content → validation throws (Task 1).

---

### Task 1: The pure panel

**Files:** create `src/client/effort.ts`, `test/effort.test.ts`; modify `content.json`, `src/content.ts`, `src/screens.ts`, `src/napping.ts` (cfg type).

**Produces:** `EffortCfg`, `EffortState = { at: number; ultrachill: "on" | "off"; note: string }`,
`openEffort(c)`, `move(c, s, dir)`, `slideBack(c, from): number[]`, `effortRows(c, s): Row[]`,
`confirmReply(c, picked): string`.

- [ ] Failing tests → implement → `npm test`, `npm run typecheck` → commit `feat(napping): the /effort panel, as pure state and rows`.

### Task 2: Wire it into napping

**Files:** `src/client/agent.ts`, `src/css.ts`.

- [ ] Wire keys/taps/timers; CSS; `npm test`, `npm run typecheck`, `npm run build`; headless key run; commit `feat(napping): /effort, rigged`.
