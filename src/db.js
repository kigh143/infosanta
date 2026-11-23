// Firebase Realtime Database access. No sign-in: security rules in database.rules.json
// keep writes to "create once" so nobody can overwrite the pairs or un-draw someone.
//
// Layout:
//   santa/pairs/{giverId} = receiverId
//   santa/createdAt       = ISO string
//   drawn/{personId}      = { at: ISO string }
import { ref, onValue, runTransaction, set, get } from "firebase/database";
import { database } from "./firebase";
import { makeLoop, validPairs } from "./draw";

// Calls onChange(Set<id>) whenever someone draws. Returns an unsubscribe function.
export function subscribeDrawn(onChange, onError) {
  return onValue(
    ref(database, "drawn"),
    (snap) => onChange(new Set(Object.keys(snap.val() || {}))),
    onError
  );
}

// Returns the shared pairs, creating them atomically the first time anyone draws.
export async function getPairs() {
  const pairsRef = ref(database, "santa/pairs");
  const existing = validPairs((await get(pairsRef)).val());
  if (existing) return existing;

  const result = await runTransaction(pairsRef, (current) => {
    if (validPairs(current)) return; // someone beat us to it: abort and use theirs
    return makeLoop();
  });
  const pairs = validPairs(result.snapshot.val());
  if (!pairs) throw new Error("busy");
  if (result.committed) {
    try { await set(ref(database, "santa/createdAt"), new Date().toISOString()); } catch { /* optional */ }
  }
  return pairs;
}

export async function markDrawn(id) {
  await set(ref(database, "drawn/" + id), { at: new Date().toISOString() });
}
