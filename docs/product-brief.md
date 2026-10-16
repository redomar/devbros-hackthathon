> **Original product brief**, kept for context. Where it differs from what was built, **[decisions.md](decisions.md) wins**. Most notably, we use Convex instead of the custom `ws` relay + JSON checkpoint described in §1, and organiser controls also live on a phone.

# Handover: Dev Bros: the Hackthathon — live event companion

> **For the receiving coding/design agent.** This is a product handover and implementation brief, not an instruction to invent missing event details. Use it to plan, design, implement, test and hand over the application. Preserve the experience described here; ask for approval only for genuine product decisions. The app is intended for a real in-person event on **Sunday 18 October 2026**.

```yaml
project:
  name: "Dev Bros: the Hackthathon" # exact event/product name; retain spelling and capitalisation
  tagline: Same intentions. Stronger together.
  objective: Help a brotherhood of young Muslim men learn AI-native building by working in balanced teams, then vote on and celebrate the results.
  event_date: 2026-10-18
  participants_expected: 9
  participant_name_policy: First names only; no surname input or display
  captain_policy: Uniform random draw of one team member per team, irrespective of experience
  teams: 3
  members_per_team: 3
  organisers: 2 developers
  venue: A house; exact location, prayer timetable and Wi-Fi details to be confirmed
  public_screen: iPad running Safari, connected/mirrored via HDMI to a large screen
  participant_devices: Personal phones accessing the site via a QR code
  stack_preference: Vite + React + TypeScript + Tailwind CSS + Anime.js
  design_preference: Light, modern, playful but premium; bright and readable, not a dark dashboard
  photo_direction: No women; preferably no profile photographs at all (use initials or abstract male-only illustrations)
  non_goals: User accounts, passwords, social sign-in, general-purpose profiles, formal relational database, complicated admin suite
```

## 0. The user’s intended experience — source of truth

The user envisions this exact day-of sequence:

1. As each brother arrives, a welcome screen is already visible on the iPad and projected to the room. A **prominent QR code remains on one side** of the screen.
2. Each attendee scans the QR code with his **own phone**, enters **first name only** and self-assesses **AI experience level** (Beginner / Intermediate / Advanced), then sees a confirmation. The public display updates its attendee count in real time.
3. When everyone has arrived, an organiser presses **Ready** on the main display. The application randomly assembles **three fair teams of three**, visibly balancing experience; each team gets **one captain chosen randomly from its three members**, independent of AI experience.
4. A polished, projector-friendly **team reveal** shows the teams. They remain visible for a short, configurable period, or until an organiser presses **Start hackathon**. Then the **Pomodoro** begins.
5. Throughout the working session, the display shows the **current focus/break timer**, the **Salah times** and next prayer, plus **Pause / Resume** (and appropriate organiser controls). Salah is a first-class part of the event, not a decorative widget.
6. As the event draws to a close, an organiser presses **Start voting**. The public display switches to a **new voting QR code**.
7. Each participant scans the code, enters/selects **his own registered first name** and, if eligible, votes for **one of the other two teams**. He **cannot vote for his own team** or cast a second vote. The submitted choice must not be retained together with his identity.
8. Once voting closes, the application shows a memorable **winner announcement**, followed by the final team ranking and anonymous aggregate vote counts.

**Do not silently collapse this into a single-device voting kiosk.** The phones really submit information to the organiser’s iPad via a shared session. Likewise, do not implement a login, user database or unrelated features without approval.

## 1. Non-negotiables and technical truth

