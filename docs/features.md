# Features

What the app does today (checked against the code at v1.1.0), and what's still to build. Where a feature lives is noted so you can find it fast.

Status key: ✅ done · 🟡 partly done · ⬜ not started

## Done

### Check-in (`/join`, `convex/participants.ts`)

- ✅ First name + AI level (Beginner / Intermediate / Advanced) from a phone via the check-in QR. No surnames, email or photos.
- ✅ Idempotent per device: re-submitting from the same phone updates the row instead of duplicating it (private `deviceId` in localStorage).
- ✅ Duplicate names rejected with "add a nickname or initial" (normalised-name index).
- ✅ Brothers can remove their own check-in until teams are drawn; the phone then forgets itself.
- ✅ Check-in closes once teams are drawn; capped at 12 people.
- ✅ After teams are drawn, the phone shows *My team* (members, levels, captain crown, "you were drawn as captain").

### Big screen (`/event`, `src/components/display/`)

- ✅ One view per phase: arrivals, team reveal, hackathon, voting, results pending, results.
- ✅ Header: brand, phase label, live clock (Europe/London), Salah chip, Live/Reconnecting dot.
- ✅ Arrivals: large check-in QR with fallback URL, live `X / 9 brothers checked in`, attendee board.
- ✅ Installable as an iPad Home Screen app (landscape, standalone manifest).
- ✅ Scales from one root font size, so it fits iPad and 16:9 projector.
- ✅ Reveal animations only play when the room watches the change live; a reload never replays them.
- ✅ Version stamp on every screen.

### Teams (`shared/fairness.ts`, `convex/flow.ts`)

- ✅ Exhaustive search over every split; random choice among the most balanced by average experience, then by fewest same-level teammates. 3/3/3 levels always gives one of each per team.
- ✅ Captains drawn uniformly per team, ignoring experience.
- ✅ 3–12 people, always 3 teams with sizes differing by at most one. Explicit confirmation when the count ≠ expected.
- ✅ Fixed identities: Emerald ◆, Sapphire ●, Amethyst ▲ (colour + symbol, never colour alone).
- ✅ Draw animation: chips hop around then fly into the real team cards; captains crowned (v1.1.0).
- ✅ Reshuffle and *Reopen check-in* (for latecomers) before hacking starts.
- ✅ Organiser can fix a name or level before hacking starts.

### Reveal countdown and hacking clock (`shared/hacking.ts`, `convex/flow.ts`)

- ✅ Configurable auto-start after the reveal (default 3 min; 0 = manual), with Hold / Continue / Start now.
- ✅ 4h 30m of hacking time in 50/10 rounds (last block 30 min), shown as a clock dial. Server stores hacking time done; clients count using a server-clock offset, so no drift when Safari is backgrounded.
- ✅ Organiser-called 10-minute prayer breaks once Dhuhr/Asr begins, resuming by themselves; Pause, Resume, Skip block, Restart block.
- ✅ Survives reloads and reconnects.
- ✅ Projected finish time (~17:20 from a 12:30 start with two prayer breaks), updated live.

### Salah (`shared/salah.ts`, `src/components/SalahPanel.tsx`)

