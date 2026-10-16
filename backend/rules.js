export const ROLE_LIMITS = {
  WK: [1, 4],
  BAT: [3, 6],
  ALL: [1, 4],
  BOWL: [3, 6],
};
export function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export function phaseAt(settings, now = new Date()) {
  if (settings.endsAt && now >= new Date(settings.endsAt)) return "ended";
  if (!settings.startsAt || now < new Date(settings.startsAt))
    return "preseason";
  if (
    settings.knockoutResetAt &&
    now >= new Date(settings.knockoutResetAt) &&
    settings.knockoutStartAt &&
    now < new Date(settings.knockoutStartAt)
  )
    return "reset";
  if (settings.knockoutStartAt && now >= new Date(settings.knockoutStartAt))
    return "knockout";
  return "group";
}
export function validateSquad(input, pool) {
  const ids = input.players;
  if (
    !Array.isArray(ids) ||
    ids.length !== 11 ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== 11
  )
    fail("Choose exactly 11 different players.");
  const players = ids.map((id) => pool.find((p) => p._id === id && p.active));
  if (players.some((p) => !p))
    fail("A selected player is unavailable. Reload the player list.");
  if (
    !ids.includes(input.captainId) ||
    !ids.includes(input.viceCaptainId) ||
    input.captainId === input.viceCaptainId
  )
    fail("Choose two different selected players as captain and vice-captain.");
  const credits = players.reduce((n, p) => n + Math.round(p.credits * 10), 0);
  if (credits > 1000) fail("Your team costs more than 100 credits.");
  for (const [role, [min, max]] of Object.entries(ROLE_LIMITS)) {
    const n = players.filter((p) => p.role === role).length;
    if (n < min || n > max) fail(`Choose ${min}–${max} ${role} players.`);
  }
  const countries = {};
  for (const p of players) {
    countries[p.teamCode] = (countries[p.teamCode] || 0) + 1;
    if (countries[p.teamCode] > 7)
      fail("Maximum seven players from one country.");
  }
  if (
    typeof input.teamName !== "string" ||
    input.teamName.trim().length < 2 ||
    input.teamName.trim().length > 30
  )
    fail("Team name must be 2–30 characters.");
  return { credits: credits / 10, players };
}
export function transferCost(previous, ids) {
  return previous?.length
    ? ids.filter((id) => !previous.includes(id)).length
    : 0;
}
export function versionAt(squad, deadline) {
  return [...(squad.history || [])]
    .reverse()
    .find((v) => new Date(v.savedAt) < new Date(deadline));
}
export function validateSettings(body) {
  const dates = ["startsAt", "knockoutResetAt", "knockoutStartAt", "endsAt"];
  const out = {};
  for (const key of dates) out[key] = body[key] ? new Date(body[key]) : null;
  if (dates.some((k) => out[k] && Number.isNaN(out[k].getTime())))
    fail("Invalid tournament date.");
  if (out.knockoutResetAt && !out.knockoutStartAt)
    fail("Set the knockout start for a reset window.");
  const times = dates.filter((k) => out[k]).map((k) => out[k].getTime());
  if (times.some((t, i) => i > 0 && t <= times[i - 1]))
    fail("Tournament dates must be in chronological order.");
  for (const key of ["groupTransfers", "knockoutTransfers"]) {
    if (!Number.isInteger(body[key]) || body[key] < 0 || body[key] > 1000)
      fail("Transfer limits must be whole numbers from 0 to 1000.");
    out[key] = body[key];
  }
  for (const key of ["title", "dataLabel", "ruleLabel"]) {
    if (typeof body[key] !== "string" || body[key].length > 200)
      fail("Invalid setting text.");
    out[key] = body[key];
  }
  return out;
}