- The **iPad is the public host/controller**, but it is **not a WebSocket server**. Phones and the iPad are separate browser sessions; browser localStorage is not shared across devices.
- Therefore, **real-time QR registration and phone voting require a reachable shared relay**. The app cannot honestly meet the live multi-device requirements with only static frontend files and localStorage.
- Implement the **smallest possible WebSocket room service**. Recommended simple deployment: **Vite static frontend + one tiny Node.js/`ws` WebSocket relay**, served under the same HTTPS origin and hosted as one small service (for example, on an existing VPS/Dokploy installation, if available).
- The relay is **not a conventional REST API or full backend application**. Do not add an ORM, accounts, a SQL database, Supabase Auth, Clerk or admin user management.
- Keep one authoritative **event room state** on the relay, with server-side validation of registration, phase transitions, votes and timer commands. The organiser browser may cache the latest acknowledged snapshot for recovery, but client-side state cannot override an already active room without deliberate recovery controls.
- **Persistence for reliability:** because the event lasts several hours, checkpoint the room state into a small JSON file on a persistent server volume (or use an equivalent lightweight per-room durable store). This is not a relational database. Offer organiser-only JSON **Export Backup / Restore Backup** as an extra safeguard. Never imply that in-memory state alone survives a server restart.
- If the organisers categorically decline **any** relay/server, explain the trade-off first: multiple phones cannot automatically contribute to the same shared iPad state using localStorage. Offer a separate single-device fallback only with their agreement.
- No personal login/authentication system. Protect privileged organiser actions with one **unguessable organiser capability URL/token**, created for the room and never included in the participant QR codes. This is a lightweight access control, not a user-account system.
- Use `HTTPS` for the participant site and `WSS` for the live connection. QR links must be publicly reachable from ordinary phones (not `localhost`).
- The event must work well on **iPad Safari in landscape**, on a **16:9 external screen where possible**, and on small iPhone/Android portrait displays.

## 2. Roles, surfaces and information boundaries

### A. Public/organiser display (`/event/:roomId`)

- Use **“Dev Bros: the Hackthathon”** as the public brand. Never replace it with the former AI-Native Ummah working title.

- Shown on iPad and mirrored through HDMI; everyone in the room sees it.
- Full-screen, readable from a distance, minimal controls, no cluttered SaaS navigation.
- Persistent current event phase and status; phase-appropriate QR code at the side.
- Organiser controls for Ready, shuffle (before lock), Start now, Pause, Resume, Start voting, Close voting and Reveal.
- Keep the results completely hidden until authorised reveal; never show individual ballots.
- Since the screen is mirrored, **do not assume controls, secrets or other content can be privately shown on the iPad**. Do not put organiser tokens, sensitive diagnostics or voter choices on the projected screen.

### B. Registration page (`/join/:roomId`)

- Opened from the arrival QR code; no signup or password.
- Inputs: **first name only** and **experience level** (Beginner / Intermediate / Advanced).
- Submit → clear confirmation: “You're checked in. Please keep this page open or rejoin later.”
- Indicate whether registration is open or closed; prevent repeated submissions from the same device creating duplicate registrations.
- **First-name collisions:** if two brothers have the same first name, do not request surnames. Instead, flag the collision and ask the organiser to agree unique **single-name display aliases** (e.g. a preferred nickname) before registration closes. Require each normalised participant-facing name/alias to be unique so voting remains unambiguous.
- Optionally keep a locally generated device registration ID in that phone’s browser to make retries idempotent, while keeping the name as the participant-facing identity.
- No email, phone number, avatar upload or unnecessary personal data.

### C. Voting page (`/vote/:roomId`)

- Opened from the new voting QR code. The form **asks for the participant’s registered first name or approved single-name alias** (type-to-search or clear input with exact, normalised matching).
- When a unique matching participant is found, show three team choices; **disable and clearly label his own team**.
- Require explicit confirmation of the choice. Allow only one successful vote per registered participant.
- Confirmation is shown privately on his phone; the public screen can show **“X of 9 votes received”**, but not interim team scores.
- If the first name/alias is unknown, duplicated/ambiguous, already used or the phase is closed, show a helpful message; organiser can resolve mistakes.
- **Identity limitation:** first-name-only verification is trust-based; somebody could enter another person’s first name. Do not claim secure voter authentication. If the user wants stronger protection, propose an optional one-time participant code issued at registration; do not impose passwords or accounts by default.

### D. Optional simple organiser settings (`/settings` or discreet drawer)

- Event title/date; expected participant count; prayer timetable; Pomodoro settings; team reveal delay; backup/restore; connected-client health; reset with explicit confirmation.
- All privileged mutations validated by the relay using the organiser capability token.

## 3. Event phases and transitions

Use a typed state machine; never infer the phase from a component being mounted.

