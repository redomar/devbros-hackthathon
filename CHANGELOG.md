# Changelog

All notable changes to Dev Bros: the Hackthathon. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.1] - 2026-10-16

### Fixed

- **Phone header on iPhone 13 / 13 Pro:** the **My check-in** and **Organiser** buttons wrapped onto two lines. The name now sits as a two-line lockup beside a single-line button. On very narrow or zoomed screens the logo mark steps aside so nothing overlaps. Checked from 293 to 430 px wide.
- **"Powered by Netlify" badge** no longer floats over phones and the big screen (turned off in the Netlify project settings).

## [1.0.0] - 2026-10-16

First release, ready for the event on Sunday 18 October 2026.

### Added

- **Big screen** (`/event`) for the iPad mirrored to the projector, one view per stage:
  - **Check-in:** welcome, a large check-in QR code, a live `X / 9 brothers checked in` count and the attendee board.
  - **Teams:** a shuffle animation, then three team cards (Emerald ◆, Sapphire ●, Amethyst ▲) with each brother's level and a crowned captain. A 3-minute countdown to the start, which organisers can hold, continue or skip.
  - **Hacking:** a large focus/break timer, the next Salah with its jama'ah countdown and full timetable, an optional "hacking ends at" time, and the team strip.
  - **Voting:** a new QR code and `X / 9 votes received`, with scores hidden.
  - **Results:** "The votes are in", then a 3-2-1 countdown, the winner (or joint winners) with confetti, and the ranked scoreboard. Skippable.
- **Check-in from phones** (`/join`): first name and AI level only. Re-submitting from the same phone updates it instead of duplicating it. Duplicate names are asked to add a nickname or initial. Brothers can remove their own check-in until teams are drawn, and a removed phone forgets itself.
- **Voting from phones** (`/vote`): the phone that checked in votes as that brother; *Not you?* lets anyone pick their name. Your own team is blocked and you get one vote. Only team totals are stored, never who voted for whom.
- **Fair teams:** checks every possible split and picks at random among the most balanced by experience. Three beginners, three intermediates and three advanced always give one of each per team. Captains are drawn at random, ignoring experience. 7–12 people supported, with a confirmation if the count isn't what was expected.
- **Organiser controls** in a hidden corner tray on the iPad (paired by typing the organiser code) and on `/admin/<code>` for phones. They cover making and reshuffling teams, the timer, Pause for Salah (resumed by hand), skipping and restarting a session, starting, closing and restarting voting, revealing results, fixing names and levels, test data, settings and resetting the event. Every irreversible step asks first.
- **Salah times** from Birmingham Central Mosque's published timetable for 18 Oct 2026 (begins and jama'ah), editable on `/admin`, with a 10-minute reminder.
- **Optional sound alerts** on the iPad for focus/break changes, the Salah reminder and the winner reveal.
- **Live connection indicator** on the big screen and a reconnecting banner on phones. Unconfirmed submissions are never shown as accepted.
- **Version stamp** (`v1.0.0 · <commit>`) in small grey text on every screen.
