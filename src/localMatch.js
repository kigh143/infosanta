// Who you drew is kept only in this browser. Nothing links you to your person in the database.
const key = (id) => `infosanta:match:${id}`;

export function saveMatch(id, name) {
  try { localStorage.setItem(key(id), name); } catch { /* private mode etc. */ }
}

export function loadMatch(id) {
  try { return localStorage.getItem(key(id)) || ""; } catch { return ""; }
}
