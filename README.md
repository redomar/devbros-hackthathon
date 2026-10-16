# Dev Bros: the Hackthathon

Live event companion for Sunday 18 October 2026. An iPad shows the big screen (mirrored over HDMI); brothers check in and vote from their own phones via QR codes; organisers drive the phases from a phone or a discreet tray on the iPad.

**Stack:** Vite + React + TypeScript + Tailwind v4 + anime.js, with [Convex](https://convex.dev) as the realtime backend (its client keeps a WebSocket open, so every screen updates instantly). No accounts, no logins.

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
pnpm test         # allocator, Salah/time, timer + Convex integration tests
pnpm typecheck && pnpm build
```

The organiser code is the `ADMIN_TOKEN` Convex environment variable: `npx convex env set ADMIN_TOKEN <code>` (use `--prod` for production).

## Deploy (Netlify + Convex)

From a machine logged in to both Convex and Netlify:

```sh
npx convex env set ADMIN_TOKEN <code> --prod   # once
npx convex deploy --cmd 'pnpm build'            # pushes functions to prod + builds with the prod URL
npx netlify-cli deploy --prod --dir dist
```

For builds on Netlify instead (git-connected), `netlify.toml` already sets the build command, SPA redirect and Node version; add a production `CONVEX_DEPLOY_KEY` (Convex dashboard → Settings → Deploy keys) to the Netlify site's environment.

Then open `https://<site>/admin/<code>` on each organiser's phone.

## How it guarantees things

- **Teams:** `shared/fairness.ts` checks every possible split (1,680 for nine people) and picks at random among the most balanced. A 3/3/3 level mix always gives one of each level per team. Captains are then drawn uniformly from each team, ignoring experience.
- **Votes:** `convex/voting.ts` increments a team counter and sets `hasVoted` in one serialisable transaction. No ballot record linking voter to team exists anywhere. Team totals are excluded from public queries until **Reveal**. This is *not* cryptographic anonymity: name-only identity is trust-based, and in a group of nine, timing and the room can still give votes away.
- **Timer:** the server stores `endsAt`; a scheduled Convex function flips focus/break at that moment. Screens just count down to it using a server-clock offset, so a backgrounded Safari can't drift.
- **Salah:** Birmingham Central Mosque's published times for 18 Oct 2026 are the defaults (`shared/salah.ts`); editable on the admin page.
