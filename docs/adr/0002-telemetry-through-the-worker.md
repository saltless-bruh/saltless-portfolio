# Telemetry goes through the Worker, not a static blob

The operator's machine POSTs its derived measurements to one authenticated Worker route. The Worker
writes a single row to D1, and the site reads those values back through the same Worker. The brief
specified something slightly different: a static JSON blob the machine would PUT to and the page
would fetch. **The rule behind that choice is unchanged** - push never pull, no inbound connection,
no open port, the site renders `offline` when the machine is off - but the mechanism changed once we
went looking for the credential it needs.

There is no long-lived credential, at any provider, that can write one object and nothing else.
S3-style presigned PUTs are object-scoped but time-bounded, capped at seven days on R2, so a
five-minute cron would be re-minting its own credential every week. The long-lived tokens that do
exist are scoped to a whole bucket (R2's `Workers R2 Storage Bucket Item Write`) or a whole
repository (GitHub's `contents: write`). A Worker route is narrower than either: the secret on the
machine reaches one route that writes one row, and it cannot read the Miss log, list anything, or
touch the rest of the account.

## Consequences

- **No moving part is added.** The Miss log already required a write endpoint, so the Worker exists
  either way; telemetry is a second route on it.
- **Not R2.** Beyond the scope point, an R2 subscription must be added through a checkout flow
  before an API token can be minted at all, which is friction for storing one kilobyte.
- **Headroom is not close.** D1's free tier allows 100,000 rows written per day against roughly 400
  needed: 288 pushes at a five-minute cadence, plus the Misses.
- **The site is no longer only static files.** Static asset requests stay free and unlimited on
  Workers, and `run_worker_first` must not be used: on the free plan, requests matching those
  patterns return 429 once limits are reached instead of falling back to serving the asset.
- **Local development writes to a local D1**, which is the same code path rather than a stub, and
  needs no Cloudflare account. Verified empirically on 2026-10-06 with Wrangler 4.147.0 and Node 26:
  `wrangler dev` started with no login prompt, bound `D1 Database local` and `Assets local`, served
  assets, answered a `SELECT`, and `wrangler d1 migrations apply <DB> --local` ran with zero
  credentials. Local is the default mode (workerd via Miniflare) and the database is real SQLite
  under `.wrangler/state/v3/d1/`, which is why that path is gitignored. Cloudflare's own get-started
  guide still says Wrangler opens a browser to log in on first use; that line is stale. What does
  need auth is `wrangler whoami`, `wrangler d1 create`, and deploying. So the site is buildable for
  as long as the owner wants before an account exists.
- **Abuse protection on the Miss endpoint is the Workers rate-limit binding, not a WAF rule.** A WAF
  rate-limiting rule is zone-level dashboard configuration: there is no local simulation and no
  Wrangler path to it, so it is protection that cannot be read in this repository, exercised before
  deploy, or reviewed in a diff. The binding is code, lives here, and is documented as simulated
  locally. **Caveat recorded because it is unresolved:** Cloudflare's docs state no plan availability
  for that binding either way. If it proves to be paid-only, the fallback is the WAF rule that Free
  does document (one rule, path and IP, 10-second window), so the endpoint must be correct under
  either and must not depend on the limiter for correctness, only for cost.
- **No Worker Cron Trigger is involved.** The five-minute cadence is a crontab on the operator's own
  machine, which is what "push never pull" means. Noted because Cron Triggers do not fire during
  local development at all, and a future reader reaching for one would find it untestable.
- **What gets published is still the hard part, and it is not a question of mechanism.** A time
  series is a presence oracle: it publishes a sleep schedule, a timezone, and when the machine is
  unattended. That is what the "no hostname, no kernel, no IP, no paths" rule does not cover. So the
  published values are bucketed rather than instantaneous, the cadence is fixed, and `last_seen` is
  cut outright. Freshness is carried as `live` / `stale` / `offline`, and `offline` is the normal
  overnight state, so it has to look intended.

## Considered Options

- **An R2 bucket with a scoped API token**, which is the brief's own shape. Rejected for the
  subscription checkout and because the narrowest long-lived scope available is the whole bucket.
- **Committing the values into the repository**, the way the profile commits `cache/activity.json`.
  Free, versioned, no new infrastructure, and a pattern already proven in this project. Rejected at
  a five-minute cadence: 288 commits a day buries the history, and the machine would need a token
  that can write every file in the repository to update one of them.
