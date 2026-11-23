// Firebase Realtime Database access. No sign-in.
//
// Layout (who got whom is NEVER stored; it only lives on the drawer's device):
//   people/{personId}     = "Full Name"   (added by the organiser)
//   draw/drawn/{personId} = true          (this person has drawn)
//   draw/taken/{personId} = true          (this person has been picked by someone)
//   draw/version          = number        (bumped on every draw so simultaneous draws can't clash)
import { ref, onValue, get, update } from "firebase/database";
import { database } from "./firebase";
import { pickReceiver, sleep } from "./draw";
import { parsePeople } from "./people";

const keys = (obj) => new Set(Object.keys(obj || {}));

export function subscribePeople(onChange, onError) {
  return onValue(ref(database, "people"), (snap) => onChange(parsePeople(snap.val())), onError);
}

// Calls onChange({ drawn: Set, taken: Set }) on every change.
export function subscribeDraw(onChange, onError) {
  return onValue(
    ref(database, "draw"),
    (snap) => {
      const v = snap.val() || {};
      onChange({ drawn: keys(v.drawn), taken: keys(v.taken) });
    },
    onError
  );
}

// Draws a receiver for `me` and records it anonymously. Returns the receiver's id.
export async function drawPerson(me, people) {
  if (people.length < 2) throw new Error("too-few");
  for (let attempt = 0; attempt < 8; attempt++) {
    const v = (await get(ref(database, "draw"))).val() || {};
    const drawn = keys(v.drawn), taken = keys(v.taken);
    if (drawn.has(me)) throw new Error("already");
    const receiver = pickReceiver(me, people, drawn, taken);
    if (!receiver) throw new Error("stuck");
    try {
      // All three writes succeed together or not at all. The rules reject the write if the
      // version moved on (someone else drew meanwhile) or if the receiver was already taken.
      await update(ref(database, "draw"), {
        version: (v.version || 0) + 1,
        [`drawn/${me}`]: true,
        [`taken/${receiver}`]: true,
      });
      return receiver;
    } catch (e) {
      if (!String(e?.code || e?.message).toLowerCase().includes("permission")) throw e;
      await sleep(300 + Math.random() * 700); // someone drew at the same moment: retry with fresh data
    }
  }
  throw new Error("busy");
}
