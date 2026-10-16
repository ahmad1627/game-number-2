import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import { api, storage } from "./api";
import "./style.css";
const Admin = lazy(() => import("./Admin.jsx"));
const roles = { WK: [1, 4], BAT: [3, 6], ALL: [1, 4], BOWL: [3, 6] };
const labels = {
  WK: "Keepers",
  BAT: "Batters",
  ALL: "All-rounders",
  BOWL: "Bowlers",
};
const date = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
function Icon({ name }) {
  const paths = {
    home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
    team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    cup: "M8 21h8M12 17v4M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4",
    calendar: "M3 6h18v15H3ZM7 3v6M17 3v6M3 11h18",
    arrow: "m5 12 14 0m-6-6 6 6-6 6",
    search: "M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    check: "m5 12 4 4 10-10",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.team} />
    </svg>
  );
}
class Boundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="wrap">
        <h1>Something didn’t load.</h1>
        <p>Your saved team is stored on the server.</p>
        <button onClick={() => location.reload()}>Reload page</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Modal({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    const prior = document.activeElement;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("button,input")?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = [
          ...ref.current.querySelectorAll(
            "button:not(:disabled),input,select,a,textarea",
          ),
        ];
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="between">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Auth({ onClose, onSuccess }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={register ? "Join the game" : "Welcome back"}
      onClose={onClose}
    >
      <p className="muted">One account. Your XI, saved across devices.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const data = await api(`/auth/${register ? "register" : "login"}`, {
              method: "POST",
              body: values,
            });
            storage.set("fantasy-token", data.token);
            onSuccess(data.user);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              minLength="2"
              maxLength="50"
            />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 8 : 1}
            maxLength="72"
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        className="text-btn wide"
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register
          ? "Already a member? Sign in"
          : "New here? Create a free account"}
      </button>
    </Modal>
  );
}
function Pitch({ players, captainId, viceCaptainId }) {
  return (
    <div className="pitch">
      <div className="pitch-circle" />
      {Object.keys(roles).map((role) => (
        <div className="pitch-row" key={role}>
          <span>{labels[role]}</span>
          <div>
            {players
              .filter((p) => p.role === role)
              .map((p) => (
                <div className="pitch-player" key={p._id}>
                  <div className="jersey">
                    {p.name
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                    {captainId === p._id ? (
                      <b>C</b>
                    ) : viceCaptainId === p._id ? (
                      <b>VC</b>
                    ) : null}
                  </div>
                  <strong>{p.name.split(" ").slice(-1)}</strong>
                  <small>
                    {p.teamCode} · {p.credits.toFixed(1)}
                  </small>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function Builder({ catalog, squad, user, onSaved, onClose }) {
  const key = `draft-${user._id}`;
  const initial = () => {
    try {
      const draft = JSON.parse(storage.get(key));
      if (draft?.revision === (squad?.revision || 0)) return draft;
    } catch {}
    return {
      players: squad?.players || [],
      captainId: squad?.captainId || "",
      viceCaptainId: squad?.viceCaptainId || "",
      teamName: squad?.teamName || `${user.name.split(" ")[0]}'s XI`,
      revision: squad?.revision || 0,
    };
  };
  const [draft, setDraft] = useState(initial),
    [role, setRole] = useState("WK"),
    [query, setQuery] = useState(""),
    [country, setCountry] = useState("ALL"),
    [sort, setSort] = useState("name"),
    [onlySelected, setOnlySelected] = useState(false),
    [step, setStep] = useState("players"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const selected = useMemo(
    () =>
      draft.players
        .map((id) => catalog.players.find((p) => p._id === id))
        .filter(Boolean),
    [draft.players, catalog.players],
  );
  const credits = 100 - selected.reduce((n, p) => n + p.credits, 0);
  const count = Object.fromEntries(
    Object.keys(roles).map((r) => [
      r,
      selected.filter((p) => p.role === r).length,
    ]),
  );
  useEffect(() => {
    storage.set(key, JSON.stringify(draft));
  }, [draft, key]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const list = useMemo(
    () =>
      catalog.players
        .filter(
          (p) =>
            (p.active || draft.players.includes(p._id)) &&
            (onlySelected ? draft.players.includes(p._id) : p.role === role) &&
            (country === "ALL" || p.teamCode === country) &&
            p.name.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "credits"
            ? a.credits - b.credits
            : a.name.localeCompare(b.name),
        ),
    [catalog, role, country, query, sort, draft.players, onlySelected],
  );
  const next = catalog.matches.find(
    (m) => new Date(m.startTime) > now && m.status === "UPCOMING",
  );
  const cost = draft.players.filter(
    (p) => squad?.players?.length && !squad.players.includes(p),
  ).length;
  function toggle(p) {
    setError("");
    if (draft.players.includes(p._id)) {
      setDraft((d) => ({
        ...d,
        players: d.players.filter((id) => id !== p._id),
        captainId: d.captainId === p._id ? "" : d.captainId,
        viceCaptainId: d.viceCaptainId === p._id ? "" : d.viceCaptainId,
      }));
      return;
    }
    if (selected.length >= 11)
      return setError("You have 11 players. Remove one to make a swap.");
    if (p.credits > credits)
      return setError("Not enough credits. Try a lower-priced player.");
    if (selected.filter((s) => s.teamCode === p.teamCode).length >= 7)
      return setError("Maximum seven players per country.");
    if (count[p.role] >= roles[p.role][1])
      return setError(
        `Maximum ${roles[p.role][1]} ${labels[p.role].toLowerCase()}.`,
      );
    const needed = Object.entries(roles).reduce(
      (n, [r, [min]]) =>
        n + Math.max(0, min - count[r] - (r === p.role ? 1 : 0)),
      0,
    );
    if (needed > 10 - selected.length)
      return setError(
        "Keep space for at least 1 keeper, 3 batters, 1 all-rounder and 3 bowlers.",
      );
    setDraft((d) => ({ ...d, players: [...d.players, p._id] }));
  }
  return (
    <div className="builder">
      <header className="builder-top">
        <div className="wrap between">
          <div className="row">
            <button
              className="icon-btn"
              onClick={onClose}
              aria-label="Close team builder"
            >
              ←
            </button>
            <div>
              <b>Build your XI</b>
              <small className="block muted">
                Season team ·{" "}
                {next
                  ? `Next deadline ${date(next.startTime)}`
                  : "No deadline announced"}
              </small>
            </div>
          </div>
          <span className="pill">
            {["preseason", "reset"].includes(catalog.phase)
              ? "Unlimited transfers"
              : `${cost} transfer${cost !== 1 ? "s" : ""}`}
          </span>
        </div>
      </header>
      <div className="builder-summary">
        <div className="wrap">
          <div className="between">
            <div>
              <small>PLAYERS</small>
              <strong>
                {selected.length}
                <em> / 11</em>
              </strong>
            </div>
            <div className="budget">
              <small>CREDITS LEFT</small>
              <strong>{credits.toFixed(1)}</strong>
            </div>
          </div>
          <div className="progress">
            {Array.from({ length: 11 }, (_, i) => (
              <i key={i} className={i < selected.length ? "filled" : ""} />
            ))}
          </div>
        </div>
      </div>
      <main className="wrap builder-main">
        <div className="builder-content">
          <div className="segmented">
            <button
              className={step === "players" ? "active" : ""}
              onClick={() => setStep("players")}
            >
              1 · Pick players
            </button>
            <button
              className={step === "captains" ? "active" : ""}
              onClick={() =>
                selected.length === 11
                  ? setStep("captains")
                  : setError("Select 11 players first.")
              }
            >
              2 · Captain & save
            </button>
            <button
              className={step === "preview" ? "active" : ""}
              onClick={() => setStep("preview")}
            >
              Pitch
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {step === "players" ? (
            <>
              <div className="filters">
                <label className="search">
                  <Icon name="search" />
                  <input
                    aria-label="Search players"
                    placeholder="Search a player…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="row">
                  <select
                    aria-label="Filter country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="ALL">All countries</option>
                    {[...new Set(catalog.players.map((p) => p.teamCode))]
                      .sort()
                      .map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                  </select>
                  <select
                    aria-label="Sort players"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="name">Name A–Z</option>
                    <option value="credits">Lowest credits</option>
                  </select>
                  <button
                    className="selected-toggle"
                    aria-pressed={onlySelected}
                    onClick={() => setOnlySelected((v) => !v)}
                  >
                    {onlySelected
                      ? "All players"
                      : `Selected (${selected.length})`}
                  </button>
                </div>
              </div>
              <div className="role-tabs">
                {Object.keys(roles).map((r) => (
                  <button
                    key={r}
                    className={role === r ? "active" : ""}
                    onClick={() => {
                      setRole(r);
                      setOnlySelected(false);
                    }}
                  >
                    {r} <span>{count[r]}</span>
                  </button>
                ))}
              </div>
              <p className="list-hint">
                {onlySelected
                  ? "Your selected XI"
                  : `Choose ${roles[role].join("–")} ${labels[role].toLowerCase()}`}{" "}
                <span>Credits</span>
              </p>
              <div className="player-list">
                {list.length ? (
                  list.map((p) => (
                    <div
                      className={`player-row ${draft.players.includes(p._id) ? "selected" : ""}`}
                      key={p._id}
                    >
                      <div className={`avatar ${p.teamCode.toLowerCase()}`}>
                        {p.teamCode}
                      </div>
                      <div className="player-name">
                        <strong>{p.name}</strong>
                        <small>
                          {p.teamCode} ·{" "}
                          {p.active
                            ? labels[p.role]
                            : "Unavailable — remove to replace"}
                        </small>
                      </div>
                      <b>{p.credits.toFixed(1)}</b>
                      <button
                        className="pick"
                        aria-label={`${draft.players.includes(p._id) ? "Remove" : "Add"} ${p.name}`}
                        aria-pressed={draft.players.includes(p._id)}
                        onClick={() => toggle(p)}
                      >
                        {draft.players.includes(p._id) ? "−" : "+"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty">No players match. Try another search.</p>
                )}
              </div>
            </>
          ) : step === "preview" ? (
            <Pitch players={selected} {...draft} />
          ) : (
            <>
              <label className="team-name">
                Team name
                <input
                  value={draft.teamName}
                  maxLength="30"
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, teamName: e.target.value }))
                  }
                />
              </label>
              <div className="captain-intro">
                <b>Make your leaders count.</b>
                <p>Captain earns 2× points. Vice-captain earns 1.5×.</p>
              </div>
              {selected.map((p) => (
                <div key={p._id} className="player-row">
                  <div className="avatar">{p.teamCode}</div>
                  <div className="player-name">
                    <strong>{p.name}</strong>
                    <small>{p.role}</small>
                  </div>
                  <button
                    aria-label={`Captain ${p.name}`}
                    aria-pressed={draft.captainId === p._id}
                    className={`captain-btn ${draft.captainId === p._id ? "chosen" : ""}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        captainId: p._id,
                        viceCaptainId:
                          d.viceCaptainId === p._id ? "" : d.viceCaptainId,
                      }))
                    }
                  >
                    C
                  </button>
                  <button
                    aria-label={`Vice captain ${p.name}`}
                    aria-pressed={draft.viceCaptainId === p._id}
                    className={`captain-btn ${draft.viceCaptainId === p._id ? "chosen" : ""}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        viceCaptainId: p._id,
                        captainId: d.captainId === p._id ? "" : d.captainId,
                      }))
                    }
                  >
                    VC
                  </button>
                </div>
              ))}
              <p className="muted">
                {["preseason", "reset"].includes(catalog.phase)
                  ? "These changes use no transfers."
                  : `This save uses ${cost} transfers. Captain changes are free.`}{" "}
                Earlier match teams stay locked.
              </p>
            </>
          )}
        </div>
        <aside className="builder-aside">
          <div className="between">
            <h3>Your team</h3>
            <span className="muted">Live preview</span>
          </div>
          <Pitch players={selected} {...draft} />
          <p className="muted">
            Your unsaved draft stays on this device. Tap Save team to sync it to
            your account.
          </p>
        </aside>
      </main>
      <footer className="builder-actions">
        <div className="wrap between">
          <span>
            <b>{selected.length} of 11</b>
            <small className="block muted">
              {step === "captains"
                ? "Review your captain choices"
                : "One team. Every match."}
            </small>
          </span>
          {step === "captains" ? (
            <button
              className="primary"
              disabled={
                busy ||
                selected.length !== 11 ||
                !draft.captainId ||
                !draft.viceCaptainId
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const data = await api("/squad", {
                    method: "PUT",
                    body: draft,
                  });
                  storage.remove(key);
                  onSaved(data.squad);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save team"} <Icon name="check" />
            </button>
          ) : (
            <button
              className="primary"
              disabled={selected.length !== 11}
              onClick={() => setStep("captains")}
            >
              Choose captains <Icon name="arrow" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
function Rules() {
  return (
    <section className="panel prose">
      <span className="eyebrow">KNOW THE GAME</span>
      <h2>Simple rules. Fair competition.</h2>
      <p>
        This is an independent, free-to-play season game. There are no cash
        deposits, withdrawals or entry fees.
      </p>
      <h3>Your team</h3>
      <p>
        Pick 11 players for up to 100 credits, with a maximum of 7 from one
        country. Choose 1–4 keepers, 3–6 batters, 1–4 all-rounders and 3–6
        bowlers. Captain scores 2×; vice-captain scores 1.5×.
      </p>
      <h3>Transfers & deadlines</h3>
      <p>
        Your XI carries forward automatically. Changes saved before a match
        starts count for that match; later changes count only for future
        matches. Unlimited preseason changes. The default preset has 135 group
        transfers, a separately scheduled unlimited knockout reset, and 10
        knockout transfers. Unused group transfers do not carry over. Replacing
        a player costs one transfer; changing captains or team name costs none.
        A new team's first XI costs no transfers and earns no points for missed
        matches.
      </p>
      <p>
        This preset draws on the ICC 2023 game. It is not an official 2027
        ruleset and does not reproduce the ICC booster game. The organiser must
        publish dates and rules before play starts.
      </p>
      <h3>Scoring · site preset v1</h3>
      <p>
        Starting XI +4; run +1; four bonus +1; six bonus +2; 50 runs +4 or 100
        runs +8; dismissed duck −2 except bowlers. Wicket +25 excluding
        run-outs; bowled/LBW +8; four wickets +4 or five wickets +8; maiden +4.
        Catch +8, with +4 for three or more; stumping/direct run-out +12;
        assisted run-out +6.
      </p>
      <p>
        At least 20 balls faced, except bowlers: strike rate above 140 +6; above
        120 to 140 +4; 100 to 120 +2; 50–60 −2; 40 to under 50 −4; below 40 −6.
        At least 30 legal balls bowled: economy below 3.5 +6; 3.5 to under 4.5
        +4; 4.5–5.5 +2; above 7 to 8 −2; above 8 to 9 −4; above 9 −6. Other
        bands score zero.
      </p>
      <h3>Results & privacy</h3>
      <p>
        Only published administrator scorecards create points. Abandoned matches
        score zero. Corrections replace previous points. Leaderboard positions
        sort by points, then stable account ID for ties; ties have no prize
        significance here. Public standings show team names and points, never
        email addresses. Private league standings require membership. Keep
        personal details out of team names.
      </p>
      <p>
        Accounts store your name, email, hashed password and squad history. Your
        token and unsaved draft are stored in this browser. Log out on shared
        devices. Contact the organiser for account recovery or deletion;
        automated email recovery is not configured.
      </p>
    </section>
  );
}
function Leaderboard({ leagueCode = "" }) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setData(null);
    api(
      leagueCode
        ? `/leagues/leaderboard?league=${encodeURIComponent(leagueCode)}&page=${page}`
        : `/leaderboard?page=${page}`,
    )
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [page, leagueCode]);
  return (
    <section className="panel">
      <div className="between">
        <h2>{leagueCode ? "League standings" : "The leaderboard"}</h2>
        <span className="pill">Season points</span>
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !data ? (
        <p className="empty">Loading standings…</p>
      ) : !data.rows.length ? (
        <div className="empty">
          <Icon name="cup" />
          <h3>The first points are still to come.</h3>
          <p>Rankings appear after a match scorecard is published.</p>
        </div>
      ) : (
        <>
          <div className="rank-row rank-head">
            <span>Rank</span>
            <span>Team</span>
            <span>Points</span>
          </div>
          {data.rows.map((row, i) => (
            <div className="rank-row" key={row.userId}>
              <b>{(page - 1) * 50 + i + 1}</b>
              <strong>{row.teamName}</strong>
              <b>{row.totalPoints}</b>
            </div>
          ))}
          <div className="between">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * 50 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
function Leagues() {
  const [leagues, setLeagues] = useState([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api("/leagues")
      .then((d) => setLeagues(d.leagues))
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []);
  async function submit(e, join) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = e.currentTarget;
    try {
      const data = await api(`/leagues${join ? "/join" : ""}`, {
        method: "POST",
        body: Object.fromEntries(new FormData(f)),
      });
      await refresh();
      setSelected(data.league.code);
      f.reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <span className="eyebrow">BETTER WITH FRIENDS</span>
        <h2>Your own little rivalry.</h2>
        <p className="muted">
          Create a private league and share its invite code.
        </p>
        <div className="two-columns">
          <form onSubmit={(e) => submit(e, false)}>
            <label>
              New league name
              <input
                name="name"
                required
                minLength="2"
                maxLength="60"
                placeholder="Lahore Cricket Club"
              />
            </label>
            <button className="primary" disabled={busy}>
              Create league
            </button>
          </form>
          <form onSubmit={(e) => submit(e, true)}>
            <label>
              Invite code
              <input
                name="code"
                required
                minLength="12"
                maxLength="12"
                placeholder="Enter 12-character code"
              />
            </label>
            <button disabled={busy}>Join league</button>
          </form>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="league-list">
          {leagues.map((l) => (
            <button
              key={l.code}
              className={selected === l.code ? "selected-league" : ""}
              onClick={() => setSelected(l.code)}
            >
              <b>{l.name}</b>
              <small className="block">Invite: {l.code}</small>
            </button>
          ))}
        </div>
      </section>
      {selected && <Leaderboard key={selected} leagueCode={selected} />}
    </>
  );
}
function App() {
  const [catalog, setCatalog] = useState(null),
    [user, setUser] = useState(null),
    [squad, setSquad] = useState(null),
    [view, setView] = useState("Home"),
    [authOpen, setAuthOpen] = useState(false),
    [builder, setBuilder] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [matchDetail, setMatchDetail] = useState(null),
    [account, setAccount] = useState(false);
  async function load() {
    setError("");
    setLoading(true);
    try {
      const c = await api("/catalog");
      setCatalog(c);
      if (storage.get("fantasy-token")) {
        try {
          const me = await api("/auth/me");
          setUser(me.user);
          const s = await api("/squad");
          setSquad(s.squad);
        } catch (e) {
          if (e.status === 401) {
            storage.remove("fantasy-token");
            setUser(null);
            setSquad(null);
          } else throw e;
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  async function login(u) {
    setUser(u);
    setAuthOpen(false);
    setSquad(null);
    try {
      const s = await api("/squad");
      setSquad(s.squad);
      setNotice("Signed in. Your saved team is ready.");
      setView("My XI");
    } catch (e) {
      setError(e.message);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    storage.remove("fantasy-token");
    if (user) storage.remove(`draft-${user._id}`);
    setUser(null);
    setSquad(null);
    setAccount(false);
    setView("Home");
  }
  const selected =
    catalog?.players.filter((p) => squad?.players.includes(p._id)) || [];
  const next = catalog?.matches.find(
    (m) => new Date(m.startTime) > new Date() && m.status === "UPCOMING",
  );
  const openBuilder = async () => {
    if (!user) return setAuthOpen(true);
    try {
      const [c, s] = await Promise.all([api("/catalog"), api("/squad")]);
      setCatalog(c);
      setSquad(s.squad);
      setBuilder(true);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <header className="site-header">
        <div className="wrap between">
          <button className="brand" onClick={() => setView("Home")}>
            <span className="brand-mark">XI</span>
            <span>
              FANTASY<span className="brand-light"> XI</span>
              <small>WORLD CUP 2027</small>
            </span>
          </button>
          <nav className="desktop-nav">
            {["Home", "My XI", "Matches", "Leagues", "Standings"].map((v) => (
              <button
                className={view === v ? "active" : ""}
                onClick={() => setView(v)}
                key={v}
              >
                {v}
              </button>
            ))}
          </nav>
          <button
            className="account-btn"
            onClick={() => (user ? setAccount(true) : setAuthOpen(true))}
          >
            {user ? (
              <>
                <span className="account-dot">{user.name[0]}</span>
                <span className="account-name">{user.name.split(" ")[0]}</span>
              </>
            ) : (
              "Sign in"
            )}
            {!user && <Icon name="arrow" />}
          </button>
        </div>
      </header>
      <main className="wrap main">
        {notice && (
          <div className="toast" role="status">
            <Icon name="check" />
            {notice}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error} <button onClick={load}>Retry</button>
          </div>
        )}
        {loading ? (
          <div className="panel empty">Connecting to your league…</div>
        ) : (
          catalog && (
            <>
              {view === "Home" ? (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="eyebrow">
                        <i /> YOUR SEASON. YOUR XI.
                      </span>
                      <h1>
                        Big tournament.
                        <br />
                        Bigger bragging rights.
                      </h1>
                      <p>
                        Pick your stars. Make your moves.
                        <br />
                        Take on your friends, one match at a time.
                      </p>
                      <button className="lime" onClick={openBuilder}>
                        {squad ? "Manage my team" : "Build my free team"}
                        <Icon name="arrow" />
                      </button>
                      <div className="hero-meta">
                        <span>11 players</span>
                        <span>100 credits</span>
                        <span>Free to play</span>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="ball">
                        <span />
                      </div>
                      <div className="art-tag">
                        <b>YOUR NEXT</b>
                        <strong>winning XI.</strong>
                      </div>
                      <div className="star">✦</div>
                    </div>
                  </section>
                  <div className="data-note">
                    <span className="status-dot" />
                    {catalog.settings.dataLabel}
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel next-match">
                      <div className="between">
                        <span className="eyebrow">NEXT UP</span>
                        <span className="pill">
                          {next?.isSample ? "Practice fixture" : "Season match"}
                        </span>
                      </div>
                      {next ? (
                        <>
                          <div className="versus">
                            <div>
                              <span className="country-badge">
                                {next.teamA}
                              </span>
                              <b>{next.teamA}</b>
                            </div>
                            <span>VS</span>
                            <div>
                              <span className="country-badge gold">
                                {next.teamB}
                              </span>
                              <b>{next.teamB}</b>
                            </div>
                          </div>
                          <div className="match-bottom">
                            <span>
                              <Icon name="calendar" />
                              {date(next.startTime)}
                            </span>
                            <button
                              className="text-btn"
                              onClick={() => setView("Matches")}
                            >
                              View matches →
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="empty">
                          Fixtures will appear here when the organiser publishes
                          them.
                        </div>
                      )}
                    </section>
                    <section className="panel team-card">
                      <span className="eyebrow">YOUR CAMPAIGN</span>
                      <h2>
                        {squad ? squad.teamName : "A fresh season starts here."}
                      </h2>
                      <p className="muted">
                        {squad
                          ? "Your XI is saved. Ready for the next match."
                          : "Find your perfect combination and make it your own."}
                      </p>
                      <div className="campaign-stats">
                        <div>
                          <strong>
                            {squad ? "11" : "0"}
                            <small>/11</small>
                          </strong>
                          <span>Players picked</span>
                        </div>
                        <div>
                          <strong>
                            {["preseason", "reset"].includes(catalog.phase)
                              ? "∞"
                              : Math.max(
                                  0,
                                  catalog.phase === "knockout"
                                    ? catalog.settings.knockoutTransfers -
                                        (squad?.usedKnockout || 0)
                                    : catalog.settings.groupTransfers -
                                        (squad?.usedGroup || 0),
                                )}
                          </strong>
                          <span>Transfers left</span>
                        </div>
                      </div>
                      <button className="wide" onClick={openBuilder}>
                        {squad ? "Edit your XI" : "Start picking"}{" "}
                        <Icon name="arrow" />
                      </button>
                    </section>
                  </div>
                  <div className="section-title">
                    <h2>Small decisions. Big moments.</h2>
                    <button
                      className="text-btn"
                      onClick={() => setView("Rules")}
                    >
                      How to play →
                    </button>
                  </div>
                  <div className="how-grid">
                    {[
                      [
                        "01",
                        "Pick your best XI",
                        "Balance the stars with smart budget picks.",
                      ],
                      [
                        "02",
                        "Back your captain",
                        "Earn 2× points from your standout player.",
                      ],
                      [
                        "03",
                        "Play the long game",
                        "Carry your team forward and time your transfers.",
                      ],
                    ].map(([n, t, d]) => (
                      <div key={n}>
                        <span>{n}</span>
                        <h3>{t}</h3>
                        <p>{d}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : view === "My XI" ? (
                <>
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">YOUR SEASON TEAM</span>
                      <h1>{squad?.teamName || "Make this team yours."}</h1>
                    </div>
                    {user && (
                      <button className="primary" onClick={openBuilder}>
                        {squad ? "Edit team" : "Build team"}{" "}
                        <Icon name="arrow" />
                      </button>
                    )}
                  </div>
                  {!user ? (
                    <section className="panel empty">
                      <h2>Your team travels with you.</h2>
                      <p>Sign in to load your saved players on any device.</p>
                      <button
                        className="primary"
                        onClick={() => setAuthOpen(true)}
                      >
                        Sign in
                      </button>
                    </section>
                  ) : squad ? (
                    <div className="dashboard-grid">
                      <Pitch
                        players={selected}
                        captainId={squad.captainId}
                        viceCaptainId={squad.viceCaptainId}
                      />
                      <section className="panel">
                        <span className="pill">Saved to your account</span>
                        <h2>Ready for the next whistle.</h2>
                        <p className="muted">
                          Last saved {date(squad.updatedAt)}. Revision{" "}
                          {squad.revision}.
                        </p>
                        <div className="campaign-stats">
                          <div>
                            <strong>{squad.usedGroup}</strong>
                            <span>Group transfers used</span>
                          </div>
                          <div>
                            <strong>{squad.usedKnockout}</strong>
                            <span>Knockout transfers used</span>
                          </div>
                        </div>
                        <h3>Recent changes</h3>
                        {[...squad.history]
                          .reverse()
                          .slice(0, 8)
                          .map((v) => (
                            <div className="history" key={v.revision}>
                              <b>Revision {v.revision}</b>
                              <span>{date(v.savedAt)}</span>
                              <small>
                                {v.transfers} transfers · {v.phase}
                              </small>
                            </div>
                          ))}
                      </section>
                    </div>
                  ) : (
                    <section className="panel empty">
                      <h2>Your canvas is the pitch.</h2>
                      <p>Choose 11 players to start your season.</p>
                      <button className="primary" onClick={openBuilder}>
                        Pick my players
                      </button>
                    </section>
                  )}
                </>
              ) : view === "Matches" ? (
                <>
                  <div className="section-title">
                    <h1>The match centre</h1>
                    <span className="muted">Times shown in your timezone</span>
                  </div>
                  <div className="matches-grid">
                    {catalog.matches.map((m) => (
                      <section className="panel" key={m._id}>
                        <div className="between">
                          <span className="eyebrow">{m.stage}</span>
                          <span className="pill">
                            {m.isSample ? "PRACTICE · " : ""}
                            {new Date(m.startTime) <= new Date() &&
                            m.status === "UPCOMING"
                              ? "LOCKED"
                              : m.status}
                          </span>
                        </div>
                        <h2>{m.title}</h2>
                        <p>{date(m.startTime)}</p>
                        <p className="muted">{m.venue}</p>
                        {m.scoreUpdatedAt && (
                          <p className="muted">
                            Scorecard updated {date(m.scoreUpdatedAt)}
                          </p>
                        )}
                        <button
                          className="wide"
                          onClick={async () => {
                            if (!user) return setAuthOpen(true);
                            try {
                              setMatchDetail({
                                ...(await api(`/matches/${m._id}/team`)),
                                match: m,
                              });
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          View my match team <Icon name="arrow" />
                        </button>
                      </section>
                    ))}
                  </div>
                </>
              ) : view === "Standings" ? (
                <Leaderboard />
              ) : view === "Leagues" ? (
                user ? (
                  <Leagues />
                ) : (
                  <section className="panel empty">
                    <h2>Bring your cricket circle.</h2>
                    <p>Sign in to create or join a private league.</p>
                    <button
                      className="primary"
                      onClick={() => setAuthOpen(true)}
                    >
                      Sign in
                    </button>
                  </section>
                )
              ) : view === "Admin" && user?.isAdmin ? (
                <Suspense fallback={<p>Loading organiser tools…</p>}>
                  <Admin catalog={catalog} onRefresh={load} />
                </Suspense>
              ) : (
                <Rules />
              )}
              <footer className="footer">
                <span>
                  <b>FANTASY XI</b>
                  <br />
                  Independent fan game. Not affiliated with ICC or IPL.
                </span>
                <div>
                  <button className="text-btn" onClick={() => setView("Rules")}>
                    Rules, scoring & privacy
                  </button>
                  {user?.isAdmin && (
                    <button
                      className="text-btn"
                      onClick={() => setView("Admin")}
                    >
                      Organiser
                    </button>
                  )}
                </div>
              </footer>
            </>
          )
        )}
      </main>
      <nav className="mobile-nav" aria-label="Main navigation">
        {[
          ["Home", "home"],
          ["My XI", "team"],
          ["Matches", "calendar"],
          ["Leagues", "team"],
          ["Standings", "cup"],
        ].map(([v, i]) => (
          <button
            key={v}
            className={view === v ? "active" : ""}
            onClick={() => setView(v)}
          >
            <Icon name={i} />
            <span>{v}</span>
          </button>
        ))}
      </nav>
      {authOpen && (
        <Auth onClose={() => setAuthOpen(false)} onSuccess={login} />
      )}
      {builder && catalog && user && (
        <Builder
          catalog={catalog}
          squad={squad}
          user={user}
          onClose={() => setBuilder(false)}
          onSaved={(s) => {
            setSquad(s);
            setBuilder(false);
            setView("My XI");
            setNotice(
              "Team saved. Your XI will be here when you sign in again.",
            );
          }}
        />
      )}
      {matchDetail && (
        <Modal
          title={matchDetail.match.title}
          onClose={() => setMatchDetail(null)}
        >
          {matchDetail.team ? (
            <>
              <span className="pill">
                {matchDetail.locked
                  ? "Locked at deadline"
                  : "Current selection • editable until deadline"}
              </span>
              <h3>{matchDetail.team.teamName}</h3>
              <Pitch
                players={catalog.players.filter((p) =>
                  matchDetail.team.players.includes(p._id),
                )}
                {...matchDetail.team}
              />
              <p>
                <b>
                  {matchDetail.totalPoints === null
                    ? "Scores not published"
                    : `${matchDetail.totalPoints} points`}
                </b>
              </p>
            </>
          ) : (
            <p>No team was saved before this match deadline.</p>
          )}
        </Modal>
      )}
      {account && (
        <Modal title="Your account" onClose={() => setAccount(false)}>
          <p>
            {user.name}
            <br />
            <span className="muted">{user.email}</span>
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              try {
                const d = await api("/auth/password", {
                  method: "POST",
                  body: Object.fromEntries(new FormData(f)),
                });
                storage.set("fantasy-token", d.token);
                setNotice(
                  "Password updated. Other sessions have been signed out.",
                );
                setAccount(false);
              } catch (e) {
                setNotice(e.message);
              }
            }}
          >
            <label>
              Current password
              <input
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                name="password"
                minLength="8"
                maxLength="72"
                autoComplete="new-password"
                required
              />
            </label>
            <button className="wide">Update password</button>
          </form>
          <button className="text-btn wide" onClick={logout}>
            Sign out
          </button>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <Boundary>
    <App />
  </Boundary>,
);
