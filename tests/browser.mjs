// UI contract tests use mocked API responses. They do NOT prove MongoDB persistence.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const data = JSON.parse(
  await readFile(new URL("../backend/sample-data.json", import.meta.url)),
);
const players = data.teams.flatMap((t) =>
  t.players.map((p) => ({
    _id: p.externalApiId,
    name: p.name,
    teamCode: t.shortCode,
    role: p.role,
    credits: p.credits,
    active: true,
  })),
);
const catalog = {
  players,
  settings: {
    dataLabel: "Practice data • squads and fixtures are unverified",
    groupTransfers: 135,
    knockoutTransfers: 10,
  },
  phase: "preseason",
  matches: [
    {
      _id: "match1",
      title: "Pakistan vs India",
      teamA: "PAK",
      teamB: "IND",
      startTime: new Date(Date.now() + 86400000).toISOString(),
      isSample: true,
      status: "UPCOMING",
      stage: "Group",
      venue: "Practice fixture",
    },
  ],
};
const user = {
  _id: "test-user",
  name: "Test Captain",
  email: "captain@example.test",
};
let saved = null,
  failSave = false;
const vite = await createServer({ server: { port: 5178, host: "127.0.0.1" } });
await vite.listen();
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {},
      status = 200;
    if (url.pathname === "/api/catalog") body = catalog;
    else if (url.pathname === "/api/auth/me") body = { user };
    else if (
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/register"
    )
      body = { user, token: "ui-contract-token" };
    else if (
      url.pathname === "/api/squad" &&
      route.request().method() === "PUT"
    ) {
      if (failSave) {
        status = 503;
        body = { error: "Database unavailable. Nothing saved." };
      } else {
        const input = route.request().postDataJSON();
        saved = {
          ...input,
          revision: input.revision + 1,
          usedGroup: 0,
          usedKnockout: 0,
          history: [],
          updatedAt: new Date().toISOString(),
        };
        body = { squad: saved };
      }
    } else if (url.pathname === "/api/squad") body = { squad: saved };
    else if (url.pathname === "/api/leaderboard")
      body = { rows: [], page: 1, total: 0 };
    else if (url.pathname === "/api/leagues") body = { leagues: [] };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("http://127.0.0.1:5178");
  await page.getByText("Big tournament.").waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      console.log(
        await page.evaluate(() =>
          [...document.querySelectorAll("*")]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .map((e) => [
              e.tagName,
              e.className,
              e.getBoundingClientRect().width,
            ])
            .slice(0, 25),
        ),
      );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `home overflow ${width}`,
    );
  }
  await mkdir("../qa", { recursive: true });
  await page.screenshot({ path: "../qa/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../qa/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Build my free team" }).click();
  await page.getByLabel("Email", { exact: true }).fill("captain@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Pick my players" }).click();
  const picks = [];
  for (const [role, n] of [
    ["WK", 1],
    ["BAT", 4],
    ["ALL", 2],
    ["BOWL", 4],
  ]) {
    const pool = players
      .filter((p) => p.role === role)
      .sort((a, b) => a.credits - b.credits);
    for (const p of pool) {
      if (picks.filter((p) => p.role === role).length === n) break;
      if (picks.filter((x) => x.teamCode === p.teamCode).length < 7)
        picks.push(p);
    }
  }
  assert.ok(picks.reduce((s, p) => s + p.credits, 0) <= 100);
  for (const role of ["WK", "BAT", "ALL", "BOWL"]) {
    await page.locator(".role-tabs button").filter({ hasText: role }).click();
    for (const p of picks.filter((p) => p.role === role)) {
      await page
        .getByRole("button", { name: `Add ${p.name}`, exact: true })
        .click();
    }
  }
  assert.equal(
    await page.getByRole("button", { name: "Choose captains" }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "Choose captains" }).click();
  await page
    .getByRole("button", { name: `Captain ${picks[0].name}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: `Vice captain ${picks[1].name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await page.getByText("Saved to your account").waitFor();
  assert.equal(saved.players.length, 11);
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "My XI" })
    .click();
  await page.getByText("Saved to your account").waitFor();
  await page.getByRole("button", { name: "Edit team", exact: true }).click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.querySelector(".builder").scrollWidth <= innerWidth,
      ),
      true,
      `builder overflow ${width}`,
    );
  }
  await page.getByRole("button", { name: "Choose captains" }).click();
  failSave = true;
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Database unavailable" })
    .waitFor();
  assert.equal(await page.locator(".captain-btn.chosen").count(), 2);
  assert.equal(saved.revision, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../qa/captains.png", fullPage: true });
  await page.getByRole("button", { name: "1 · Pick players" }).click();
  await page.screenshot({ path: "../qa/builder.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS UI: responsive widths 320/390/768/1440; auth, 11-player selection, captain save, reload, failed save preserves draft; no browser errors. API mocked.",
  );
} finally {
  await browser.close();
  await vite.close();
}
