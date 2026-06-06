// Local-first accounts: multiple named learner profiles in localStorage, each with
// its own LearnerState. A "current profile" pointer selects which state useLearner reads.
// Cloud sync (optional, see cloud.ts) layers on top of this.

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
}

interface Index {
  profiles: Profile[];
  currentId: string;
}

const INDEX_KEY = "telos:profiles";
const stateKey = (id: string) => `telos:learner:${id}`;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "p" + Date.now().toString(36);
}

function fallback(): Index {
  return { profiles: [{ id: "default", name: "我", createdAt: 0 }], currentId: "default" };
}

function readIndex(): Index {
  if (typeof window === "undefined") return fallback();
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (raw) {
      const idx = JSON.parse(raw) as Index;
      if (idx.profiles?.length) return idx;
    }
  } catch {
    /* ignore */
  }
  const idx: Index = { profiles: [{ id: "default", name: "我", createdAt: Date.now() }], currentId: "default" };
  writeIndex(idx);
  return idx;
}

function writeIndex(idx: Index): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch {
    /* ignore */
  }
}

export function currentStateKey(): string {
  return stateKey(readIndex().currentId);
}

export function listProfiles(): Profile[] {
  return readIndex().profiles;
}

export function currentProfile(): Profile {
  const idx = readIndex();
  return idx.profiles.find((p) => p.id === idx.currentId) ?? idx.profiles[0];
}

export function createProfile(name: string): Profile {
  const idx = readIndex();
  const p: Profile = { id: uid(), name: name.trim() || "新档案", createdAt: Date.now() };
  idx.profiles.push(p);
  idx.currentId = p.id;
  writeIndex(idx);
  return p;
}

export function switchProfile(id: string): void {
  const idx = readIndex();
  if (idx.profiles.some((p) => p.id === id)) {
    idx.currentId = id;
    writeIndex(idx);
  }
}

export function renameProfile(id: string, name: string): void {
  const idx = readIndex();
  const p = idx.profiles.find((x) => x.id === id);
  if (p) {
    p.name = name.trim() || p.name;
    writeIndex(idx);
  }
}

export function deleteProfile(id: string): void {
  const idx = readIndex();
  if (idx.profiles.length <= 1) return; // keep at least one
  idx.profiles = idx.profiles.filter((p) => p.id !== id);
  if (idx.currentId === id) idx.currentId = idx.profiles[0].id;
  writeIndex(idx);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(stateKey(id));
    } catch {
      /* ignore */
    }
  }
}

export function exportProfile(id: string): string {
  const p = readIndex().profiles.find((x) => x.id === id);
  let state: unknown = null;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(stateKey(id));
      state = raw ? JSON.parse(raw) : null;
    } catch {
      /* ignore */
    }
  }
  return JSON.stringify({ telos: "profile-export", v: 1, profile: p, state }, null, 2);
}

export function importProfile(json: string): Profile {
  const data = JSON.parse(json);
  const name = data?.profile?.name || "导入的档案";
  const p = createProfile(name);
  if (data?.state && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(stateKey(p.id), JSON.stringify(data.state));
    } catch {
      /* ignore */
    }
  }
  return p;
}
