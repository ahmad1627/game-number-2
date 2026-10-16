import mongoose from "mongoose";
const { Schema } = mongoose;
const model = (name, schema) =>
  mongoose.models[name] || mongoose.model(name, schema);
export const User = model(
  "User",
  new Schema(
    {
      name: { type: String, required: true, maxlength: 50 },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      sessionVersion: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);
export const Player = model(
  "FantasyPlayer",
  new Schema({
    _id: String,
    name: String,
    teamCode: String,
    role: String,
    credits: Number,
    active: { type: Boolean, default: true },
  }),
);
const version = new Schema(
  {
    revision: Number,
    savedAt: Date,
    players: [String],
    captainId: String,
    viceCaptainId: String,
    teamName: String,
    transfers: Number,
    phase: String,
  },
  { _id: false },
);
const squadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, unique: true, required: true },
    revision: { type: Number, default: 0 },
    teamName: String,
    players: [String],
    captainId: String,
    viceCaptainId: String,
    usedGroup: { type: Number, default: 0 },
    usedKnockout: { type: Number, default: 0 },
    history: [version],
  },
  { timestamps: true },
);
export const Squad = model("SeasonSquad", squadSchema);
export const Match = model(
  "FantasyMatch",
  new Schema(
    {
      title: { type: String, required: true, maxlength: 100 },
      teamA: String,
      teamB: String,
      startTime: { type: Date, required: true, index: true },
      stage: {
        type: String,
        enum: ["Group", "Super stage", "Knockout"],
        default: "Group",
      },
      venue: String,
      status: {
        type: String,
        enum: ["UPCOMING", "LIVE", "COMPLETED", "ABANDONED"],
        default: "UPCOMING",
      },
      isLocked: { type: Boolean, default: false },
      isSample: { type: Boolean, default: true },
      scoreVersion: String,
      scoreUpdatedAt: Date,
      playerPoints: { type: Schema.Types.Mixed, default: {} },
      scoreSource: String,
    },
    { timestamps: true },
  ),
);
const entrySchema = new Schema({
  matchId: { type: Schema.Types.ObjectId, index: true },
  userId: { type: Schema.Types.ObjectId, index: true },
  scoreVersion: String,
  teamName: String,
  totalPoints: Number,
  players: [String],
  captainId: String,
  viceCaptainId: String,
});
entrySchema.index({ matchId: 1, scoreVersion: 1, userId: 1 }, { unique: true });
export const Entry = model("FantasyEntry", entrySchema);
export const League = model(
  "PrivateLeague",
  new Schema(
    {
      name: { type: String, maxlength: 60 },
      code: { type: String, unique: true },
      owner: Schema.Types.ObjectId,
      members: [Schema.Types.ObjectId],
    },
    { timestamps: true },
  ),
);
export const Settings = model(
  "FantasySettings",
  new Schema({
    _id: { type: String, default: "main" },
    title: { type: String, default: "World Cup 2027" },
    startsAt: { type: Date, default: null },
    knockoutResetAt: { type: Date, default: null },
    knockoutStartAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    groupTransfers: { type: Number, default: 135 },
    knockoutTransfers: { type: Number, default: 10 },
    dataLabel: {
      type: String,
      default: "Practice data • squads and fixtures are unverified",
    },
    ruleLabel: {
      type: String,
      default: "Independent 2023-based preset; not official 2027 rules",
    },
  }),
);
export async function initModels() {
  await Promise.all(
    [User, Player, Squad, Match, Entry, League, Settings].map((m) => m.init()),
  );
  await Settings.updateOne(
    { _id: "main" },
    { $setOnInsert: { _id: "main" } },
    { upsert: true },
  );
}
