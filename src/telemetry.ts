/**
 * The rack LEDs' look. `live`: power steady, each activity LED on its own flicker; `stale`: the
 * drawn pattern, frozen; `offline`: activity dark, power on a standby blink. The LEDs carry it,
 * never the cat, who is asleep either way.
 */
export type Telemetry = "live" | "stale" | "offline";

/**
 * The LEDs are decoration, not a reading: the live-telemetry Worker (ADR 0002) was dropped on
 * 2026-11-21 as too much machinery for a few coloured pixels. Nothing is fetched or reported; the
 * rack simply looks busy, so the privacy page's "nothing is recorded" stays true.
 */
export const TELEMETRY_TODAY: Telemetry = "live";