```text
SETUP / ARRIVALS
    | organiser presses Ready; 9 valid attendees by default
    v
TEAM_REVEAL
    | show 3 balanced teams + captains; optional 3-minute countdown
    | organiser presses Start now OR configured auto-start expires
    v
HACKATHON / POMODORO
    | focus/break cycles; pause/resume any time; show Salah timetable
    | organiser presses Start voting (confirm irreversible phase change)
    v
VOTING
    | QR code; accept eligible single votes; hide interim scores
    | organiser closes voting; warn about missing voters
    v
RESULTS_PENDING
    | anticipation/reveal animation only after organiser presses Reveal
    v
WINNER / FINAL RESULTS
```

- Show a **“Are you sure?”** dialog before irreversible changes such as locking teams, starting voting, resetting the event and finalising results.
- If fewer or more than nine attendees arrive, **do not silently create unequal teams**. The default objective is exactly 3×3. Show the discrepancy and let the organisers explicitly revise expectations or handle attendance manually.
- Team reshuffling is allowed only **before** the working phase is locked. Do not silently move people between teams later.
- If needed, let the organiser correct a participant’s spelling or experience level **before** locking teams.
- On a network interruption, display a connection warning and reconnect; **do not pretend an unacknowledged vote was accepted**.

## 4. Team allocation and captains

- Participants get a simple numerical level: `Beginner=1`, `Intermediate=2`, `Advanced=3`.
- With 3 beginners + 3 intermediate + 3 advanced participants, each team gets **exactly one of each**, with randomised allocation within each tier.
- For different distributions, search the small space of 3×3 partitions (or use a sound balanced assignment method) to minimise the spread in team total/average experience; randomise among equally good solutions.
- Show enough information to explain that the draw was fair (experience mix by team and optional team score), without making the event feel like a ranking of people.
- **Randomly select exactly one captain from the three assigned members of each team**, with equal probability for every member regardless of experience level. The captain draw is independent of the balancing algorithm; do not automatically favour the most experienced member. Once teams are locked, keep captains fixed.
- The team allocation must be **deterministic when provided a test seed**, but appropriately random for the real event; test exact-membership, duplicates, captain inclusion, random selection with a seeded RNG, and balanced scores.
- Choose captains **after** team membership is finalised, via a uniform RNG selecting one of three `memberIds` per team. Expose no special captain-selection weighting by AI ability.
- Do not call an LLM to form nine teams. This is conventional, testable TypeScript logic.

## 5. Pomodoro and Salah

### Pomodoro behaviour

- Start after the team reveal: default is a **3-minute reveal window**, with buttons **Start now / Hold / Continue countdown**. Make duration configurable.
- Suggested editable defaults: **25 minutes focus / 5 minutes rest**, with presets such as 50/10. Do not hardcode the ultimate event schedule.
- Display a large countdown, **Focus** or **Break** label, current round and next transition.
- Organiser can **Pause / Resume at any time**; optional Skip break / Reset current session requires explicit confirmation.
- Use timestamps (`startedAt`, `endsAt`, `remainingMs`, `pausedAt`) calculated from an authoritative clock, **not** a `setInterval` counter as the source of truth. Safari background suspension must not make the timer drift.
- When paused, show a clear **Paused** state on the public display; do not advance to the next session until resumed.
- Preserve timer phase and remaining time through reload/reconnection and checkpoints.
- Audio alerts: optional, off by default; do not rely on autoplay working in Safari.

### Salah timetable behaviour

- The main event screen shows **local current time, next Salah and countdown**, with a small expandable timetable for **Fajr, Dhuhr, Asr, Maghrib and Isha**.
- The venue/time zone are configurable; use **Europe/London** only if the event is confirmed to be in the UK. Do not guess the exact venue or prayer times.
- **MVP without prayer APIs:** an organiser enters/edits the day’s Salah times from the mosque/local timetable before the event. Validate chronological order and show the source/settings in the organiser view. Do not fabricate a timetable.
- Distinguish a prayer’s published start time from a local mosque’s **jama'ah/iqamah** time if both are entered.
- Provide a 10-minute (configurable) “Salah approaching” reminder and an organiser **Pause for Salah** action. **Manual resume** is recommended so the timer never restarts during prayer.
- Future optional enhancement, only with approval: fetch a timetable from an external prayer-times provider and display calculation method, location and manual override. This would introduce an external API dependency.

