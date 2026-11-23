import { useEffect, useRef, useState } from "react";
import { PEOPLE, byId, EXCHANGE, firstName } from "./people";
import { subscribeDrawn, getPairs, markDrawn } from "./db";
import { sleep } from "./draw";
import { reduceMotion } from "./motion";

function countdownText() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((EXCHANGE - today) / 86400000);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  return "Done";
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [drawn, setDrawn] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState("pick"); // pick | confirm | result
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [match, setMatch] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    const unsub = subscribeDrawn(
      (raw) => {
        setDrawn(new Set([...raw].filter((id) => byId[id])));
        setConnected(true);
        setLoadError(false);
      },
      () => setLoadError(true)
    );
    return unsub;
  }, []);

  function choose(id) {
    setSelected(id);
    setError("");
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    runId.current++;
    setSelected(null);
    setStep("pick");
    setMatch("");
    setSpinning(false);
    setRevealed(false);
    setError("");
  }

  async function shuffleTo(finalName, run) {
    if (!reduceMotion()) {
      setSpinning(true);
      const others = PEOPLE.filter((p) => p.id !== selected);
      const end = performance.now() + 1500;
      let delay = 50;
      while (performance.now() < end) {
        if (runId.current !== run) return;
        setMatch(others[Math.floor(Math.random() * others.length)].name);
        await sleep(delay);
        delay = Math.min(delay * 1.1, 200);
      }
      setSpinning(false);
    }
    if (runId.current !== run) return;
    setMatch(finalName);
  }

  async function draw() {
    if (!selected || busy || !connected) return;
    const run = ++runId.current;
    setBusy(true);
    setError("");
    const again = drawn.has(selected);
    try {
      const pairs = await getPairs();
      const name = byId[pairs[selected]].name;
      setRevealed(false);
      setStep("result");
      if (again) {
        setMatch(name);
      } else {
        try { await markDrawn(selected); } catch { /* already marked or offline */ }
        await shuffleTo(name, run);
      }
      if (runId.current === run) setRevealed(true);
    } catch (e) {
      setError(
        e?.message === "busy"
          ? "Someone else is drawing right now. Try again in a few seconds."
          : "Couldn't reach the draw. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const pct = Math.round((drawn.size / PEOPLE.length) * 100);
  const progressText = loadError
    ? "Couldn't load the draw"
    : connected
      ? `${drawn.size} of ${PEOPLE.length} have drawn`
      : "Connecting…";

  return (
    <main className="page">
      <header className="head">
        <p className="brand">Infoconsults</p>
        <h1>Secret Santa <span className="accent">2026</span></h1>
        <p className="meta">Gift exchange Thu 17 Dec · {countdownText()}</p>
      </header>

      {step === "pick" && (
        <section className="panel" aria-labelledby="pick-title">
          <h2 id="pick-title">Who are you?</h2>
          <p className="muted">Tap your own name. Picking someone else's spoils their surprise.</p>
          <ul className="names" role="list">
            {PEOPLE.map((p) => (
              <li key={p.id}>
                <button type="button" className="name" onClick={() => choose(p.id)}>
                  <span className="name-text">{p.name}</span>
                  {drawn.has(p.id) && <span className="drawn">Drawn</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "confirm" && selected && (
        <section className="panel" aria-labelledby="confirm-title">
          <h2 id="confirm-title">Hi, {firstName(selected)}</h2>
          <p className="muted">
            {drawn.has(selected)
              ? "You've already drawn. Tap below to see your person again."
              : "Ready? You'll draw one colleague. Once drawn, it's locked."}
          </p>
          <button className="btn" onClick={draw} disabled={busy || !connected}>
            {busy ? "Drawing…" : drawn.has(selected) ? "Show my person" : "Draw my person"}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="link" onClick={reset}>Not {firstName(selected)}? Choose again</button>
        </section>
      )}

      {step === "result" && selected && (
        <section className="panel" aria-live="polite">
          <div className="result">
            <p className="label">You're Secret Santa for</p>
            <p className={"match" + (spinning ? " spinning" : "") + (revealed ? " revealed" : "")}>
              {match || "…"}
            </p>
          </div>
          {revealed && (
            <>
              <p className="muted">
                Keep it to yourself until 17 December. Forgot? Pick your name again to see the same person.
              </p>
              <div className="note">
                <p className="note-title">Keep it simple</p>
                <p>
                  Money is tight for many people right now. A small, thoughtful gift beats an expensive one. A snack
                  they love, something for their desk, or a handwritten note is perfect.
                </p>
              </div>
              <button className="btn btn-outline" onClick={reset}>Done</button>
            </>
          )}
        </section>
      )}

      <section className="progress" aria-live="polite">
        <div className="progress-row">
          <span>{progressText}</span>
          {connected && <span>{pct}%</span>}
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={PEOPLE.length} aria-valuenow={drawn.size}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <footer className="foot">Everyone draws one colleague, never themselves.</footer>
    </main>
  );
}
