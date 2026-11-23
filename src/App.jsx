import { useEffect, useMemo, useRef, useState } from "react";
import { EXCHANGE, firstName } from "./people";
import { subscribePeople, subscribeDraw, drawPerson } from "./db";
import { saveMatch, loadMatch } from "./localMatch";
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
  const savedMatch = me ? loadMatch(me.id) : "";
  const drewElsewhere = !!me && drawn.has(me.id) && !savedMatch;

  // If the selected person is removed from the list, go back to the start.
  useEffect(() => {
    if (selected && people && !byId[selected]) reset();
  }, [people]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setOpened(false);
    setRevealed(false);
    setError("");
  }

  // Wiggle the sealed envelope (first draw only), then open it and let the card slide out.
  async function openEnvelope(name, run, quick) {
    const motion = !reduceMotion();
    if (motion && !quick) {
      setSpinning(true);
      await sleep(1400);
      setSpinning(false);
    }
    if (runId.current !== run) return;
    setMatch(name);
    setOpened(true);
    if (motion) await sleep(quick ? 1300 : 1600);
  }

  async function draw() {
    if (!selected || busy || !connected) return;
    const run = ++runId.current;
    setBusy(true);
    setError("");
    const again = drawn.has(selected);
    try {
      let name;
      if (again) {
        name = loadMatch(selected);
        if (!name) throw new Error("elsewhere");
      } else {
        const receiver = await drawPerson(selected, list);
        name = byId[receiver]?.name || receiver;
        saveMatch(selected, name);
      }
      setOpened(false);
      setRevealed(false);
      setMatch("");
      setStep("result");
      await openEnvelope(name, run, again);
      if (runId.current === run) {
        setRevealed(true);
        confetti.current?.fire();
      }
    } catch (e) {
      const messages = {
        busy: "Lots of people are drawing right now. Try again in a few seconds.",
        already: "This name has already drawn.",
        elsewhere: "You drew on another device. Your person is only remembered there.",
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
        <p className="brand">Infoconsults</p>
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
                <button type="button" className="name" onClick={() => choose(p.id)}>
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
          <p className="muted">
            {drewElsewhere
              ? "You've already drawn, but not on this device. We don't keep a record of who got whom, so your person can only be shown on the device you drew on."
              : drawn.has(selected)
                ? "You've already drawn. Tap below to see your person again."
                : "You'll draw one colleague. Once drawn, it's locked."}
          </p>
          {!drewElsewhere && <div className="secret" role="note">
            <span className="secret-icon" aria-hidden="true">🤫</span>
            <div>
              <p className="secret-title">Do this in secret</p>
              <p>Make sure nobody can see your screen before you tap the button. The surprise only works if your person stays a secret.</p>
            </div>
          </div>}
          {!drewElsewhere && (
            <button className="btn" onClick={draw} disabled={busy || !connected}>
              {busy ? "Drawing…" : drawn.has(selected) ? "Show my person" : "Draw my person"}
            </button>
          )}
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
              <p className="muted">
                Keep it to yourself until 17 December. Nobody keeps a record of who got whom, so write it down.
                You can see it again on this device by picking your name.
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
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={drawn.size}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <footer className="foot">Everyone draws one colleague, never themselves. Matches are never saved.</footer>
    </main>
  );
}