## 6. Anonymous voting rules

- One successful vote per registered participant, only in the `VOTING` phase.
- Never accept a vote for the voter’s own team (enforce on the relay, not just by hiding the button).
- State to keep: `votedParticipantIds` as a set, and `voteCountsByTeam` as aggregated integers. **Do not create a stored voter → selected team record**, ballots table, event log containing ballot choices, or per-vote audit trail.
- An incoming vote necessarily contains identity and choice **transiently while being validated**, but the server should increment the chosen team total and mark the voter consumed in one atomic operation, then discard the pairing. Do not log the request body or transmit individual votes to the public screen.
- Handle double-submit/racing requests idempotently: only the first valid vote counts; retries must not increment again.
- Show only aggregate participation status during voting; **do not reveal per-team tallies live**, as that may allow deduction of how individuals voted in a nine-person group.
- Only the organiser closes voting; warn when some participants have not voted. Close early only with explicit confirmation.
- **Tie policy:** prefer a clearly announced tie or an organiser-triggered run-off between the tied teams, agreed before release. If implementing a run-off, ensure eligible choices exclude the voter’s own team, use a fresh aggregate tally, and preserve the original result in a non-identifying way.
- Do not claim perfect anonymity: with just nine voters and a first-name-only process, observation, vote timing and room behaviour can still make votes inferable. The product guarantees **no persisted voter-to-choice mapping**, not cryptographic anonymity.
- If a user claims to have voted incorrectly, the app cannot reverse an individual anonymous ballot. Offer an organiser-controlled **restart voting** (all votes reset, everyone re-votes) rather than secretly changing totals.

## 7. Screen-by-screen design brief

**Overall:** Show the exact brand title **“Dev Bros: the Hackthathon”** prominently on the welcome screen and consistently across the event, mobile forms and winner reveal. Display **first names only** throughout. A joyful, lightweight live-event experience with very good readability at distance. This is **not** a dark enterprise dashboard, analytics console or mobile banking interface. No women in illustrations or portraits. Prefer initials/team symbols rather than photographs.

| Screen | Projected iPad experience | Phone experience |
|---|---|---|
| 01 Welcome & arrivals | Brand, day's mission, large **Check in** QR on the right, count `7 / 9 brothers checked in`, latest arrivals, **Ready** control | First name + AI level form, submit and confirmation |
| 02 Creating teams | Short, engaging shuffle animation; progress narrative without fake computation | “Teams are being prepared” / wait |
| 03 Team reveal | Three attractive team cards across the screen; names, AI level labels, captain, fairness indicator; 3-minute countdown and **Start now** | Optional personal team view, not mandatory |
| 04 Hackathon in progress | Huge Pomodoro timer, focus/break status, next Salah/time, team strip, **Pause**, **Resume**, **Pause for Salah**, **Start voting** | Optional informational screen; no need to keep phones active |
| 05 Voting open | New **Vote now** QR on the right, `X / 9 votes received`, no interim team scores, **Close voting** | Identify first name → own team disabled → select another team → confirm → private thanks |
| 06 Final reveal | Full-screen animated suspense → winner name/team/members → celebration → final ranked scoreboard | Read-only final result if desired |

### Design exploration before detailed implementation

The user liked the **structure and journey of the second, nine-panel mockup**, but rejected its heavy darkness. Previous image experiments explored six brighter directions; no final palette has been signed off.

Present **2–3 condensed preview options**, borrowing from these previously discussed directions, before polishing all pages:

1. **Warm ivory + emerald + restrained gold** (recommended starting point): friendly, welcoming, celebratory.
2. **Sky blue + clean white + teal**: modern, bright, technical but approachable.
3. **Sage + soft cream + navy**: quiet, confident, sophisticated.

Previously explored alternatives also included **sand/gold**, **lavender/blue** and a more playful **coral/teal** identity. The receiving agent should confirm the visual direction before large UI implementation. Do not treat old generated artwork as pixel-perfect or as proof of functionality.

