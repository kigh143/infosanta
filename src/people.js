// The team list lives in the Realtime Database under /people:
//   people/{id} = "Full Name"          e.g. people/amina-nakato = "Amina Nakato"
// ({ name: "Full Name" } objects are accepted too.)

export const EXCHANGE = new Date(2026, 11, 17);

// Turns the /people snapshot into a sorted [{ id, name }] list.
export function parsePeople(val) {
  return Object.entries(val || {})
    .map(([id, v]) => ({ id, name: String(typeof v === "string" ? v : v?.name || "").trim() }))
    .filter((p) => p.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const firstName = (name) => (name || "").split(" ")[0];
