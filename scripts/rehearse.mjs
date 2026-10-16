// End-to-end rehearsal of the whole event against YOUR DEV deployment.
//
//   pnpm dev            # in another terminal
//   pnpm rehearse       # resets the dev event, then drives display + 2 phones + organiser
//
// Uses VITE_CONVEX_URL from .env.local and ADMIN_TOKEN from the env (or `npx convex env get`).
// Screenshots land in ./rehearsal-shots. Never point this at production: it resets the event.
import { chromium } from "playwright";
import { ConvexHttpClient } from "convex/browser";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:5173";
const OUT = process.env.OUT ?? "rehearsal-shots";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("#")[0].trim().split(/=(.*)/s).slice(0, 2)),
);
const convexUrl = env.VITE_CONVEX_URL;
if (!convexUrl || !env.CONVEX_DEPLOYMENT?.startsWith("dev:")) {
  console.error("Refusing to run: .env.local must point at a dev deployment (run `pnpm dev:convex` first).");
  process.exit(1);
}
const TOKEN = process.env.ADMIN_TOKEN ?? execSync("npx convex env get ADMIN_TOKEN", { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const convex = new ConvexHttpClient(convexUrl);
await convex.mutation("flow:resetEvent", { token: TOKEN, confirm: "RESET" });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const errors = [];
const mk = async (name, viewport, { token, mobile, dsf = 2 } = {}) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, isMobile: !!mobile, hasTouch: !!mobile });
  if (token) await ctx.addInitScript((t) => localStorage.setItem("devbros.adminToken", t), token);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`));
  page.on("console", (m) => {
    // Expected: Convex logs rejected mutations (we deliberately trigger a duplicate name).
    if (m.type() === "error" && !m.text().includes("name_taken")) errors.push(`[${name}] ${m.text()}`);
  });
  return page;
};
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });
const step = (s) => console.log(`• ${s}`);

try {
  const ipad = await mk("ipad", { width: 1180, height: 820 }, { token: TOKEN });
  const tv = await mk("tv", { width: 1920, height: 1080 }, { dsf: 1 });
  const yusuf = await mk("yusuf", { width: 390, height: 844 }, { mobile: true });
  const bilal = await mk("bilal", { width: 390, height: 844 }, { mobile: true });
  const admin = await mk("admin", { width: 390, height: 844 }, { mobile: true });

  step("display opens");
  await ipad.goto(`${BASE}/event`);
  await tv.goto(`${BASE}/event`);
  await ipad.getByText("brothers checked in").waitFor();
  await shot(ipad, "01-ipad-arrivals-empty");

  step("phone check-in, duplicate name rejected, reload is idempotent");
  await yusuf.goto(`${BASE}/join`);
  await yusuf.getByLabel("Your first name").fill("yusuf");
  await yusuf.getByText("Beginner", { exact: true }).click();
  await yusuf.getByRole("button", { name: "Check in" }).click();
  await yusuf.getByText("You're checked in, Yusuf.").waitFor();
  await shot(yusuf, "02-phone-checked-in");
  await bilal.goto(`${BASE}/join`);
  await bilal.getByLabel("Your first name").fill("Yusuf");
  await bilal.getByText("Advanced", { exact: true }).click();
  await bilal.getByRole("button", { name: "Check in" }).click();
  await bilal.getByText(/already checked in/).waitFor();
  await bilal.getByLabel("Your first name").fill("Bilal");
  await bilal.getByRole("button", { name: "Check in" }).click();
  await bilal.getByText("You're checked in, Bilal.").waitFor();
  await yusuf.reload();
  await yusuf.getByText("You're checked in, Yusuf.").waitFor();

  step("organiser fills with test data");
  await admin.goto(`${BASE}/admin/${TOKEN}`);
  await admin.getByRole("button", { name: "+ Test data" }).click();
  await admin.getByRole("button", { name: "Add test data" }).click();
  await admin.getByText("Brothers (9/9)").waitFor();
  if (admin.url().includes(TOKEN)) errors.push("organiser code left in the admin URL");
  await sleep(1200);
  await shot(ipad, "03-ipad-arrivals-full");
  await shot(tv, "03b-tv-arrivals-full");

  step("Ready from the iPad tray → shuffle → team reveal");
  await ipad.mouse.click(1160, 800);
  await ipad.getByRole("button", { name: "Ready: make teams" }).click();
  await ipad.getByRole("button", { name: "Make teams", exact: true }).click();
  await sleep(1400);
  await shot(ipad, "04-ipad-shuffle");
  await sleep(3200);
  await shot(ipad, "05-ipad-teams");
  await yusuf.reload();
  await yusuf.getByText("You're in").waitFor();
  await shot(yusuf, "06-phone-my-team");

  step("hackathon, Salah pause, resume");
  await admin.getByRole("button", { name: "Start hackathon now" }).click();
  await ipad.getByText("Focus", { exact: true }).waitFor();
  await shot(ipad, "07-ipad-hackathon");
  await shot(tv, "07b-tv-hackathon");
  await admin.getByRole("button", { name: "Pause for Salah" }).click();
  await ipad.getByText("Paused for Salah", { exact: true }).waitFor();
  await shot(ipad, "08-ipad-salah-pause");
  await admin.getByRole("button", { name: "Resume" }).click();

  step("voting: device vote, name vote, own team blocked");
  await admin.getByRole("button", { name: "Start voting" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Start voting" }).click();
  await ipad.getByText("Vote now").waitFor();
  await shot(ipad, "09-ipad-voting");
  await yusuf.goto(`${BASE}/vote`);
  await yusuf.getByText("Voting as Yusuf").waitFor();
  if ((await yusuf.locator("button[disabled]", { hasText: "Your team" }).count()) !== 1) errors.push("own team not disabled");
  await shot(yusuf, "10-phone-ballot");
  await yusuf.locator("button:not([disabled])", { hasText: "Team " }).first().click();
  await yusuf.getByRole("button", { name: "Confirm my vote" }).click();
  await yusuf.getByText("Your vote is in").waitFor();
  await bilal.goto(`${BASE}/vote`);
  await bilal.getByRole("button", { name: "Not you? Enter your name" }).click();
  await bilal.getByLabel("Your first name").fill("test 1");
  await bilal.getByRole("button", { name: /Test 1\s*That's me/ }).click();
  await bilal.locator("button:not([disabled])", { hasText: "Team " }).first().click();
  await bilal.getByRole("button", { name: "Confirm my vote" }).click();
  await bilal.getByText("Your vote is in").waitFor();
  await ipad.getByText("votes received").waitFor();

  step("close (with missing voters) → reveal → scoreboard");
  await admin.getByRole("button", { name: "Close voting", exact: true }).click();
  await admin.getByRole("button", { name: "Close voting anyway" }).click();
  await ipad.getByText("The votes are in").waitFor();
  await admin.getByRole("button", { name: "Reveal the winner" }).click();
  await sleep(3800);
  await shot(ipad, "11-ipad-winner");
  await ipad.getByText("Final results").waitFor({ timeout: 15000 });
  await shot(ipad, "12-ipad-scoreboard");
  await shot(tv, "12b-tv-scoreboard");

  for (const [n, p] of [["ipad", ipad], ["tv", tv]]) {
    if ((await p.content()).includes(TOKEN)) errors.push(`${n}: organiser code in display DOM`);
  }
} catch (e) {
  errors.push(`STEP FAILED: ${e.message.split("\n")[0]}`);
} finally {
  await browser.close();
  await convex.mutation("flow:resetEvent", { token: TOKEN, confirm: "RESET" });
}

console.log(errors.length ? `\n✗ ${errors.length} problem(s):\n${errors.join("\n")}` : `\n✓ Rehearsal passed. Screenshots in ${OUT}/`);
process.exit(errors.length ? 1 : 0);
