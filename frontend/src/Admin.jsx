import React, { useState } from "react";
import { api } from "./api";
export default function Admin({ catalog, onRefresh }) {
  const [settings, setSettings] = useState(
      JSON.stringify(catalog.settings, null, 2),
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [match, setMatch] = useState(catalog.matches[0]?._id || "");
  async function run(path, body, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = await api(path, { method, body });
      setNotice(
        d.playersScored !== undefined
          ? `${d.playersScored} player scores published.`
          : "Saved. Refresh data to view changes.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const countries = [...new Set(catalog.players.map((p) => p.teamCode))].sort();
  return (
    <div className="admin">
      <div className="section-title">
        <h1>Organiser desk</h1>
        <button onClick={onRefresh}>Refresh data</button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="panel">
        <h2>Tournament settings</h2>
        <p className="muted">
          Set confirmed tournament dates in UTC before launch. Rules become
          read-only once the tournament starts. Sample fixtures are clearly
          labelled.
        </p>
        <label>
          Settings JSON
          <textarea
            rows="12"
            value={settings}
            onChange={(e) => setSettings(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => {
            try {
              run("/admin/settings", JSON.parse(settings), "PUT");
            } catch {
              setError("Settings must be valid JSON.");
            }
          }}
        >
          Save settings
        </button>
      </section>
      <section className="panel">
        <h2>Add a match</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const b = Object.fromEntries(new FormData(e.currentTarget));
            b.isSample = b.isSample === "true";
            b.startTime = new Date(b.startTime).toISOString();
            run("/admin/matches", b);
          }}
        >
          <div className="two-columns">
            <label>
              Title
              <input
                name="title"
                required
                maxLength="100"
                placeholder="Pakistan vs India"
              />
            </label>
            <label>
              Venue
              <input name="venue" required maxLength="100" />
            </label>
            <label>
              Team A
              <select name="teamA">
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Team B
              <select name="teamB">
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Start time (your local timezone)
              <input name="startTime" type="datetime-local" required />
            </label>
            <label>
              Stage
              <select name="stage">
                <option>Group</option>
                <option>Super stage</option>
                <option>Knockout</option>
              </select>
            </label>
            <label>
              Data status
              <select name="isSample">
                <option value="true">Practice / unverified</option>
                <option value="false">Verified fixture</option>
              </select>
            </label>
          </div>
          <button disabled={busy}>Add match</button>
        </form>
      </section>
      <section className="panel">
        <h2>Publish scorecard</h2>
        <p className="muted">
          Use verified full cumulative player statistics. Each publish replaces
          this match's previous scorecard. Omitted players score zero. No
          automatic live-data provider is connected.
        </p>
        <label>
          Match
          <select value={match} onChange={(e) => setMatch(e.target.value)}>
            {catalog.matches.map((m) => (
              <option key={m._id} value={m._id}>
                {m.title} · {new Date(m.startTime).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            try {
              run(`/admin/matches/${match}/scores`, {
                source: f.source,
                stats: JSON.parse(f.stats),
              });
            } catch {
              setError("Stats must be valid JSON.");
            }
          }}
        >
          <label>
            Verified source/reference
            <input
              name="source"
              required
              maxLength="200"
              placeholder="Official scorecard URL or internal reference"
            />
          </label>
          <label>
            Complete stats JSON
            <textarea
              name="stats"
              required
              rows="10"
              placeholder={
                '{"PAK_01":{"runs":50,"ballsFaced":45,"fours":4,"sixes":2,"isPlayingXI":true}}'
              }
            />
          </label>
          <button disabled={busy || !match}>Publish scorecard</button>
        </form>
        <div className="row" style={{ marginTop: 20 }}>
          {["LIVE", "COMPLETED", "ABANDONED"].map((status) => (
            <button
              key={status}
              disabled={busy || !match}
              onClick={() => run(`/admin/matches/${match}`, { status }, "PUT")}
            >
              Mark {status.toLowerCase()}
            </button>
          ))}
        </div>
        <details>
          <summary>Player IDs for scorecards</summary>
          <pre>
            {catalog.players
              .map((p) => `${p._id} — ${p.name} (${p.teamCode})`)
              .join("\n")}
          </pre>
        </details>
      </section>
      <section className="panel">
        <h2>Import verified roster</h2>
        <p className="muted">
          Add or update players before the tournament begins. Keep player IDs
          stable. Omitted players are preserved. Retire replacements using
          availability.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              run(
                "/admin/roster",
                {
                  players: JSON.parse(
                    new FormData(e.currentTarget).get("players"),
                  ),
                },
                "PUT",
              );
            } catch {
              setError("Roster must be valid JSON.");
            }
          }}
        >
          <label>
            Player array
            <textarea
              name="players"
              required
              placeholder={
                '[{"_id":"PAK_01","name":"Player name","teamCode":"PAK","role":"BAT","credits":9,"active":true}]'
              }
            />
          </label>
          <button disabled={busy}>Import roster</button>
        </form>
      </section>
      <section className="panel">
        <h2>Player availability</h2>
        <p className="muted">
          Deactivate withdrawn players to stop new selection. Existing
          historical teams keep them.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            run(
              `/admin/players/${f.id}`,
              { active: f.active === "true" },
              "PUT",
            );
          }}
        >
          <label>
            Player
            <select name="id">
              {catalog.players.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} · {p.teamCode} {p.active ? "" : "(inactive)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="active">
              <option value="false">Unavailable</option>
              <option value="true">Available</option>
            </select>
          </label>
          <button disabled={busy}>Update availability</button>
        </form>
      </section>
    </div>
  );
}