Example proposed light-theme tokens (starting point, *subject to design approval*):

```css
--page: #F7F5EF;          /* warm ivory */
--surface: #FFFFFF;
--surface-muted: #EEF5F0;
--ink: #162A36;           /* dark navy, not pure black */
--ink-muted: #526571;
--primary: #087A62;       /* emerald */
--primary-hover: #065E4C;
--gold: #B98224;
--border: #DAE3DF;
--danger: #B93838;
--team-a: #087A62;
--team-b: #187BB8;
--team-c: #8556B2;
```

- Colour must have meaning; provide text labels and icons as well as colour.
- Use large type for team names, timer and countdown on the external display; avoid tiny tables, microscopic badges and cramped menus.
- QR codes need a proper **quiet zone**, clear CTA, sufficient on-screen size and a short fallback URL beneath. Test from the back of the room.
- Avoid animated content behind the QR code or over the main forms.
- Aim for WCAG AA colour contrast; visible focus states; touch targets at least 44px; reduced-motion support.
- No unexpected layout shift. Reserve space for attendee count, clock and changing status text.

## 8. Animation direction (Anime.js)

Animations should give the event energy **without delaying the workflow**:

- **Arrival:** attendee appears as a gentle fade/slide into the attendee board.
- **Generating teams:** participant tokens shuffle along lines into three group containers for 2–4 seconds; **do not misrepresent it as an AI model generating the allocation**.
- **Team reveal:** cards appear in sequence; captains receive a brief highlight/crown flourish.
- **Starting timer:** one purposeful, easy-to-read transition from team reveal to large Pomodoro countdown.
- **Focus/break:** a subtle circular progress ring or progress bar; avoid constant decorative movement.
- **Salah:** unobtrusive reminder chip/banner; no flashing or distracting animations during prayer.
- **Results:** short anticipation phase, winner reveal, modest confetti/trophy treatment, then clear static scoreboard. Provide a **Skip animation** action.
- Respect `prefers-reduced-motion`; animation cannot be required to understand the information or use the app.

## 9. Suggested typed domain model

```ts
type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
type EventPhase = 'setup' | 'team_reveal' | 'hackathon' | 'voting' | 'results_pending' | 'results';
type PomodoroMode = 'focus' | 'break';

type Participant = {
  id: string; // stable non-secret ID
  firstName: string; // first name only or agreed single-name alias; never collect surnames
  normalisedFirstName: string;
  experience: ExperienceLevel;
  teamId: string | null;
};

type Team = {
  id: string;
  label: string;
  memberIds: string[]; // exactly 3 for the intended event
  captainId: string;
};

type TimerState = {
  mode: PomodoroMode;
  cycle: number;
  focusMs: number;
  breakMs: number;
  remainingMs: number;
  endsAt: number | null; // absolute epoch milliseconds if running
  isPaused: boolean;
};

type Prayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
type PrayerTime = {
  start: string;   // 24-hour local HH:mm, on event date
  congregation?: string; // optional local jama'ah HH:mm
};

type EventRoom = {
  id: string;
  phase: EventPhase;
  eventDate: string; // YYYY-MM-DD
  timeZone: string; // IANA zone, set from confirmed venue
  expectedParticipants: number;
  participants: Participant[];
  teams: Team[];
  registrationOpen: boolean;
  votesReceivedByParticipantId: string[]; // set semantics; NO chosen team here
  voteCountsByTeamId: Record<string, number>; // aggregated only
  timer: TimerState;
  prayers: Record<Prayer, PrayerTime | null>;
  revision: number; // increment on accepted state mutations
};
```

- The server has a **private authoritative room state** and sends **filtered snapshots**. Public/mobile snapshots must exclude organiser secret, hidden score counts before reveal, and unrelated sensitive internals.
- Do **not** persist a ballot object containing both `participantId` and `teamId`.
- Implement explicit command validation (schema-based, e.g. Zod), phase guards, duplicate-submission guards, atomic room mutation, revision increments and acknowledgements.

## 10. Suggested repository structure

