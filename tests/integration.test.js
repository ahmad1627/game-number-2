import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../backend/app.js";
import {
  User,
  Player,
  Squad,
  Match,
  Settings,
  initModels,
} from "../backend/models.js";
import {
  validateSquad,
  phaseAt,
  transferCost,
  versionAt,
} from "../backend/rules.js";
import { tokenFor } from "../backend/auth.js";
import scoring from "../backend/scoring.cjs";
process.env.JWT_SECRET = "test-secret-only-abcdefghijklmnopqrstuvwxyz";
process.env.ADMIN_EMAILS = "organiser@example.test";
let db, server, base, token, user, squad, adminToken, match, testUri;
const testDbName = "fantasy_test_" + Date.now();
const players = Array.from({ length: 14 }, (_, i) => ({
  _id: `P${i}`,
  name: `Player ${i}`,
  teamCode: i < 7 ? "PAK" : "IND",
  role: i < 2 ? "WK" : i < 6 ? "BAT" : i < 8 ? "ALL" : "BOWL",
  credits: 8,
  active: true,
}));
const ids = [
  "P0",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
  "P11",
];
const team = {
  players: ids,
  captainId: "P0",
  viceCaptainId: "P2",
  teamName: "Lahore XI",
  revision: 0,
};
async function req(route, method = "GET", body, auth = token) {
  const r = await fetch(base + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, ...(await r.json()) };
}
before(async () => {
  if (process.env.TEST_MONGODB_URI) {
    testUri = process.env.TEST_MONGODB_URI;
  } else {
    db = await MongoMemoryServer.create();
    testUri = db.getUri();
  }
  await mongoose.connect(testUri, { dbName: testDbName });
  await initModels();
  await Player.insertMany(players);
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState === 1)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (db) await db.stop();
});
test("auth requires credentials; admin cannot be claimed through registration", async () => {
  assert.equal(
    (
      await req(
        "/auth/register",
        "POST",
        {
          name: "Imposter",
          email: "organiser@example.test",
          password: "password123",
        },
        null,
      )
    ).status,
    403,
  );
  const r = await req(
    "/auth/register",
    "POST",
    { name: "Tester", email: "tester@example.test", password: "password123" },
    null,
  );
  assert.equal(r.status, 201);
  token = r.token;
  user = r.user;
  assert.equal(
    (
      await req(
        "/auth/login",
        "POST",
        { email: "tester@example.test", password: "wrong" },
        null,
      )
    ).status,
    401,
  );
  assert.equal((await req("/squad", "PUT", team, null)).status, 401);
  assert.equal((await req("/admin/settings", "PUT", {}, token)).status, 403);
});
test("save then logout/login restores exact XI without fake points", async () => {
  let r = await req("/squad", "PUT", {
    ...team,
    userId: "someone-else",
    totalPoints: 9999,
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  squad = r.squad;
  assert.equal(squad.userId, user._id);
  assert.equal(squad.usedGroup, 0);
  const oldToken = token;
  assert.equal((await req("/auth/logout", "POST")).status, 200);
  assert.equal((await req("/squad", "GET", null, oldToken)).status, 401);
  r = await req(
    "/auth/login",
    "POST",
    { email: "tester@example.test", password: "password123" },
    null,
  );
  token = r.token;
  r = await req("/squad");
  assert.deepEqual(r.squad.players, ids);
  assert.equal(r.squad.captainId, "P0");
  assert.equal((await req("/leaderboard")).rows.length, 0);
});
test("stale edits rejected and concurrent saves commit only once", async () => {
  assert.equal((await req("/squad", "PUT", team)).status, 409);
  const b = { ...team, revision: 1, teamName: "Lahore Champions" };
  const responses = await Promise.all([
    req("/squad", "PUT", b),
    req("/squad", "PUT", b),
  ]);
  assert.deepEqual(responses.map((x) => x.status).sort(), [200, 409]);
  squad = (await req("/squad")).squad;
  assert.equal(squad.history.length, 2);
  assert.equal(squad.history[1].teamName, "Lahore Champions");
  assert.ok(new Date(squad.history[1].savedAt).getTime() > 0);
});
test("limited transfers reject excess; captain-only edit is free; history remains fixed", async () => {
  await Settings.updateOne(
    { _id: "main" },
    { $set: { startsAt: new Date(Date.now() - 60000), groupTransfers: 1 } },
  );
  const input = {
    ...team,
    revision: squad.revision,
    players: [...ids.slice(0, -1), "P12"],
  };
  let r = await req("/squad", "PUT", input);
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.squad.usedGroup, 1);
  const lockedTime = new Date(Date.now() + 5);
  await new Promise((r) => setTimeout(r, 10));
  r = await req("/squad", "PUT", {
    ...input,
    revision: r.squad.revision,
    captainId: "P2",
    viceCaptainId: "P0",
  });
  assert.equal(r.status, 200);
  assert.equal(r.squad.usedGroup, 1);
  assert.equal(versionAt(r.squad, lockedTime).captainId, "P0");
  squad = r.squad;
  assert.equal(
    (await req("/squad", "PUT", { ...team, revision: squad.revision })).status,
    400,
  );
});
test("private leagues persist membership and deny non-members", async () => {
  const league = (await req("/leagues", "POST", { name: "Lahore club" }))
    .league;
  assert.equal((await req("/leagues")).leagues.length, 1);
  const other = await req(
    "/auth/register",
    "POST",
    { name: "Second", email: "second@example.test", password: "password123" },
    null,
  );
  assert.equal(
    (
      await req(
        `/leagues/leaderboard?league=${league.code}`,
        "GET",
        null,
        other.token,
      )
    ).status,
    404,
  );
  assert.equal(
    (await req("/leagues/join", "POST", { code: league.code }, other.token))
      .status,
    200,
  );
  assert.equal(
    (
      await req(
        `/leagues/leaderboard?league=${league.code}`,
        "GET",
        null,
        other.token,
      )
    ).status,
    200,
  );
});
test("score publishing is authenticated, deadline-bound, repeatable and private", async () => {
  const admin = await User.create({
    name: "Admin",
    email: "organiser@example.test",
    password: "not-a-real-hash",
  });
  adminToken = tokenFor(admin);
  const future = await Match.create({
    title: "Future",
    teamA: "PAK",
    teamB: "IND",
    startTime: new Date(Date.now() + 100000),
  });
  assert.equal(
    (
      await req(
        `/admin/matches/${future._id}/scores`,
        "POST",
        { source: "Verified reference", stats: {} },
        adminToken,
      )
    ).status,
    400,
  );
  match = await Match.create({
    title: "PAK vs IND",
    teamA: "PAK",
    teamB: "IND",
    startTime: new Date(Date.now() - 1),
  });
  const payload = {
    source: "Test verified scorecard",
    stats: { P0: { runs: 20, isPlayingXI: true } },
  };
  assert.equal(
    (await req(`/admin/matches/${match._id}/scores`, "POST", payload)).status,
    403,
  );
  assert.equal(
    (
      await req(
        `/admin/matches/${match._id}/scores`,
        "POST",
        payload,
        adminToken,
      )
    ).status,
    200,
  );
  const a = await req("/leaderboard");
  assert.equal(a.rows.length, 1);
  assert.equal(a.rows[0].totalPoints, 36);
  assert.ok(!JSON.stringify(a).includes("tester@example"));
  assert.equal(
    (
      await req(
        `/admin/matches/${match._id}/scores`,
        "POST",
        payload,
        adminToken,
      )
    ).status,
    200,
  );
  assert.equal((await req("/leaderboard")).rows[0].totalPoints, 36);
  const entry = await req(`/matches/${match._id}/team`);
  assert.equal(entry.locked, true);
  assert.equal(entry.totalPoints, 36);
  await req(
    `/admin/matches/${match._id}`,
    "PUT",
    { status: "ABANDONED" },
    adminToken,
  );
  assert.equal((await req("/leaderboard")).rows.length, 0);
});
test("database disconnect fails honestly, then saved teams survive application restart", async () => {
  await mongoose.disconnect();
  const r = await req("/squad");
  assert.equal(r.status, 503);
  await mongoose.connect(testUri, { dbName: testDbName });
  await new Promise((r) => server.close(r));
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  assert.equal((await req("/squad")).squad.revision, squad.revision);
});
