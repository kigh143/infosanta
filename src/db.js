// Database adapter.
// On claude.ai the page gets a shared database from the artifact runtime (window.claude.use("db")).
// Anywhere else we fall back to a localStorage stand-in with the same API, so the app runs locally.
// NOTE: the fallback is per-browser only. For a real multi-person draw, replace it with a shared
// backend (Firebase, Supabase, a small API, ...) that implements the same few methods.

const PREFIX = "infosanta:";

function createLocalDb() {
  const listeners = new Map(); // collection -> Set<fn>

  const read = (path) => {
    try { const raw = localStorage.getItem(PREFIX + path); return raw ? JSON.parse(raw) : undefined; }
    catch { return undefined; }
  };
  const write = (path, value) => {
    try { localStorage.setItem(PREFIX + path, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const collectionSnapshot = (name) => {
    const docs = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${PREFIX}${name}/`)) {
          const id = key.slice(PREFIX.length + name.length + 1);
          const data = read(`${name}/${id}`);
          docs.push({ id, data: () => data });
        }
      }
    } catch { /* ignore */ }
    return { docs, metadata: { fromCache: false } };
  };

  const notify = (name) => {
    const snap = collectionSnapshot(name);
    listeners.get(name)?.forEach((fn) => fn(snap));
  };

  // Keep other tabs in sync.
  window.addEventListener("storage", (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const name = e.key.slice(PREFIX.length).split("/")[0];
    notify(name);
  });

  return {
    doc(path) {
      const name = path.split("/")[0];
      return {
        async get() { const data = read(path); return { exists: data !== undefined, data: () => data }; },
        async set(value) { write(path, value); notify(name); },
        async acquire({ holder, ttlMs }) {
          const key = `__lease/${path}`;
          const lease = read(key);
          if (lease && lease.holder !== holder && lease.until > Date.now()) return { acquired: false };
          write(key, { holder, until: Date.now() + ttlMs });
          return { acquired: true };
        },
      };
    },
    collection(name) {
      return {
        onSnapshot(onNext) {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name).add(onNext);
          queueMicrotask(() => onNext(collectionSnapshot(name)));
          return () => listeners.get(name).delete(onNext);
        },
      };
    },
  };
}

export async function connectDb() {
  if (window.claude?.use) return window.claude.use("db");
  return createLocalDb();
}
