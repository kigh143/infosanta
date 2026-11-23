export const PEOPLE = [
  "Amina Nakato", "Brian Okello", "Catherine Achieng", "David Mugisha",
  "Esther Namubiru", "Francis Ssemwogerere", "Grace Atim", "Henry Kato",
  "Irene Nabirye", "Joseph Wasswa", "Kevin Tumusiime", "Lydia Nansubuga",
].map((name) => ({ name, id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }));

export const byId = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

export const EXCHANGE = new Date(2026, 11, 17);

export const firstName = (id) => byId[id].name.split(" ")[0];
