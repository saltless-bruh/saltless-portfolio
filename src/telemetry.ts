/**
 * The operator box's telemetry state (CONTEXT.md, Telemetry): `live` while pushes arrive on the
 * 5-minute cadence, `stale` after 15 minutes without one, `offline` after 30. The rack LEDs carry it,
 * never the cat, who is asleep either way.
 */
export type Telemetry = "live" | "stale" | "offline";

/**
 * Nothing pushes telemetry yet (the Worker and the box's push script are unbuilt), so the honest
 * state is `offline`, the same rule as the MOTD's placeholders: never a fabricated reading. When the
 * Worker lands, the client sets `data-telemetry` from fetched data and this stays the build default.
 */
export const TELEMETRY_TODAY: Telemetry = "offline";
