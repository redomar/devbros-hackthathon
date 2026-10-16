# Dev Bros: the Hackthathon

Live event companion for Sunday 18 October 2026. An iPad shows the big screen (mirrored over HDMI); brothers check in and vote from their own phones via QR codes; organisers drive the phases from a phone or a discreet tray on the iPad.

**Stack:** Vite + React + TypeScript + Tailwind v4 + anime.js, with [Convex](https://convex.dev) as the realtime backend (its client keeps a WebSocket open, so every screen updates instantly). No accounts, no logins.

**New here? Start with [CONTRIBUTING.md](CONTRIBUTING.md).**

| Doc | For |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setting up your own dev backend, running, testing, deploying, access |
| [docs/architecture.md](docs/architecture.md) | How it works: phase machine, timer, voting privacy, folder map |
| [docs/decisions.md](docs/decisions.md) | What the organisers agreed and why |
| [docs/status.md](docs/status.md) | What's done, what's left before Sunday |
| [docs/event-day-runbook.md](docs/event-day-runbook.md) | Running the actual event |
| [docs/product-brief.md](docs/product-brief.md) | The original brief (superseded where decisions differ) |

## Routes

| Path | Who | What |
|---|---|---|
| `/event` | iPad → projector | Big screen for every phase. Tap the bottom-right corner for organiser controls. |
| `/join` | Phones | Check-in QR target: first name + AI level. |
| `/vote` | Phones | Voting QR target. |
| `/admin/<code>` | Organisers' phones | Full controls, participant fixes, settings, reset. The code is stored on the device and removed from the URL. |
| `/` | Anyone | Redirects to `/join` or `/vote` depending on the phase. |

## Develop

```sh
pnpm install
pnpm dev:convex   # first run creates .env.local; keep running to push function changes
pnpm dev          # http://localhost:5173
npx convex env set ADMIN_TOKEN <any-dev-code>
pnpm test         # allocator, Salah/time, timer + Convex integration tests
pnpm rehearse     # end-to-end browser rehearsal against your dev backend
pnpm typecheck && pnpm build
```

The organiser code is the `ADMIN_TOKEN` Convex environment variable: `npx convex env set ADMIN_TOKEN <code>` (use `--prod` for production).

## Deploy (Netlify + Convex)

Push or merge to `main` and Netlify deploys automatically: Convex functions to production, then the site. Branches and PRs don't deploy. The production `CONVEX_DEPLOY_KEY` lives in Netlify's environment as a secret. Manual fallback from a logged-in machine: `pnpm ship`.

## How it guarantees things

- **Teams:** `shared/fairness.ts` checks every possible split (1,680 for nine people) and picks at random among the most balanced. A 3/3/3 level mix always gives one of each level per team. Captains are then drawn uniformly from each team, ignoring experience.
- **Votes:** `convex/voting.ts` increments a team counter and sets `hasVoted` in one serialisable transaction. No ballot record linking voter to team exists anywhere. Team totals are excluded from public queries until **Reveal**. This is *not* cryptographic anonymity: name-only identity is trust-based, and in a group of nine, timing and the room can still give votes away.
- **Timer:** the server stores `endsAt`; a scheduled Convex function flips focus/break at that moment. Screens just count down to it using a server-clock offset, so a backgrounded Safari can't drift.
- **Salah:** Birmingham Central Mosque's published times for 18 Oct 2026 are the defaults (`shared/salah.ts`); editable on the admin page.