```text
src/
  app/
    App.tsx
    routes/               # event, join, vote, results/settings
  components/
    EventShell.tsx
    JoinQrPanel.tsx
    AttendeeBoard.tsx
    TeamCard.tsx
    CaptainBadge.tsx
    PomodoroClock.tsx
    SalahStrip.tsx
    VotingBallot.tsx
    ResultsPodium.tsx
  features/
    registration/
    team-generation/
    event-timer/
    salah/
    voting/
    results/
  lib/
    websocketClient.ts
    eventState.ts
    formatTime.ts
    qr.ts
  styles/
    tokens.css
server/
  room.ts                 # authoritative room + state transitions
  ws.ts                   # WebSocket relay only
  persistence.ts          # small JSON checkpoint + restore
  validation.ts
shared/
  types.ts
  protocol.ts             # typed client/server commands
  fairness.ts             # pure, testable allocator
  votingRules.ts          # pure validation functions
  time.ts
scripts/
  smoke-test.ts
docs/
  plan.md
  event-day-runbook.md
  decisions.md
```

Avoid creating an unnecessary microservice architecture. This should be a small, readable codebase that two developers can understand and ship quickly.

## 11. Implementation order

1. **Validate the real event environment:** choose deployment domain, test an iPad connected by HDMI, confirm phones can scan QR and access HTTPS from Wi-Fi/cellular, confirm venue and Salah source.
2. **Make 2–3 light-theme visual previews:** welcome/QR, team reveal, Pomodoro+Salah, voting and results. Obtain a choice before detailed styling.
3. **Create the typed room state machine** and test the full event sequence with nine synthetic test participants (clearly identified as test data, not event attendees).
4. **Implement relay and reconnection**, organiser capability, checkpoint and backup/recovery. Verify real two-device communication early.
5. **Build arrival/check-in:** QR, mobile registration, live attendee board, validation and de-duplication.
6. **Build fair allocation:** seeded tests, shuffle/reveal, captains, lockdown.
7. **Build Pomodoro and Salah:** configurable times, accurate pause/resume across disconnects, next-prayer panel.
8. **Build voting:** phase-specific QR, name identification, no-own-team and one-vote guards, aggregate-only tally.
9. **Build winner reveal:** close/reveal split, full-screen animation, ranked results and tie path.
10. **Rehearse the entire event on the actual iPad + phone(s) + external display**, including forced reconnect, double submissions, application reload and backup recovery.

## 12. Acceptance tests / definition of done

### Cross-device and QR
- [ ] iPad screen shows arrival QR and live `0 / 9` registration count.
- [ ] Two independent phones can register while the iPad updates without refreshing.
- [ ] Refreshing a phone does not create an accidental second participant.
- [ ] Registration asks for a first name only; the system does not request, store or display surnames.
- [ ] Colliding first names are resolved through unique single-name aliases before team formation or voting.
- [ ] QR opens via normal public HTTPS URL, including from cellular data.
- [ ] On network loss, app shows reconnect state; unacknowledged submissions are not reported as successful.
- [ ] iPad mirror does not expose organiser token or any hidden scores.

### Team allocation
- [ ] Exactly nine valid attendees produce three teams of exactly three.
- [ ] Every participant appears on exactly one team.
- [ ] If experience distribution is 3/3/3, each team has 1 beginner, 1 intermediate, 1 advanced.
- [ ] Each captain belongs to his team; captains are chosen uniformly at random, regardless of experience, using a seeded RNG in tests.
- [ ] Changing a person’s experience level alone does not make him more likely to be captain.
- [ ] Underfilled/overfilled attendance is explicitly handled; no hidden unequal-team fallback.

### Timer and Salah
- [ ] Team reveal allows organiser-controlled immediate start or configurable short countdown.
- [ ] Pomodoro changes focus/break correctly and does not drift if Safari is backgrounded/reopened.
- [ ] Pause stops the countdown; resume continues from the exact remaining time; timer state survives reload.
- [ ] Prayer times use the confirmed locality/timetable; next Salah and countdown are correct for the configured time zone.
- [ ] A Salah break can be triggered manually; timer does not resume without organiser action.

