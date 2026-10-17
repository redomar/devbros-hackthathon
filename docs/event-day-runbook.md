# Event-day runbook: Sunday 18 October 2026

## Before guests arrive (30 min)

1. **Reset rehearsal data.** On an organiser phone: `/admin` → Danger zone → *Reset event* (type RESET). Check the board shows `0 / 9`.
2. **Check settings** on `/admin`: expected brothers (9), **event date 2026-10-18**, hacking time (270 = 4h 30m), prayer break (10), focus/break (50/10), reveal countdown (3 min), and the Salah table (Birmingham Central Mosque, 18 Oct):
   Fajr 06:11/06:30 · Dhuhr 12:58/13:45 · Asr 16:14/16:45 · Maghrib 18:06/18:09 · Isha 19:32/20:00.
3. **iPad, before HDMI:** open the site in Safari → Share → *Add to Home Screen*. Launch it from the Home Screen (no address bar). Tap the bottom-right corner → *Pair this screen* → enter the organiser code. (The Home Screen app has its own storage, so pair inside it, not in Safari.)
4. Optional: in the tray, tick **Sound alerts**. After any reload, tap the screen once to re-enable sound.
5. Connect HDMI. Check the green **Live** dot top-right.
6. **QR test from the back of the room** on one phone using mobile data (not Wi-Fi).

## Running it

| Moment | Action |
|---|---|
| Everyone's checked in | Corner tray or admin phone → **Ready: make teams** (warns if the count isn't 9) |
| Late arrival after teams are drawn | **Reopen check-in**, let them join, then **Ready** again |
| Wrong name/level | Admin phone → Brothers → Edit (before hacking starts; reshuffle if the level changed) |
| Teams on screen | 3-minute auto-start, or **Start hackathon now** / **Hold countdown** |
| Dhuhr has begun (12:58) / Asr has begun (16:14) | When it suits, **Start Dhuhr break** / **Start Asr break**. Hacking pauses for 10 minutes and resumes by itself. **End … break now** if everyone's back early |
| Wrapping up | **Start voting** → new QR appears. Admin phone lists who hasn't voted yet |
| All in | **Close voting** (warns if anyone's missing) → **Reveal the winner** |

## If something goes wrong

- **Screen says Reconnecting:** check the Wi-Fi; it reconnects on its own and nothing is lost (state lives in Convex).
- **iPad crashed or reloaded:** reopen it. The phase, teams and timer pick up exactly where they were. Re-tap for sound.
- **Someone voted wrongly / disputes:** **Restart voting** wipes all totals and everyone votes again. Single ballots can't be edited, by design.
- **Started voting by mistake:** **Back to hacking** (clears any votes cast).
- **Someone can't vote "as themselves":** they use *Not you? Enter your name* and pick their name.
- **Unsuitable or mistyped team name:** `/admin` → *Team names* → **Rename** or **Reset**.
- **Lost the organiser code:** `npx convex env get ADMIN_TOKEN --prod`.
