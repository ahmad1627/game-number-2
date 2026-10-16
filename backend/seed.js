import "dotenv/config";
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import { Player, Match, initModels } from "./models.js";

export async function seedData() {
  const data = JSON.parse(
    await readFile(new URL("./sample-data.json", import.meta.url)),
  );
  for (const team of data.teams)
    for (const p of team.players)
      await Player.updateOne(
        { _id: p.externalApiId },
        {
          $setOnInsert: {
            _id: p.externalApiId,
            name: p.name,
            role: p.role,
            credits: p.credits,
            teamCode: team.shortCode,
            active: true,
          },
        },
        { upsert: true },
      );
  if ((await Match.countDocuments()) === 0) {
    for (const [i, pair] of [
      ["PAK", "IND"],
      ["AUS", "ENG"],
      ["SA", "NZ"],
    ].entries())
      await Match.create({
        title: `${pair[0]} vs ${pair[1]}`,
        teamA: pair[0],
        teamB: pair[1],
        venue: "Practice fixture • venue unconfirmed",
        startTime: new Date(Date.now() + (i + 7) * 86400000),
        isSample: true,
      });
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("backend/seed.js")) {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI first.");
  await mongoose.connect(process.env.MONGODB_URI);
  await initModels();
  await seedData();
  console.log(
    "Practice data loaded. Existing players, matches and user teams were preserved.",
  );
  await mongoose.disconnect();
}
