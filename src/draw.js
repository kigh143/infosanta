import { PEOPLE, byId } from "./people";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tabId = Math.random().toString(36).slice(2);

// One loop through everyone (Sattolo's algorithm): nobody gets themselves and no two people swap.
function makeLoop() {
  const ids = PEOPLE.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const pairs = {};
  ids.forEach((id, i) => { pairs[id] = ids[(i + 1) % ids.length]; });
  return pairs;
}

function validPairs(d) {
  const p = d && d.pairs;
  if (!p) return null;
  for (const person of PEOPLE) {
    const r = p[person.id];
    if (!r || !byId[r] || r === person.id) return null;
  }
  return p;
}

export async function getPairs(db) {
  const ref = db.doc("santa/pairs");
  let snap = await ref.get();
  let p = validPairs(snap.data());
  if (p) return p;
  for (let attempt = 0; attempt < 8; attempt++) {
    const lease = await ref.acquire({ holder: tabId, ttlMs: 8000 });
    if (lease.acquired) {
      snap = await ref.get();
      p = validPairs(snap.data());
      if (p) return p;
      p = makeLoop();
      await ref.set({ pairs: p, createdAt: new Date().toISOString() });
      return p;
    }
    await sleep(1000 + Math.random() * 800);
    snap = await ref.get();
    p = validPairs(snap.data());
    if (p) return p;
  }
  throw new Error("busy");
}
