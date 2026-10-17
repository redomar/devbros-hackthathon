# Status (as of Fri 16 Oct 2026)

**Live:** https://devbros-hackthathon.netlify.app · production Convex deployment set up, organiser code set, data empty.

## Done

- Check-in from phones (first name + level), idempotent per device, duplicate names rejected, organiser can fix spelling/levels.
- Live attendee board and `X / 9` count on the projector, with the check-in QR.
- Balanced team draw (exhaustive, randomised among optimal splits) + uniform captain draw. Shuffle animation, staggered card reveal, captain crown. Reshuffle / reopen check-in before locking.
- Reveal countdown (auto-start, hold, continue, start now).
- Hacking clock: 4h 30m of hacking time in 50/10 rounds on a clock dial; 10-minute prayer breaks called by organisers once Dhuhr/Asr begins, resuming by themselves; pause, resume, skip, restart; survives reloads. Finishes ~17:20 from a 12:30 start.
- Salah panel: next prayer / jama'ah countdown, 10-minute reminder, full timetable; editable on `/admin`.
- Voting: new QR, device or name identity, own team blocked server-side, one vote per person, aggregate-only storage, hidden totals, organiser sees who's still to vote.
- Results: close and reveal as separate steps, 3-2-1 countdown, winner or joint-winner spotlight with confetti, ranked scoreboard; skippable; reduced-motion respected.
- Organiser tray on the iPad + `/admin` page; confirmations on every irreversible step; reset event.
- Captains rename their team from their phone (after the draw, until voting opens); the big screen announces it; organisers can fix or reset a name on `/admin`.
- 51 unit/integration tests, `pnpm rehearse` end-to-end, CI, runbook; merges to `main` auto-deploy via Netlify.

## Before Sunday (must do)

- [ ] **Hardware rehearsal:** real iPad as a Home Screen app over HDMI, 2+ real phones (one on mobile data), QR scanned from the back of the room. Follow [event-day-runbook.md](event-day-runbook.md), then *Reset event*.
- [ ] Confirm the expected headcount, event date (2026-10-18), hacking time (270) and focus/break (50/10) in `/admin` settings. Rows saved before this change keep their old 25/5.
- [ ] Check the iPad's auto-lock is off (Settings → Display → Auto-Lock → Never) and it's on charge.

## Nice to have (only if time allows; keep PRs small)

- Organiser-only "replay reveal" on the display after a reload.
- Optional one-time vote code if name-only voting turns out to be a problem.

## Known limitations (by design)

- Voting identity is trust-based (anyone can type another registered name). No stored voter → choice link, but this isn't cryptographic anonymity; in a room of nine, timing can give votes away.
- Individual ballots can't be corrected; the fix is *Restart voting* for everyone.
- Salah times are for 18 Oct only; the next-prayer countdown on other days shows time until that date.
