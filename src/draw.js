import { PEOPLE, byId } from "./people";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One loop through everyone (Sattolo's algorithm): nobody gets themselves and no two people swap.
export function makeLoop() {
  const ids = PEOPLE.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const pairs = {};
  ids.forEach((id, i) => { pairs[id] = ids[(i + 1) % ids.length]; });
  return pairs;
}

// Returns the pairs object if it covers everyone correctly, otherwise null.
export function validPairs(p) {
  if (!p || typeof p !== "object") return null;
  for (const person of PEOPLE) {
    const r = p[person.id];
    if (!r || !byId[r] || r === person.id) return null;
  }
  return p;
}
