import test from "node:test";
import assert from "node:assert/strict";
import { validateSquad, phaseAt, transferCost } from "../backend/rules.js";
import scoring from "../backend/scoring.cjs";
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
test("server validates real roster, duplicates, credits and captain membership", () => {
  assert.equal(validateSquad(team, players).credits, 88);
  assert.throws(() =>
    validateSquad({ ...team, players: Array(11).fill("P0") }, players),
  );
  assert.throws(() =>
    validateSquad({ ...team, captainId: "missing" }, players),
  );
  assert.throws(() =>
    validateSquad(
      team,
      players.map((p) => ({ ...p, credits: 12 })),
    ),
  );
  assert.throws(() =>
    validateSquad(
      team,
      players.map((p) => ({ ...p, teamCode: "PAK" })),
    ),
  );
  assert.throws(() =>
    validateSquad(
      team,
      players.map((p) => ({ ...p, role: "WK" })),
    ),
  );
  assert.throws(() =>
    validateSquad(
      team,
      players.map((p) => ({ ...p, active: false })),
    ),
  );
});
test("transfer phases and costs use explicit boundaries", () => {
  const s = {
    startsAt: "2027-01-01",
    knockoutResetAt: "2027-02-01",
    knockoutStartAt: "2027-02-02",
    endsAt: "2027-02-10",
  };
  assert.equal(phaseAt(s, new Date("2026-12-31")), "preseason");
  assert.equal(phaseAt(s, new Date("2027-01-01")), "group");
  assert.equal(phaseAt(s, new Date("2027-02-01")), "reset");
  assert.equal(phaseAt(s, new Date("2027-02-02")), "knockout");
  assert.equal(phaseAt(s, new Date("2027-02-10")), "ended");
  assert.equal(transferCost(ids, [...ids.slice(0, -1), "P12"]), 1);
  assert.equal(transferCost(ids, ids), 0);
});
test("scoring handles cricket balls, role exceptions and negative totals", () => {
  assert.equal(
    scoring.calculatePlayerPoints({ ballsBowled: 32, runsConceded: 18 }, "BOWL")
      .breakdown.details.economyRate,
    6,
  );
  assert.equal(
    scoring.calculatePlayerPoints({ runs: 0, ballsFaced: 20 }, "BOWL").breakdown
      .details.strikeRate,
    0,
  );
  assert.equal(
    scoring.calculateUserTeamPoints(
      { players: ["x", "y"], captainId: "x", viceCaptainId: "y" },
      { x: 10, y: -2 },
    ),
    17,
  );
});