### Voting and results
- [ ] Voting URL/QR is specific to the open voting phase.
- [ ] Unknown name is rejected; own team cannot be selected or submitted.
- [ ] A second submission from the same participant is rejected even from another device.
- [ ] Concurrent duplicate submissions increment the tally only once.
- [ ] No persisted voter-to-team selection mapping is created, including logs/checkpoints.
- [ ] Public display hides interim team scores until reveal.
- [ ] Closing voting and revealing results are separate organiser actions.
- [ ] Final aggregate totals sum to the number of accepted votes.
- [ ] Winner and tie scenarios work; animation is skippable and honours reduced motion.

### Quality and delivery
- [ ] Typecheck, lint, tests and production build pass.
- [ ] Browser console errors = 0 in the core rehearsal.
- [ ] Screenshot/previews checked at phone portrait, iPad landscape and projected 16:9 dimensions.
- [ ] No sideways scroll on phone; projected QR remains scannable.
- [ ] WCAG AA contrast checked for normal text and important controls; keyboard and touch interactions work.
- [ ] Organiser can export a backup and restore a valid event without changing the recorded aggregate vote totals.
- [ ] One-page **event-day runbook** exists (opening the room, HDMI, QR test, Salah configuration, recovery, result reveal).

## 13. Genuine decisions to ask the user (with recommendations)

Ask these concisely, ideally together after presenting sensible defaults — **do not block initial design exploration**:

1. **Venue and Salah times:** Which city/mosque’s timetable and which jama'ah times? **Recommendation:** organiser-entered local timetable for the day; no prayer API in MVP.
2. **Hosting:** Is there already a HTTPS domain/VPS/Dokploy service available? **Recommendation:** one tiny Node WebSocket service plus static Vite build, no database.
3. **Visual theme:** Of the light concepts, which should be final? **Recommendation:** warm ivory/emerald/gold based on the liked screen layout, without the darkness.
4. **Timer:** Preferred default focus/break and reveal delay? **Recommendation:** 25/5 and 3-minute reveal, all adjustable.
5. **Voting security:** Is trusting registered first names sufficient for nine known attendees? **Recommendation:** name-only for this supervised group, disclose the limitation; optionally add a one-time code only if requested.
6. **Ties:** Shared winners or run-off? **Recommendation:** show a tie clearly and let organisers initiate a run-off if needed.

Do not ask the user to pick a database, an authentication provider, a cloud architecture or a large feature list they never requested.

## 14. Reusable working practices from the supplied handover

These principles are carried over from the user's earlier OFP Reader handover, **not** its original ONS/PDF product domain:

- Write a short `docs/plan.md` with goal, current behaviour, proposed design, per-screen behaviour and verification before major changes.
- Treat the **blank/initial state as designed UI**, not a loading afterthought; no layout shift when names or numbers change.
- Centralise typed models and visual tokens; show explicit states for missing data, disconnected clients and invalid submissions.
- Use motion to explain transitions, not as constant decoration; respect reduced motion.
- Always verify typecheck/lint/build and a realistic browser rehearsal, not just screenshot appearance.
- Show user-facing progress as **what changed / what was tested / what remains**. Capture numbered 2× screenshots of important screens, especially the selected light theme.
- Prefer feature branches and local commits after confirmed milestones; **do not deploy, merge, sign tags or create a release unless asked**.
- Do not remove agreed behaviour silently. Ask only for material product decisions.

## 15. Instructions to the receiving agent

**Your first response:** refer to the event as **“Dev Bros: the Hackthathon”**, explicitly confirm that only first names are collected and that captains are drawn randomly, and restate the user journey accurately and explicitly acknowledge the **tiny real-time relay trade-off**. Recommend the minimal architecture. Present a small plan and 2–3 light visual directions before writing a large amount of UI code. Keep the app focused on the actual Sunday experience.

**During implementation:** prioritise an end-to-end functional rehearsal (one iPad + two phones) over extra features. Never invent prayer times. Never claim votes are cryptographically anonymous. Never store voter-choice pairs. Do not substitute a kiosk or static frontend for the requested QR multi-device experience without agreement.

**Delivery:** provide a complete runnable repository, environment/deployment notes, tests, screenshots/previews, and an event-day runbook. Leave the organiser with a comprehensible, maintainable product for one small hackathon — not an enterprise platform.
