# Architecture

A small single-event app. One Convex deployment holds all the state; every screen subscribes to it over Convex's WebSocket, so a phone's check-in appears on the projector within about 100 ms.

```
 iPad (/event, Home Screen app) ──┐                    ┌── convex/event.ts      queries (filtered snapshots)
 Organiser phones (/admin) ───────┼── Convex client ───┼── convex/participants  check-in, organiser edits
 Brothers' phones (/join, /vote) ─┘   (WebSocket)      ├── convex/flow.ts       phase machine, timer, settings
                                                       └── convex/voting.ts     anonymous vote counting
                         shared/  ← pure TS used by both sides (allocator, Salah, time, timer, names)
```

Static site on Netlify (SPA redirect in `netlify.toml`). No accounts, no auth provider: privileged mutations take an organiser **token** checked against the `ADMIN_TOKEN` Convex env var.

## Folder map

| Path | What lives there |
|---|---|
| `shared/fairness.ts` | Team allocator: exhaustive search over splits, uniform choice among the most balanced, uniform captain draw. Seeded RNG for tests. |
| `shared/salah.ts` | Prayer types, Birmingham Central Mosque defaults for 18 Oct 2026, validation, "next prayer / jama'ah" status. |
| `shared/time.ts` | Time-zone-correct `HH:mm` ↔ epoch (Europe/London), countdown formatting. |
| `shared/timer.ts` | Pure Pomodoro state transitions (start / pause / resume / next session). |
| `shared/names.ts`, `levels.ts`, `teams.ts`, `rng.ts` | Name rules, levels, team names/colours, PRNG. |
| `convex/schema.ts` | Tables: `event` (single row), `participants`, `teams`. |
| `convex/model.ts` | Defaults, `loadEvent`, phase guards, admin-token check, `fail()` (throws `ConvexError {code, message}`). |
| `convex/event.ts` | `publicState` (what every screen sees), `me` (a phone's own row by device id), `checkAdmin`, `serverNow`. |
| `convex/participants.ts` | `register` (idempotent per device), `adminUpdate`, `adminRemove`, `addTestParticipants`. |
| `convex/flow.ts` | All organiser actions: make/reshuffle teams, reveal countdown, start, pause/resume/skip/restart, voting open/close/reveal/restart, settings, reset. Scheduled internal mutations `autoStart` and `advanceTimer`. |
| `convex/voting.ts` | `castVote`, `pendingVoters` (organiser only). |
| `src/routes/` | `EventDisplay` (projector), `JoinPage`, `VotePage`, `AdminPage`, `HomePage` (redirects by phase). |
| `src/components/display/` | One view per phase plus `OrganiserTray` (the hidden corner controls) and `Confetti`. |
| `src/components/OrganiserControls.tsx` | Phase-aware buttons shared by the tray and the admin page; all confirmations live here. |
| `src/lib/` | Convex client, server-clock offset (`clock.tsx`), connection state, localStorage helpers, sound, results ranking. |
| `tests/` | Vitest: pure logic plus `convex-test` integration tests of the real functions. |
| `scripts/rehearse.mjs` | Playwright end-to-end rehearsal against your dev deployment. |

## The phase machine

`event.phase`: `setup → team_reveal → hackathon → voting → results_pending → results`. Every mutation calls `requirePhase(...)`, so the UI can't push an illegal transition. Allowed backwards moves, all organiser-only and confirmed:

- `team_reveal → setup` (*Reopen check-in*: clears teams for latecomers)
- `voting → hackathon` (*Back to hacking*: clears votes)
- `voting | results_pending | results → voting` (*Restart voting*: zeroes all totals)
- anything → `setup` (*Reset event*: deletes participants and teams, keeps settings)

Screens decide what to render from `phase` only. Animations that should play only when the room is watching (team shuffle, winner reveal) use `useLiveTransition`, so a reload never replays them.

## Key mechanisms

**Teams.** `makeTeams` requires 3–12 people and an explicit `acceptCount` if the number ≠ expected. `allocateTeams` enumerates every assignment into sizes like 3/3/3 or 4/3/3. It scores each by the spread of average experience (beginner = 1, intermediate = 2, advanced = 3), then by how many same-level members share a team. It collects every optimal assignment and picks one uniformly. Captains are a separate uniform draw per team.

**Timer.** The server stores `timer.endsAt` (epoch ms) while running, or `remainingMs` while paused. Every time a running session is set, `ctx.scheduler.runAt(endsAt, advanceTimer, {expectedEndsAt})` is queued. The job no-ops if the timer changed since (paused, skipped), so stale jobs are harmless. Each next session is anchored to the previous `endsAt`, never to "now", so it can't drift. Clients count down to `endsAt` using a server-clock offset measured via the `serverNow` mutation. The reveal auto-start uses the same pattern (`autoStart`).

**Votes.** `castVote` identifies the voter by device id, or by normalised name when the phone isn't theirs. It rejects unknown voters, voters without a team, repeat voters and own-team votes, then does `team.votes += 1` and `voter.hasVoted = true` in one transaction. Convex mutations are serialisable, so concurrent duplicates retry and fail on `hasVoted`. Nothing links voter to team. `publicState` returns `votes: null` for every team until `phase === "results"`.

**Privacy of the projector.** The display never renders the organiser token (it lives in localStorage, and the pairing input is a password field). Device ids are never returned by public queries. The organiser's "still to vote" list appears only on `/admin`, never on the projector.

**Organiser token.** `/admin/<token>` stores the token on the device and replaces the URL with `/admin`. The iPad pairs by typing the code into the tray. iOS Home Screen web apps have storage separate from Safari, so pair inside the Home Screen app.

## Adding things

- New organiser action: add a mutation in `convex/flow.ts` with `requireAdmin` and `requirePhase`. Add a button in `OrganiserControls.tsx`, behind `guarded(...)` if it's destructive. Add a `convex-test` case.
- New field on screens: extend `publicState`. Think about whether it's safe on the projector.
- Styling: tokens live in `src/styles/index.css` (`@theme`). The projector scales everything from `.display-root`'s font size, so use `em` units on display components.