- ✅ Birmingham Central Mosque timetable for 18 Oct 2026 (begins + jama'ah) as defaults.
- ✅ Next prayer / jama'ah countdown, full timetable, 10-minute "approaching" reminder chip.
- ✅ Editable on `/admin`, validated for HH:mm and chronological order.

### Voting (`/vote`, `convex/voting.ts`)

- ✅ New voting QR on the big screen; `X / Y votes received`, team totals hidden.
- ✅ The phone that checked in votes automatically; *Not you?* falls back to typing a registered name.
- ✅ Server-side guards: voting phase only, known voter, has a team, one vote, not own team.
- ✅ Aggregate counters only; no voter → team record anywhere. Concurrent duplicates count once.
- ✅ Organiser sees who's still to vote (names only, `/admin` only, never the projector).
- ✅ *Restart voting* (zero all totals) and *Back to hacking* (clears votes).

### Results (`src/components/display/ResultsViews.tsx`, `src/lib/results.ts`)

- ✅ Close voting and Reveal are separate organiser steps; closing warns if anyone hasn't voted.
- ✅ "The votes are in" → 3-2-1 → winner (or joint winners on a tie) with confetti → ranked scoreboard with counts.
- ✅ Skippable; respects reduced motion.
- ✅ Phones show the final results on `/vote`.

### Organiser tools (`/admin`, `OrganiserTray.tsx`, `OrganiserControls.tsx`)

- ✅ `/admin/<code>` stores the code on the device and strips it from the URL. Token checked server-side against `ADMIN_TOKEN` (constant-time compare).
- ✅ Hidden corner tray on the iPad, paired by typing the code (password field); auto-hides; closes on every phase change.
- ✅ Phase-aware buttons shared by the tray and `/admin`; confirmation on every irreversible step.
- ✅ Settings: expected headcount, focus/break, reveal countdown, hacking end time, Salah table.
- ✅ Add clearly labelled test participants; *Reset event* (type RESET) keeps settings.
- ✅ Optional sound alerts on the iPad: focus/break change, Salah reminder, winner reveal.

### Reliability and delivery

- ✅ Convex as the whole backend; all state durable, every screen live over WebSocket.
- ✅ Reconnecting banner on phones; unconfirmed submissions never shown as accepted.
- ✅ localStorage failures fall back to memory.
- ✅ 32 Vitest tests (allocator, Salah/time, timer, Convex integration), `pnpm rehearse` Playwright run, CI on PRs, Netlify auto-deploy from `main`.
- ✅ Docs: README, CONTRIBUTING, architecture, decisions, status, event-day runbook, changelog.

## Still to do

### Before Sunday (from `docs/status.md`)

- ⬜ Hardware rehearsal: real iPad Home Screen app over HDMI, 2+ real phones (one on mobile data), QR scanned from the back of the room. Then *Reset event*.
- ⬜ Confirm *Hacking ends at* and expected headcount in `/admin`.
- ⬜ iPad auto-lock off and on charge.

### Nice to have (already planned)

- ⬜ Captains rename their team from their phone during hacking.
- ⬜ Organiser-only "replay reveal" on the display after a reload.
- ⬜ Optional one-time vote code, if name-only voting turns out to be a problem.

### Gaps spotted while reading the code

- 🟡 Time zone and Salah source aren't editable (the event date now is, on `/admin`).
- 🟡 No integration tests for the reveal auto-start, skip/restart session, reshuffle or reset.
- 🟡 `CHANGELOG.md` 1.0.0 says "7–12 people supported"; the code and architecture doc allow 3–12.

### New features

<!-- Add what the app needs next here. One line each; link a PR when it lands. -->

#### 🟡 Hacking clock: 4h 30m of hacking, with prayer breaks that pause it

**Status:** built and unit/integration-tested (46 tests). Still to do: push to the dev Convex deployment and run `pnpm rehearse` in a real browser.

**Goal:** guarantee 4 hours 30 minutes of hacking time. Organisers call each prayer break whenever it suits once the prayer has begun. A prayer break pauses the hacking clock for 10 minutes, then hacking carries on where it left off. Starting at 12:30 with two prayer breaks, we finish at about 17:20.

**Design:** https://claude.ai/artifact/TzHQwGtL9fMuMqVPd2eXnf. It has:
- the big screen during focus, a Dhuhr break and a short break;
- the full plan;
- the organiser phone;
- the dial on its own, which you can scrub through.

**The hacking plan (measured in hacking time, not clock time):**

| Hacking time | Block | Length |
|---|---|---|
| 0:00 – 0:50 | Focus 1 | 50 min |
| 0:50 – 1:00 | Break | 10 min |
| 1:00 – 1:50 | Focus 2 | 50 min |
| 1:50 – 2:00 | Break | 10 min |
| 2:00 – 2:50 | Focus 3 | 50 min |
| 2:50 – 3:00 | Break | 10 min |
| 3:00 – 3:50 | Focus 4 | 50 min |
| 3:50 – 4:00 | Break | 10 min |
| 4:00 – 4:30 | Focus 5 (final) | 30 min |

Totals: 3h 50m focus + 40m breaks = 4h 30m. Prayer breaks (2 × 10 min) come on top.

**Prayer breaks:**
- The organiser sees **Start Dhuhr break** once Dhuhr begins (12:58) and **Start Asr break** once Asr begins (16:14), on `/admin` and in the iPad tray. Before that, the button is disabled with "Available from 16:14".
- Pressing it pauses the hacking clock wherever it is, even mid-focus, and starts a 10-minute prayer countdown. When it ends, hacking resumes automatically from the same point. The organiser can also end it early.
- Each prayer can be taken once. Later blocks and the finish time move back by the length of the break.

**Screen design: a hacking clock dial:**
- One large circle is the whole 4h 30m of hacking, starting at the top and going clockwise. Hour marks run *Start, 1h, 2h, 3h, 4h*.
  - **Outer ring:** focus blocks in emerald, numbered 1–5, and breaks in blue. Finished arcs fade.
  - **Hand:** points at how far through the hacking we are. It stops (and turns gold) during a prayer break.
  - **Prayer badges on the ring:**
    - A solid gold badge marks where a prayer break was taken.
    - A dashed badge marks where the next prayer is expected.
    - A highlighted badge marks a prayer break happening now.
  - **Inner ring:** fills up as the current block (or prayer break) runs.
  - **Centre:** "Focus" / "Break" / "Dhuhr", the countdown, and what's next in clock time ("Break at 13:20", "Hacking resumes at 13:18").
- The whole screen is tinted by mode: green for focus, blue for break, warm gold for Salah. During Salah the header pill says *Salah*.
- Right column:
  - a "Salah has begun" card while a prayer is due;
  - *Up next* in clock time, which shifts after each prayer break;
  - hacked so far ("35m of 4h 30m");
  - the projected finish time ("~17:20").
- The team strip under the timer is dropped to make room for the dial.

**What changes in the code:**
- Track **hacking time**, not clock time. The server stores how many hacking minutes are done plus when the current run started. Every block's position comes from that, so pauses and prayer breaks shift everything automatically. (`convex/schema.ts`, `shared/hacking.ts`.)
- The plan is a fixed list of blocks (50/10 × 4, then 30). Settings: total hacking time (4h 30m), focus/break length (50/10) and prayer break length (10).
- New mutations `startPrayerBreak(prayer)` and `endPrayerBreak`. They're allowed only during hacking, only after that prayer begins, and once per prayer. A scheduled job resumes hacking after 10 minutes, using the same stale-job guard as `advanceTimer`.
- The existing *Pause for Salah* (manual resume) is replaced by the prayer break. Plain *Pause* / *Resume* stays for anything else.
- A new `HackingDial` component replaces `PomodoroClock.tsx` in `HackathonView.tsx`. The rings are SVG arcs and the hand is a rotated SVG group.
- Tests: hacking time excludes prayer breaks, the break resumes automatically, a prayer can't be started before it begins or taken twice, and the finish time is correct.

**Decided (17 Oct):** auto-resume after 10 minutes with an "end early" button. A prayer break during a short break resumes into the rest of that break. The final focus block is 30 minutes. See decision #17.

**Done when:** hacking totals exactly 4h 30m whenever the prayer breaks are taken. The dial and the finish time update when a prayer break starts. Hacking resumes on its own after 10 minutes. Focus, break and Salah are unmistakable from across the room.
