import { useEffect, useMemo, useRef, useState } from "react";
import { EXCHANGE, firstName } from "./people";
import { subscribePeople, subscribeDraw, drawPerson } from "./db";
import { sendResult, emailConfigured, isEmail } from "./email";
import { sleep } from "./draw";
import { reduceMotion } from "./motion";
import Confetti from "./Confetti";

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
  const [people, setPeople] = useState(null); // null until loaded
  const [drawState, setDrawState] = useState(null); // { drawn, taken }
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState("pick"); // pick | confirm | result
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [match, setMatch] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [opened, setOpened] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState(""); // sending | sent | failed
  const runId = useRef(0);
  const confetti = useRef(null);

  useEffect(() => {
    const fail = () => setLoadError(true);
    const offPeople = subscribePeople((list) => { setPeople(list); setLoadError(false); }, fail);
    const offDrawn = subscribeDraw((state) => setDrawState(state), fail);
    return () => { offPeople(); offDrawn(); };
  }, []);

  const list = people || [];
  const byId = useMemo(() => Object.fromEntries(list.map((p) => [p.id, p])), [list]);
  const drawn = useMemo(() => new Set([...(drawState?.drawn || [])].filter((id) => byId[id])), [drawState, byId]);
  const connected = people !== null && drawState !== null;
  const me = selected ? byId[selected] : null;
  const myFirst = firstName(me?.name);

  // If the selected person is removed from the list, go back to the start.
  useEffect(() => {
    if (selected && people && !byId[selected]) reset();
  }, [people]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(id) {
    if (drawn.has(id)) return;
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
    setOpened(false);
    setRevealed(false);
    setError("");
    setEmail("");
    setEmailStatus("");
  }

  // Wiggle the sealed envelope, then open it and let the card slide out.
  async function openEnvelope(name, run) {
    const motion = !reduceMotion();
    if (motion) {
      setSpinning(true);
      await sleep(1400);
      setSpinning(false);
    }
    if (runId.current !== run) return;
    setMatch(name);
    setOpened(true);
    if (motion) await sleep(1600);
  }

  async function draw() {
    if (!selected || busy || !connected) return;
    if (!isEmail(email)) { setError("Enter a valid email address."); return; }
    const run = ++runId.current;
    setBusy(true);
    setError("");
    try {
      const receiver = await drawPerson(selected, list);
      const name = byId[receiver]?.name || receiver;
      // Send in the background while the envelope opens. Nothing is saved anywhere.
      setEmailStatus("sending");
      sendResult({ to: email, giver: me.name, match: name })
        .then(() => runId.current === run && setEmailStatus("sent"))
        .catch((err) => {
          console.error("EmailJS send failed:", err?.status, err?.text || err);
          if (runId.current === run) setEmailStatus("failed");
        });
      setOpened(false);
      setRevealed(false);
      setMatch("");
      setStep("result");
      await openEnvelope(name, run);
      if (runId.current === run) {
        setRevealed(true);
        confetti.current?.fire();
      }
    } catch (e) {
      const messages = {
        busy: "Lots of people are drawing right now. Try again in a few seconds.",
        already: "This name has already drawn.",
        stuck: "There's no one left to draw. Ask the organiser to reset the draw.",
        "too-few": "At least two people need to be on the list before anyone can draw.",
      };
      setError(messages[e?.message] || "Couldn't reach the draw. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const total = list.length;
  const pct = total ? Math.round((drawn.size / total) * 100) : 0;
  const progressText = loadError
    ? "Couldn't load the draw"
    : connected
      ? `${drawn.size} of ${total} have drawn`
      : "Connecting…";

  return (
    <main className="page">
      <Confetti ref={confetti} />
      <header className="head">
        <p className="brand">Info Consults </p>
        <h1>Secret Santa <span className="accent">2026</span></h1>
        <p className="meta">Gift exchange Thu 17 Dec · {countdownText()}</p>
      </header>

      {step === "pick" && (
        <section className="panel" aria-labelledby="pick-title">
          <h2 id="pick-title">Who are you?</h2>
          <p className="muted">Tap your own name. Picking someone else's spoils their surprise.</p>
          {!connected && !loadError && <p className="muted">Loading the team…</p>}
          {loadError && <p className="error">Couldn't load the team list. Refresh to try again.</p>}
          {connected && total === 0 && <p className="muted">No one is on the list yet. Check back soon.</p>}
          <ul className="names" role="list">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="name"
                  onClick={() => choose(p.id)}
                  disabled={drawn.has(p.id)}
                  aria-disabled={drawn.has(p.id)}
                >
                  <span className="name-text">{p.name}</span>
                  {drawn.has(p.id) && <span className="drawn">Drawn</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "confirm" && me && (
        <section className="panel" aria-labelledby="confirm-title">
          <h2 id="confirm-title">Hi, {myFirst}</h2>
          <p className="muted">You'll draw one colleague. Once drawn, it's locked, and you can't open it again here.</p>
          <div className="field">
            <label htmlFor="email">Where should we email your person?</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && draw()}
            />
            <p className="muted hint">Only used to send this one email. It isn't saved.</p>
          </div>
          {!emailConfigured && <p className="error">Email sending isn't set up yet. Ask the organiser.</p>}
          <div className="secret" role="note">
            <span className="secret-icon" aria-hidden="true">🤫</span>
            <div>
              <p className="secret-title">Do this in secret</p>
              <p>Make sure nobody can see your screen before you tap the button. The surprise only works if your person stays a secret.</p>
            </div>
          </div>
          <button className="btn" onClick={draw} disabled={busy || !connected || !emailConfigured || !isEmail(email)}>
            {busy ? "Drawing…" : "Draw my person"}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="link" onClick={reset}>Not {myFirst}? Choose again</button>
        </section>
      )}

      {step === "result" && me && (
        <section className="panel" aria-live="polite">
          <div className={"envelope-stage" + (opened ? " open" : "")}>
            <div className={"envelope" + (spinning ? " shaking" : "") + (opened ? " open" : "")}>
              <div className="env-back" />
              <div className="letter" aria-hidden={!opened}>
                <p className="letter-label">You're Secret Santa for</p>
                <p className="letter-row letter-to">
                  <span>To</span>
                  <strong>{match}</strong>
                </p>
                <hr className="letter-rule" />
                <p className="letter-row letter-from">
                  <span>From</span>
                  <strong>{me.name}</strong>
                </p>
              </div>
              <div className="env-front" />
              <p className="env-label">For {myFirst}'s eyes only</p>
              <div className="env-flap" />
              <div className="env-seal" aria-hidden="true">✦</div>
            </div>
          </div>
          {!opened && <p className="muted center">{spinning ? "Drawing your person…" : "Opening…"}</p>}
          {revealed && (
            <>
              {emailStatus === "sending" && <p className="muted">Sending it to {email.trim()}…</p>}
              {emailStatus === "sent" && (
                <p className="muted">We've emailed it to <strong>{email.trim()}</strong>. Keep it to yourself until 17 December.</p>
              )}
              {emailStatus === "failed" && (
                <p className="error" role="alert">
                  We couldn't send the email. Write your person down now: it isn't saved anywhere and you can't open it again.
                </p>
              )}
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
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={drawn.size}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <footer className="foot">Everyone draws one colleague, never themselves. Matches are never saved.</footer>
    </main>
  );
}
