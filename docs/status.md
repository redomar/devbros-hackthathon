# Status (as of Fri 16 Oct 2026)

**Live:** https://devbros-hackthathon.netlify.app · production Convex deployment set up, organiser code set, data empty.

## Done

- Check-in from phones (first name + level), idempotent per device, duplicate names rejected, organiser can fix spelling/levels.
- Live attendee board and `X / 9` count on the projector, with the check-in QR.
- Balanced team draw (exhaustive, randomised among optimal splits) + uniform captain draw. Shuffle animation, staggered card reveal, captain crown. Reshuffle / reopen check-in before locking.
- Reveal countdown (auto-start, hold, continue, start now).
- Server-scheduled Pomodoro: pause, resume, pause for Salah (manual resume only), skip, restart session; survives reloads.
- Salah panel: next prayer / jama'ah countdown, 10-minute reminder, full timetable; editable on `/admin`.
- Voting: new QR, device or name identity, own team blocked server-side, one vote per person, aggregate-only storage, hidden totals, organiser sees who's still to vote.
- Results: close and reveal as separate steps, 3-2-1 countdown, winner or joint-winner spotlight with confetti, ranked scoreboard; skippable; reduced-motion respected.
- Organiser tray on the iPad + `/admin` page; confirmations on every irreversible step; reset event.
- 31 unit/integration tests, `pnpm rehearse` end-to-end, CI, runbook.

## Before Sunday (must do)

- [ ] **Hardware rehearsal:** real iPad as a Home Screen app over HDMI, 2+ real phones (one on mobile data), QR scanned from the back of the room. Follow [event-day-runbook.md](event-day-runbook.md), then *Reset event*.
- [ ] Confirm *Hacking ends at* and the expected headcount in `/admin` settings.
- [ ] Check the iPad's auto-lock is off (Settings → Display → Auto-Lock → Never) and it's on charge.

## Nice to have (only if time allows; keep PRs small)

- Captains rename their team from their phone during hacking.
- Organiser-only "replay reveal" on the display after a reload.
- Netlify ↔ GitHub continuous deploy (needs a prod `CONVEX_DEPLOY_KEY` in Netlify env vars).
- Optional one-time vote code if name-only voting turns out to be a problem.

## Known limitations (by design)

- Voting identity is trust-based (anyone can type another registered name). No stored voter → choice link, but this isn't cryptographic anonymity; in a room of nine, timing can give votes away.
- Individual ballots can't be corrected; the fix is *Restart voting* for everyone.
- Salah times are for 18 Oct only; the next-prayer countdown on other days shows time until that date.
