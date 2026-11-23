import { useEffect, useRef, useState } from "react";
import { PEOPLE, byId, EXCHANGE, firstName } from "./people";
import { connectDb } from "./db";
import { getPairs, sleep } from "./draw";
import { reduceMotion } from "./motion";
import Snow from "./components/Snow";
import Confetti from "./components/Confetti";

function countdownText() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((EXCHANGE - today) / 86400000);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "Tomorrow!";
  if (days === 0) return "It's today!";
  return "Exchange done";
}

export default function App() {
  const [db, setDb] = useState(null);
  const [dbFailed, setDbFailed] = useState(false);
  const [drawn, setDrawn] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ msg: "", err: false });
  const [progressLabel, setProgressLabel] = useState("Loading draws…");

  // result view
  const [view, setView] = useState("pick");
  const [tagFrom, setTagFrom] = useState("");
  const [tagTo, setTagTo] = useState("…");
  const [spinning, setSpinning] = useState(false);
  const [landKey, setLandKey] = useState(0); // bump to replay the "landed" pop
  const [keepVisible, setKeepVisible] = useState(false);
  const [idle, setIdle] = useState(false);

  // dots that just turned on get a pop animation
  const prevCount = useRef(0);
  const [popFrom, setPopFrom] = useState(0);

  const tagRef = useRef(null);
  const confettiRef = useRef(null);
  const runId = useRef(0);

  // Connect to the database and subscribe to who has drawn.
  useEffect(() => {
    let unsub, timer, cancelled = false;
    (async () => {
      let conn = null;
      try { conn = await connectDb(); } catch { conn = null; }
      if (cancelled) return;
      if (!conn) {
        setDbFailed(true);
        setProgressLabel("Draws unavailable");
        setStatus({ msg: "Couldn't connect to the draw. Refresh the page to try again.", err: true });
        return;
      }
      setDb(conn);
      let loaded = false;
      timer = setTimeout(() => { if (!loaded) setProgressLabel("Still connecting to the draw…"); }, 10000);
      unsub = conn.collection("drawn").onSnapshot(
        (snap) => {
          const next = new Set(snap.docs.filter((d) => byId[d.id]).map((d) => d.id));
          if (!snap.metadata?.fromCache) { loaded = true; clearTimeout(timer); }
          setPopFrom(prevCount.current > 0 ? prevCount.current : next.size);
          prevCount.current = next.size;
          setDrawn(next);
          setProgressLabel(`${next.size} of ${PEOPLE.length} have drawn`);
        },
        () => { clearTimeout(timer); setProgressLabel("Couldn't load who has drawn"); }
      );
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (typeof unsub === "function") unsub();
    };
  }, []);

  async function shuffleTo(finalName, run) {
    if (!reduceMotion()) {
      setSpinning(true);
      const others = PEOPLE.filter((p) => p.id !== selected);
      const end = performance.now() + 1700;
      let delay = 55;
      while (performance.now() < end) {
        if (runId.current !== run) return;
        setTagTo(others[Math.floor(Math.random() * others.length)].name);
        await sleep(delay);
        delay = Math.min(delay * 1.08, 220);
      }
      setSpinning(false);
    }
    if (runId.current !== run) return;
    setTagTo(finalName);
    setLandKey((k) => k + 1);
    requestAnimationFrame(() => confettiRef.current?.burst(tagRef.current));
  }

  async function handleDraw() {
    if (!selected || busy || !db) return;
    const run = ++runId.current;
    setBusy(true);
    setStatus({ msg: "Drawing…", err: false });
    const me = byId[selected];
    const again = drawn.has(selected);
    try {
      const pairs = await getPairs(db);
      const match = byId[pairs[me.id]];
      setTagFrom(`To ${firstName(me.id)},`);
      setTagTo("…");
      setKeepVisible(false);
      setView("result");
      setStatus({ msg: "", err: false });
      if (!again) {
        try { await db.doc("drawn/" + me.id).set({ at: new Date().toISOString() }); } catch { /* non-fatal */ }
        await shuffleTo(match.name, run);
      } else {
        setTagTo(match.name);
        setLandKey((k) => k + 1);
      }
      if (runId.current !== run) return;
      setKeepVisible(true);
      setIdle(true);
    } catch (e) {
      setStatus({
        msg: e?.message === "busy"
          ? "Someone else is drawing right now. Wait a few seconds and try again."
          : "Couldn't reach the draw. Check your connection and try again.",
        err: true,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleBack() {
    runId.current++;
    setIdle(false);
    setSpinning(false);
    setSelected(null);
    setView("pick");
    setLandKey(0);
    window.scrollTo(0, 0);
  }

  let drawLabel = "Pick your name first";
  if (selected) {
    const first = firstName(selected);
    drawLabel = drawn.has(selected) ? `Show my match again, ${first}` : `I'm ${first}, draw my person`;
  }
  const drawDisabled = !selected || busy || !db || dbFailed;

  return (
    <>
      <Snow />
      <Confetti ref={confettiRef} />
      <div className="ribbon" aria-hidden="true" />
      <div className="wrap">
        <header>
          <div className="bulbs" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <i key={i} />)}
          </div>
          <div className="eyebrow">Infoconsults · Office gift exchange</div>
          <h1>Secret <em>Santa</em> 2026</h1>
          <div className="meta">
            <span className="chip">Gift exchange <b>Thu 17 Dec 2026</b></span>
            <span className="chip">{countdownText()}</span>
          </div>
        </header>

        {/* Step 1: pick your name */}
        <section className="card" hidden={view !== "pick"}>
          <div>
            <h2>Who are you?</h2>
            <p className="hint">Tap your own name. Please don't pick a colleague's name, or you'll spoil their surprise.</p>
          </div>
          <div className="names" role="group" aria-label="Team members">
            {PEOPLE.map((p) => (
              <button
                key={p.id}
                type="button"
                className="name"
                aria-pressed={selected === p.id}
                onClick={() => setSelected(p.id)}
              >
                <span>{p.name}</span>
                {drawn.has(p.id) && <span className="done">DRAWN</span>}
              </button>
            ))}
          </div>
          <button className="primary" disabled={drawDisabled} onClick={handleDraw}>{drawLabel}</button>
          <p className={"status" + (status.err ? " err" : "")}>{status.msg}</p>
        </section>

        {/* Step 2: result */}
        <section className="card" hidden={view !== "result"}>
          <div className="tag-stage">
            <div className={"tag-swing" + (idle ? " idle" : "")}>
              <div
                key={landKey}
                ref={tagRef}
                className={"tag" + (spinning ? " spinning" : "") + (landKey > 0 ? " landed" : "")}
              >
                <div className="from">{tagFrom}</div>
                <div className="to-label">You're Secret Santa for</div>
                <div className="to">{tagTo}</div>
              </div>
            </div>
          </div>
          <p className="hint" hidden={!keepVisible}>
            Keep it to yourself until 17 December. If you forget, come back and pick your name again to see the same person.
          </p>

          <div className="reminder">
            <h3>Go easy on your pocket</h3>
            <p>The economy is tough right now, so please don't break the bank. A small, thoughtful gift means more than an expensive one, and nobody is comparing prices.</p>
            <ul>
              <li>A snack or drink you know they love</li>
              <li>Something useful for their desk</li>
              <li>A handwritten note goes a long way</li>
            </ul>
          </div>
          <button className="ghost" onClick={handleBack}>Done, back to the list</button>
        </section>

        <section className="progress" aria-live="polite">
          <div className="eyebrow">{progressLabel}</div>
          <div className="dots">
            {PEOPLE.map((p, i) => {
              const on = i < drawn.size;
              const pop = on && i >= popFrom;
              return <span key={p.id} className={"dot" + (on ? " on" : "") + (pop ? " pop" : "")} />;
            })}
          </div>
        </section>

        <footer>Everyone draws one colleague, never themselves. Once you've drawn, your match is locked.</footer>
      </div>
    </>
  );
}
