export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Picks a receiver for `me` from the names nobody has been given yet.
// Never picks yourself, and never leaves the last person with only their own name.
export function pickReceiver(me, people, drawn, taken) {
  const ids = people.map((p) => p.id);
  const receivers = ids.filter((id) => !taken.has(id));
  const giversAfter = ids.filter((id) => !drawn.has(id) && id !== me);

  const candidates = receivers.filter((c) => {
    if (c === me) return false;
    if (giversAfter.length !== 1) return true;
    const last = giversAfter[0];
    return receivers.some((r) => r !== c && r !== last); // the last giver must still have someone
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
