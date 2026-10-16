# Contributing: start here

Welcome! This gets you from zero to a running copy with your own backend in about 10 minutes. You won't touch production until you choose to.

**Read next:** [docs/architecture.md](docs/architecture.md) (how it works) · [docs/decisions.md](docs/decisions.md) (what was agreed and why) · [docs/status.md](docs/status.md) (what's done and what's next) · [docs/event-day-runbook.md](docs/event-day-runbook.md) (the day itself) · [docs/product-brief.md](docs/product-brief.md) (original brief).

## 1. Prerequisites

- Node 24+ and pnpm 10 (`corepack enable` or `npm i -g pnpm`)
- A free [Convex](https://convex.dev) account (sign in with GitHub)

## 2. Run it locally with your own dev backend

```sh
git clone git@github.com:redomar/devbros-hackthathon.git
cd devbros-hackthathon
pnpm install

# Creates YOUR OWN Convex dev deployment, writes .env.local, and watches convex/ for changes.
# Choose "create a new project" when asked. Leave it running.
pnpm dev:convex

# In a second terminal: give your dev backend an organiser code (any string you like).
npx convex env set ADMIN_TOKEN dev-code-1234

# Third terminal:
pnpm dev     # http://localhost:5173
```

Open these side by side:

- `http://localhost:5173/event`: the big screen
- `http://localhost:5173/admin/dev-code-1234`: organiser controls (use **+ Test data** to fill the room)
- `http://localhost:5173/join`: a phone (use devtools' device mode, or a second browser profile so each "phone" gets its own device id)

To test with a real phone on the same Wi-Fi, use the network URL Vite prints (`http://192.168.x.x:5173`). The QR codes use whatever origin the display was opened on.

## 3. Checks

```sh
pnpm typecheck   # app + Convex functions
pnpm test        # allocator, Salah/time, timer + Convex integration tests (convex-test, no network)
pnpm rehearse    # full browser run-through against your dev backend (needs `pnpm dev` running)
```

`pnpm rehearse` resets your **dev** event, drives an iPad-sized display, a 16:9 display, two phones and an organiser phone through every phase, asserts the important rules, saves screenshots to `rehearsal-shots/`, then resets again. It refuses to run unless `.env.local` points at a dev deployment. First time only: `pnpm exec playwright install chromium-headless-shell`.

CI runs typecheck, tests and a build on every push and PR.

## 4. Workflow

- Branch from `main`, open a PR, and let CI go green. Keep PRs small; the event is close.
- Commit `convex/_generated/` when it changes (Convex regenerates it while `pnpm dev:convex` runs).
- **Rules that must not break** (the tests guard them):
  - first names only, never surnames;
  - captains drawn uniformly, never weighted by experience;
  - no stored voter → team record, anywhere (including logs: never `console.log` vote arguments);
  - team totals hidden from public queries until the organiser reveals;
  - every phase change guarded server-side.

## 5. Production

**Merging to `main` deploys automatically.** Netlify pulls the repo, runs `npx convex deploy --cmd 'pnpm build'` (pushes Convex functions to production, then builds the site against it) and publishes. The production `CONVEX_DEPLOY_KEY` is a secret in Netlify's environment. Branches and PRs don't deploy (`ignore` in `netlify.toml`), so nothing reaches production without a merge. CI still runs on PRs.

Watch deploys at https://app.netlify.com/projects/devbros-hackthathon/deploys. A manual deploy from a logged-in machine is still possible with `pnpm ship`.

The production organiser code is **not** in this repo. Ask Mohamed for it, and never put it on the projected screen or in a commit.

## 6. Versioning and releases

[Semantic Versioning](https://semver.org/): **patch** for fixes, **minor** for new features, **major** for breaking changes to how the event runs. The version lives in `package.json`, and every screen shows it as a small grey `v1.2.3 · <commit>`.

1. Note user-facing changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) as you go (Added / Changed / Fixed).
2. To release: rename that section to `## [x.y.z] - YYYY-MM-DD`, bump `"version"` in `package.json`, commit `Release x.y.z`, and merge to `main` (this deploys).
3. Tag and publish: `git tag vx.y.z && git push origin vx.y.z`, then `gh release create vx.y.z --title vx.y.z --notes "<that changelog section>"`.

Plain commit messages only: no `Co-Authored-By` trailers.

## Access checklist (Mohamed grants these)

| What | Why | How |
|---|---|---|
| GitHub collaborator on `redomar/devbros-hackthathon` | push branches, merge PRs | `gh api -X PUT repos/redomar/devbros-hackthathon/collaborators/<username> -f permission=push` |
| Convex team member | see prod data/logs, deploy | Convex dashboard → Team settings → Members → Invite |
| Netlify site access | only to watch deploy logs (merging to `main` already deploys) | Netlify → Team settings → Members |
| Production organiser code | run the event | send privately (not in chat logs you'd share) |
