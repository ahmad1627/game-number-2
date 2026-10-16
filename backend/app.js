import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  User,
  Player,
  Squad,
  Match,
  Entry,
  League,
  Settings,
} from "./models.js";
import { auth, admin, safeUser, tokenFor } from "./auth.js";
import {
  fail,
  validateSquad,
  phaseAt,
  transferCost,
  versionAt,
  validateSettings,
} from "./rules.js";
import scoring from "./scoring.cjs";
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const objectId = (id) => {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id))
    fail("Invalid record ID.");
  return id;
};
const clean = (value, min, max, label) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(`${label} must be ${min}–${max} characters.`);
  return value.trim();
};
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY)
    app.set("trust proxy", Number(process.env.TRUST_PROXY));
  app.use(helmet());
  app.use(compression());
  const origins = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((x) => x.trim());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.get("/api/health", (_req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({
        database:
          mongoose.connection.readyState === 1 ? "connected" : "unavailable",
      }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests. Wait one minute." },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (mongoose.connection.readyState !== 1)
      return res
        .status(503)
        .json({
          error:
            "Database temporarily unavailable. Nothing has been saved. Please retry.",
        });
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  app.post(
    "/api/auth/register",
    authLimit,
    wrap(async (req, res) => {
      const name = clean(req.body.name, 2, 50, "Name"),
        email = clean(req.body.email, 5, 254, "Email").toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) fail("Enter a valid email.");
      if (
        (process.env.ADMIN_EMAILS || "")
          .toLowerCase()
          .split(",")
          .map((x) => x.trim())
          .includes(email)
      )
        fail("This account must be created by the server administrator.", 403);
      const password = req.body.password;
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        Buffer.byteLength(password) > 72
      )
        fail("Password must be at least 8 characters and at most 72 bytes.");
      const user = await User.create({
        name,
        email,
        password: await bcrypt.hash(password, 12),
      });
      res.status(201).json({ user: safeUser(user), token: tokenFor(user) });
    }),
  );
  app.post(
    "/api/auth/login",
    authLimit,
    wrap(async (req, res) => {
      const email = clean(req.body.email, 5, 254, "Email").toLowerCase();
      if (
        typeof req.body.password !== "string" ||
        Buffer.byteLength(req.body.password) > 72
      )
        fail("Invalid email or password.", 401);
      const user = await User.findOne({ email });
      const hash =
        user?.password ||
        "$2b$12$yWX6EvYeZWRp03YP7mSzIuGeDhptNZ2R58YV5.I5xYjVxX8DHVfXK";
      const ok = await bcrypt.compare(req.body.password, hash);
      if (!user || !ok) fail("Invalid email or password.", 401);
      res.json({ user: safeUser(user), token: tokenFor(user) });
    }),
  );
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: safeUser(req.user) }),
  );
  app.post(
    "/api/auth/logout",
    auth,
    wrap(async (req, res) => {
      await User.updateOne(
        { _id: req.user._id },
        { $inc: { sessionVersion: 1 } },
      );
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/auth/password",
    auth,
    wrap(async (req, res) => {
      const p = req.body.password;
      if (typeof p !== "string" || p.length < 8 || Buffer.byteLength(p) > 72)
        fail("New password must be 8–72 bytes.");
      if (
        typeof req.body.currentPassword !== "string" ||
        !(await bcrypt.compare(req.body.currentPassword, req.user.password))
      )
        fail("Current password is incorrect.", 401);
      req.user.password = await bcrypt.hash(p, 12);
      req.user.sessionVersion++;
      await req.user.save();
      res.json({ token: tokenFor(req.user) });
    }),
  );
  app.get(
    "/api/catalog",
    wrap(async (req, res) => {
      const [players, matches, settings] = await Promise.all([
        Player.find().sort({ name: 1 }).lean(),
        Match.find().sort({ startTime: 1 }).lean(),
        Settings.findById("main").lean(),
      ]);
      res.json({
        players,
        matches,
        settings,
        phase: phaseAt(settings),
        serverTime: new Date(),
      });
    }),
  );
  app.get(
    "/api/squad",
    auth,
    wrap(async (req, res) => {
      const squad = await Squad.findOne({ userId: req.user._id }).lean();
      res.json({ squad });
    }),
  );
  app.put(
    "/api/squad",
    auth,
    rateLimit({
      windowMs: 60000,
      limit: 30,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Please wait a minute before saving again." },
    }),
    wrap(async (req, res) => {
      const [settings, pool, old] = await Promise.all([
        Settings.findById("main").lean(),
        Player.find().lean(),
        Squad.findOne({ userId: req.user._id }).lean(),
      ]);
      validateSquad(req.body, pool);
      const phase = phaseAt(settings);
      if (phase === "ended")
        fail("The tournament has ended. Teams are read-only.", 423);
      if (
        !Number.isInteger(req.body.revision) ||
        req.body.revision !== (old?.revision || 0)
      )
        fail("Your team changed in another tab. Reload before saving.", 409);
      if (old?.history?.length >= 5000)
        fail("Team history limit reached. Contact the organiser.", 409);
      const cost = transferCost(old?.players, req.body.players);
      const field = phase === "knockout" ? "usedKnockout" : "usedGroup";
      const charged = ["group", "knockout"].includes(phase) ? cost : 0;
      if (
        charged + (old?.[field] || 0) >
        (phase === "knockout"
          ? settings.knockoutTransfers
          : settings.groupTransfers)
      )
        fail("Not enough transfers remaining.");
      const now = new Date();
      const next = await Match.findOne({ startTime: { $gt: now } })
        .sort({ startTime: 1 })
        .lean();
      const boundary = [
        next?.startTime,
        settings.startsAt,
        settings.knockoutResetAt,
        settings.knockoutStartAt,
        settings.endsAt,
      ]
        .filter((t) => t && new Date(t) > now)
        .map((t) => new Date(t))
        .sort((a, b) => a - b)[0];
      const revision = (old?.revision || 0) + 1;
      const data = {
        players: req.body.players,
        captainId: req.body.captainId,
        viceCaptainId: req.body.viceCaptainId,
        teamName: req.body.teamName.trim(),
      };
      // A single document write atomically commits the team, revision, transfer debit, and history.
      const filter = { userId: req.user._id, revision: old?.revision || 0 };
      if (boundary) filter.$expr = { $lt: ["$$NOW", boundary] };
      const version = { ...data, revision, transfers: charged, phase };
      let result;
      if (!old) {
        // Unique user index prevents simultaneous first submissions.
        if (boundary && new Date() >= boundary)
          fail("Deadline changed. Reload and retry.", 409);
        result = await Squad.create({
          ...data,
          userId: req.user._id,
          revision,
          history: [{ ...version, savedAt: new Date() }],
        });
      } else {
        result = await Squad.findOneAndUpdate(
          filter,
          [
            {
              $set: {
                ...Object.fromEntries(
                  Object.entries(data).map(([k, v]) => [k, { $literal: v }]),
                ),
                revision,
                [field]: { $add: [{ $ifNull: [`$${field}`, 0] }, charged] },
                history: {
                  $concatArrays: [
                    "$history",
                    [
                      {
                        ...Object.fromEntries(
                          Object.entries(version).map(([k, v]) => [
                            k,
                            { $literal: v },
                          ]),
                        ),
                        savedAt: "$$NOW",
                      },
                    ],
                  ],
                },
                updatedAt: "$$NOW",
              },
            },
          ],
          { new: true },
        );
        if (!result)
          fail("Team or deadline changed. Reload before saving.", 409);
      }
      res.json({ squad: result });
    }),
  );
  app.get(
    "/api/matches/:id/team",
    auth,
    wrap(async (req, res) => {
      const match = await Match.findById(objectId(req.params.id)).lean();
      if (!match) fail("Match not found.", 404);
      const squad = await Squad.findOne({ userId: req.user._id }).lean();
      const version = versionAt(squad || {}, match.startTime);
      const totalPoints =
        match.status === "ABANDONED"
          ? 0
          : match.scoreVersion && version
            ? scoring.calculateUserTeamPoints(version, match.playerPoints)
            : null;
      res.json({
        team: version || null,
        totalPoints,
        locked: match.isLocked || new Date() >= match.startTime,
      });
    }),
  );
  async function standings(req) {
    const page = Math.max(1, Math.min(10000, parseInt(req.query.page) || 1));
    let memberFilter = {};
    if (req.query.league) {
      const league = await League.findOne({
        code: String(req.query.league).toUpperCase(),
        members: req.user._id,
      }).lean();
      if (!league) fail("League not found or membership required.", 404);
      memberFilter = { userId: { $in: league.members } };
    }
    const published = await Match.find(
      { scoreVersion: { $exists: true }, status: { $ne: "ABANDONED" } },
      { _id: 1, scoreVersion: 1 },
    ).lean();
    const clauses = published.map((m) => ({
      matchId: m._id,
      scoreVersion: m.scoreVersion,
    }));
    const pipeline = [
      {
        $match: {
          ...memberFilter,
          ...(clauses.length ? { $or: clauses } : { _id: null }),
        },
      },
      { $group: { _id: "$userId", totalPoints: { $sum: "$totalPoints" } } },
      { $sort: { totalPoints: -1, _id: 1 } },
      {
        $facet: {
          count: [{ $count: "total" }],
          rows: [
            { $skip: (page - 1) * 50 },
            { $limit: 50 },
            {
              $lookup: {
                from: Squad.collection.name,
                localField: "_id",
                foreignField: "userId",
                as: "squad",
              },
            },
            {
              $project: {
                _id: 0,
                userId: "$_id",
                totalPoints: 1,
                teamName: { $arrayElemAt: ["$squad.teamName", 0] },
              },
            },
          ],
        },
      },
    ];
    const [data] = await Entry.aggregate(pipeline);
    return { rows: data.rows, page, total: data.count[0]?.total || 0 };
  }
  app.get(
    "/api/leaderboard",
    wrap(async (req, res) => {
      if (req.query.league) fail("Use your private league leaderboard.", 401);
      res.json(await standings(req));
    }),
  );
  app.get(
    "/api/leagues/leaderboard",
    auth,
    wrap(async (req, res) => res.json(await standings(req))),
  );
  app.get(
    "/api/leagues",
    auth,
    wrap(async (req, res) =>
      res.json({
        leagues: await League.find({ members: req.user._id })
          .select("name code owner")
          .lean(),
      }),
    ),
  );
  app.post(
    "/api/leagues",
    auth,
    wrap(async (req, res) => {
      if ((await League.countDocuments({ owner: req.user._id })) >= 10)
        fail("You can create up to 10 leagues.");
      const league = await League.create({
        name: clean(req.body.name, 2, 60, "League name"),
        code: randomBytes(6).toString("hex").toUpperCase(),
        owner: req.user._id,
        members: [req.user._id],
      });
      res
        .status(201)
        .json({ league: { name: league.name, code: league.code } });
    }),
  );
  app.post(
    "/api/leagues/join",
    auth,
    wrap(async (req, res) => {
      const code = clean(req.body.code, 12, 12, "Invite code").toUpperCase();
      const league = await League.findOneAndUpdate(
        { code },
        { $addToSet: { members: req.user._id } },
        { new: true },
      );
      if (!league) fail("Invite code not found.", 404);
      res.json({ league: { name: league.name, code: league.code } });
    }),
  );
  app.use("/api/admin", auth, admin);
  app.put(
    "/api/admin/settings",
    wrap(async (req, res) => {
      const previous = await Settings.findById("main");
      if (previous.startsAt && new Date() >= previous.startsAt)
        fail("Tournament rules cannot change after play starts.", 409);
      const data = validateSettings(req.body);
      await Settings.updateOne({ _id: "main" }, { $set: data });
      res.json({ success: true });
    }),
  );
  app.put(
    "/api/admin/roster",
    wrap(async (req, res) => {
      const settings = await Settings.findById("main");
      if (settings.startsAt && new Date() >= settings.startsAt)
        fail("Roles and prices are fixed after the tournament starts.", 409);
      if (
        !Array.isArray(req.body.players) ||
        !req.body.players.length ||
        req.body.players.length > 500
      )
        fail("Provide 1–500 players.");
      const ids = new Set();
      const players = req.body.players.map((p) => {
        if (
          typeof p._id !== "string" ||
          !/^[A-Za-z0-9_-]{2,50}$/.test(p._id) ||
          ids.has(p._id)
        )
          fail("Use unique stable player IDs.");
        ids.add(p._id);
        if (
          !["WK", "BAT", "ALL", "BOWL"].includes(p.role) ||
          !Number.isFinite(p.credits) ||
          p.credits < 3.5 ||
          p.credits > 15 ||
          Math.round(p.credits * 10) !== p.credits * 10
        )
          fail("Invalid role or credit value.");
        return {
          _id: p._id,
          name: clean(p.name, 2, 100, "Player name"),
          teamCode: clean(p.teamCode, 2, 4, "Country code").toUpperCase(),
          role: p.role,
          credits: p.credits,
          active: p.active !== false,
        };
      });
      // Add/update only: omitted players are preserved; retire them via availability.
      await Player.bulkWrite(
        players.map((p) => ({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: p },
            upsert: true,
          },
        })),
      );
      res.json({ success: true });
    }),
  );
  app.put(
    "/api/admin/players/:id",
    wrap(async (req, res) => {
      const old = await Player.findById(req.params.id);
      if (!old) fail("Player not found.", 404);
      const { active } = req.body;
      if (typeof active !== "boolean") fail("active must be true or false.");
      old.active = active;
      await old.save();
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/admin/matches",
    wrap(async (req, res) => {
      const b = req.body;
      const startTime = new Date(b.startTime);
      if (Number.isNaN(startTime.getTime()) || startTime <= new Date())
        fail("Use a future start time.");
      const teams = await Player.distinct("teamCode");
      if (
        !teams.includes(b.teamA) ||
        !teams.includes(b.teamB) ||
        b.teamA === b.teamB
      )
        fail("Choose two different countries.");
      const settings = await Settings.findById("main");
      if (settings.startsAt && startTime < settings.startsAt)
        fail("Match cannot start before the tournament.");
      const match = await Match.create({
        title: clean(b.title, 3, 100, "Match title"),
        teamA: b.teamA,
        teamB: b.teamB,
        stage: b.stage,
        startTime,
        venue: clean(b.venue, 2, 100, "Venue"),
        isSample: b.isSample !== false,
      });
      res.status(201).json({ match });
    }),
  );
  app.put(
    "/api/admin/matches/:id",
    wrap(async (req, res) => {
      const match = await Match.findById(objectId(req.params.id));
      if (!match) fail("Match not found.", 404);
      if (
        !["UPCOMING", "LIVE", "COMPLETED", "ABANDONED"].includes(
          req.body.status,
        )
      )
        fail("Invalid match status.");
      if (
        new Date() < match.startTime &&
        ["LIVE", "COMPLETED"].includes(req.body.status)
      )
        fail("Match has not reached its deadline.");
      match.status = req.body.status;
      await match.save();
      res.json({ match });
    }),
  );
  app.post(
    "/api/admin/matches/:id/scores",
    wrap(async (req, res) => {
      const match = await Match.findById(objectId(req.params.id));
      if (!match) fail("Match not found.", 404);
      if (new Date() < match.startTime)
        fail("Scoring is disabled before the deadline.");
      if (match.status === "ABANDONED") fail("Abandoned matches do not score.");
      const stats = req.body.stats;
      if (
        !stats ||
        typeof stats !== "object" ||
        Array.isArray(stats) ||
        Object.keys(stats).length > 40
      )
        fail("Provide a player-ID keyed stats object.");
      const source = clean(req.body.source, 3, 200, "Score source");
      const pool = await Player.find({
        teamCode: { $in: [match.teamA, match.teamB] },
      }).lean();
      const points = {};
      const numeric = [
        "runs",
        "ballsFaced",
        "fours",
        "sixes",
        "wickets",
        "lbwBowledCount",
        "maidenOvers",
        "ballsBowled",
        "runsConceded",
        "catches",
        "stumpings",
        "runOutDirect",
        "runOutIndirect",
      ];
      for (const [id, s] of Object.entries(stats)) {
        const p = pool.find((p) => p._id === id);
        if (!p || !s || typeof s !== "object")
          fail(`Invalid score player: ${id}`);
        for (const [k, v] of Object.entries(s)) {
          if (numeric.includes(k)) {
            if (!Number.isInteger(v) || v < 0 || v > 2000)
              fail(`Invalid ${k} for ${id}`);
          } else if (["isPlayingXI", "isDismissed"].includes(k)) {
            if (typeof v !== "boolean") fail(`Invalid ${k}`);
          } else fail(`Unsupported stat: ${k}`);
        }
        if ((s.lbwBowledCount || 0) > (s.wickets || 0))
          fail("Bowled/LBW wickets exceed total wickets.");
        points[id] = scoring.calculatePlayerPoints(s, p.role).totalPoints;
      }
      const scoreVersion = randomUUID();
      let batch = [];
      const cursor = Squad.find({ "history.savedAt": { $lt: match.startTime } })
        .lean()
        .cursor();
      for await (const squad of cursor) {
        const v = versionAt(squad, match.startTime);
        if (!v) continue;
        batch.push({
          insertOne: {
            document: {
              matchId: match._id,
              userId: squad.userId,
              scoreVersion,
              teamName: v.teamName,
              players: v.players,
              captainId: v.captainId,
              viceCaptainId: v.viceCaptainId,
              totalPoints: scoring.calculateUserTeamPoints(v, points),
            },
          },
        });
        if (batch.length === 200) {
          await Entry.bulkWrite(batch);
          batch = [];
        }
      }
      if (batch.length) await Entry.bulkWrite(batch);
      // Publish only after all entries are durable. Retry/correction replaces the active version, never adds points twice.
      await Match.updateOne(
        { _id: match._id },
        {
          $set: {
            scoreVersion,
            playerPoints: points,
            scoreUpdatedAt: new Date(),
            scoreSource: source,
            isLocked: true,
          },
        },
      );
      res.json({ success: true, playersScored: Object.keys(points).length });
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../dist",
  );
  app.use(
    express.static(dist, {
      maxAge: "1h",
      setHeaders: (res, p) => {
        if (p.endsWith(".html")) res.set("Cache-Control", "no-cache");
        else if (p.includes("/assets/"))
          res.set("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
  app.use((err, req, res, _next) => {
    const status =
      err.code === 11000
        ? 409
        : err.status ||
          (["ValidationError", "CastError", "SyntaxError"].includes(err.name)
            ? 400
            : 500);
    if (status === 500) console.error("[API]", err.name, err.message);
    res
      .status(status)
      .json({
        error:
          err.code === 11000
            ? "Account or team already exists. Reload or sign in."
            : status === 500
              ? "Server could not complete the request. Please retry."
              : err.message,
      });
  });
  return app;
}
