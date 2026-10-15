/**
 * TEMPORARY review-only suggestion store. Not part of the CRM.
 * Delete demo-web/src/temp-suggestions, demo-web/public/suggestions.html,
 * and the SuggestionLayer mount in main.tsx to remove this layer.
 *
 * ntfy.sh accepted a save (HTTP 200) and then omitted it from the next read
 * for a few seconds. The page treated that miss as failure and posted again,
 * which burned the anonymous cap, and a note that had already landed still
 * showed a save error. ntfy also drops messages after about 12 hours.
 *
 * The shared log is one public Telegraph page. A save rewrites that page
 * once, after reading the latest copy and keeping every message already
 * there. A successful write is never posted again. If the write returns 429,
 * the network fails, or the following read is briefly behind, the note stays
 * in localStorage and on screen. A later poll may send the missing messages
 * once, and only after the backoff, after it has read the page again.
 * Delete posts a tombstone {id, deleted:true}. Done posts {id, done:true}.
 * Delete wins over done. The page keeps messages until a later edit removes
 * them. Do not put private client data in a suggestion.
 *
 * KEEP THE URL, PATH, AND WRITE TOKEN IN SYNC with demo-web/public/suggestions.html.
 * The token is the public write capability for this page, not a private API key.
 * Poll about every 30s. The demo page and the inbox poll separately.
 */

export const SUGGESTION_TOPIC_URL =
  "https://api.telegra.ph/getPage/Intertax-CRM-suggestions-10-15?return_content=true";

const TELEGRAPH_EDIT_URL = "https://api.telegra.ph/editPage";
const TELEGRAPH_PATH = "Intertax-CRM-suggestions-10-15";
const TELEGRAPH_TOKEN = "26c39a75233526c1497678e28ab69a3a6b498fcc9531f6c5328e5c5d4869";
const TELEGRAPH_TITLE = "Intertax CRM suggestions";
const MIRROR_KEY = "itx-sug-mirror-v1";
const RETRY_MS = 30000;
const PAUSE_MS = 60000;
const SETTLE_MS = 8000;

export const ANONYMOUS_AUTHOR = "אנונימי";

export type Suggestion = {
  id: string;
  createdAt: string;
  author: string;
  text: string;
  xPct: number;
  yPct: number;
  anchor: string;
};

export type SuggestionSnapshot = {
  suggestions: Suggestion[];
  deletedIds: string[];
  doneIds: string[];
};

type Mirror = {
  rev: number;
  messages: unknown[];
  pauseUntil: number;
  nextWriteAt: number;
  dirty: boolean;
};

let memory: Mirror | null = null;
let tail: Promise<void> = Promise.resolve();

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeSuggestion(value: unknown): Suggestion | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) return null;
  if (typeof record.text !== "string" || !record.text.trim()) return null;
  const xPct = typeof record.xPct === "number" ? record.xPct : Number(record.xPct);
  const yPct = typeof record.yPct === "number" ? record.yPct : Number(record.yPct);
  if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) return null;
  const author =
    typeof record.author === "string" && record.author.trim()
      ? clip(record.author, 60)
      : ANONYMOUS_AUTHOR;
  const anchor = typeof record.anchor === "string" ? clip(record.anchor, 80) : "";
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
  return {
    id: record.id,
    createdAt,
    author,
    text: clip(record.text, 2000),
    xPct: Math.min(100, Math.max(0, xPct)),
    yPct: Math.min(100, Math.max(0, yPct)),
    anchor,
  };
}

function sortSuggestions(items: Suggestion[]): Suggestion[] {
  return [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

function removedIdSet(ids: Iterable<string> | undefined): Set<string> {
  const removed = new Set<string>();
  if (!ids) return removed;
  for (const id of ids) {
    removed.add(id);
    const trimmed = id.trim();
    if (trimmed) removed.add(trimmed);
  }
  return removed;
}

export function mergeSuggestions(
  current: Suggestion[],
  incoming: Suggestion[],
  deletedIds?: Iterable<string>,
): Suggestion[] {
  const removed = removedIdSet(deletedIds);
  const byId = new Map<string, Suggestion>();
  for (const item of [...current, ...incoming]) {
    if (removed.has(item.id) || removed.has(item.id.trim())) continue;
    byId.set(item.id, item);
  }
  return sortSuggestions([...byId.values()]);
}

function tombstoneId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.deleted !== true || typeof record.id !== "string" || !record.id.trim()) return null;
  return record.id;
}

function doneStatus(value: unknown): { id: string; done: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.deleted === true) return null;
  if (typeof record.done !== "boolean") return null;
  if (typeof record.id !== "string" || !record.id.trim()) return null;
  return { id: record.id, done: record.done };
}

function messageKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) return null;
  if (record.deleted === true) return `del:${record.id}`;
  if (typeof record.done === "boolean") return `done:${record.id}`;
  if (typeof record.text === "string" && record.text.trim()) return `save:${record.id}`;
  return null;
}

function snapshotFromMessages(messages: unknown[]): SuggestionSnapshot {
  const tombstones = new Set<string>();
  const doneFlags = new Map<string, boolean>();
  const byId = new Map<string, Suggestion>();
  for (const payload of messages) {
    const marked = tombstoneId(payload);
    if (marked) {
      tombstones.add(marked);
      const trimmedId = marked.trim();
      if (trimmedId) tombstones.add(trimmedId);
      continue;
    }
    const status = doneStatus(payload);
    if (status) {
      doneFlags.set(status.id, status.done);
      const trimmedId = status.id.trim();
      if (trimmedId) doneFlags.set(trimmedId, status.done);
    }
    const suggestion = normalizeSuggestion(payload);
    if (suggestion) byId.set(suggestion.id, suggestion);
  }
  for (const id of [...byId.keys()]) {
    if (tombstones.has(id) || tombstones.has(id.trim())) byId.delete(id);
  }
  const doneIds: string[] = [];
  for (const [id, isDone] of doneFlags) {
    if (!isDone) continue;
    if (tombstones.has(id) || tombstones.has(id.trim())) continue;
    doneIds.push(id);
  }
  return {
    suggestions: sortSuggestions([...byId.values()]),
    deletedIds: [...tombstones],
    doneIds,
  };
}

function unionMessages(remote: unknown[], local: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const message of [...remote, ...local]) {
    const key = messageKey(message);
    if (!key) continue;
    map.set(key, message);
  }
  return [...map.values()];
}

function hasPending(messages: unknown[], remote: unknown[]): boolean {
  const remoteKeys = new Set<string>();
  for (const message of remote) {
    const key = messageKey(message);
    if (key) remoteKeys.add(key);
  }
  return messages.some((message) => {
    const key = messageKey(message);
    return Boolean(key && !remoteKeys.has(key));
  });
}

function emptyMirror(): Mirror {
  return { rev: 0, messages: [], pauseUntil: 0, nextWriteAt: 0, dirty: false };
}

function sanitizeMirror(value: unknown): Mirror | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.messages)) return null;
  return {
    rev: typeof record.rev === "number" ? record.rev : 0,
    messages: record.messages,
    pauseUntil: typeof record.pauseUntil === "number" ? record.pauseUntil : 0,
    nextWriteAt: typeof record.nextWriteAt === "number" ? record.nextWriteAt : 0,
    dirty: record.dirty === true,
  };
}

function readStorage(): Mirror | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    return sanitizeMirror(JSON.parse(raw));
  } catch {
    return null;
  }
}

function loadMirror(): Mirror {
  const stored = readStorage();
  if (!memory) memory = stored ?? emptyMirror();
  else if (stored && stored.rev > memory.rev) memory = stored;
  return memory;
}

function saveMirror(mirror: Mirror) {
  mirror.rev += 1;
  memory = mirror;
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror));
  } catch {
    /* A private window still keeps this tab's copy in memory. */
  }
}

function remember(message: unknown): boolean {
  const key = messageKey(message);
  if (!key) return false;
  const mirror = loadMirror();
  if (mirror.messages.some((item) => messageKey(item) === key)) return false;
  mirror.messages = [...mirror.messages, message];
  mirror.dirty = true;
  saveMirror(mirror);
  return true;
}

function collectText(node: unknown, out: string[]) {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const children = (node as { children?: unknown }).children;
  if (Array.isArray(children)) collectText(children, out);
}

function messagesFromResult(result: unknown): unknown[] | null {
  if (!result || typeof result !== "object") return null;
  const texts: string[] = [];
  collectText((result as { content?: unknown }).content, texts);
  if (texts.length === 0) return [];
  for (const text of texts) {
    try {
      const parsed = JSON.parse(text) as { messages?: unknown };
      if (parsed && Array.isArray(parsed.messages)) return parsed.messages;
    } catch {
      /* Keep looking. A title or other node is not the log. */
    }
  }
  return null;
}

async function fetchMessages(): Promise<unknown[] | "pause" | "down"> {
  try {
    const response = await fetch(SUGGESTION_TOPIC_URL, {
      cache: "no-store",
      credentials: "omit",
    });
    if (response.status === 429) return "pause";
    if (!response.ok) return "down";
    const payload = (await response.json()) as { ok?: boolean; result?: unknown };
    if (!payload || payload.ok !== true) return "down";
    const messages = messagesFromResult(payload.result);
    return messages === null ? "down" : messages;
  } catch {
    return "down";
  }
}

async function writeDocument(messages: unknown[]): Promise<"ok" | "later" | "pause"> {
  if (messages.length === 0) return "later";
  const form = new URLSearchParams();
  form.set("access_token", TELEGRAPH_TOKEN);
  form.set("path", TELEGRAPH_PATH);
  form.set("title", TELEGRAPH_TITLE);
  form.set("content", JSON.stringify([{ tag: "p", children: [JSON.stringify({ messages })] }]));
  form.set("return_content", "true");
  try {
    const response = await fetch(TELEGRAPH_EDIT_URL, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
    });
    const text = await response.text().catch(() => "");
    if (response.status === 429) return "pause";
    if (!response.ok) return "later";
    let payload: { ok?: boolean; error?: string } | null = null;
    try {
      payload = JSON.parse(text) as { ok?: boolean; error?: string };
    } catch {
      return "later";
    }
    if (payload?.ok === true) return "ok";
    if (/flood|retry|too many|429/i.test(String(payload?.error || ""))) return "pause";
    return "later";
  } catch {
    return "later";
  }
}

function hold(mirror: Mirror, pause: boolean) {
  const delay = pause ? PAUSE_MS : RETRY_MS;
  mirror.dirty = true;
  mirror.nextWriteAt = Date.now() + delay;
  if (pause) mirror.pauseUntil = mirror.nextWriteAt;
  saveMirror(mirror);
}

async function flush(force: boolean): Promise<void> {
  const mirror = loadMirror();
  if (Date.now() < mirror.pauseUntil) return;
  if (!mirror.dirty) return;
  if (!force && Date.now() < mirror.nextWriteAt) return;
  const remote = await fetchMessages();
  if (remote === "pause") {
    hold(loadMirror(), true);
    return;
  }
  if (remote === "down") {
    hold(loadMirror(), false);
    return;
  }
  const current = loadMirror();
  current.messages = unionMessages(remote, current.messages);
  if (!hasPending(current.messages, remote)) {
    current.dirty = false;
    saveMirror(current);
    return;
  }
  const sent = current.messages;
  const result = await writeDocument(sent);
  const latest = loadMirror();
  latest.messages = unionMessages(sent, latest.messages);
  if (result === "ok") {
    const sentKeys = new Set(sent.map((message) => messageKey(message)));
    latest.dirty = latest.messages.some((message) => {
      const key = messageKey(message);
      return Boolean(key && !sentKeys.has(key));
    });
    latest.nextWriteAt = Date.now() + (latest.dirty ? RETRY_MS : SETTLE_MS);
    saveMirror(latest);
    return;
  }
  hold(latest, result === "pause");
}

function queueFlush(force: boolean): Promise<void> {
  const run = tail.then(() => flush(force));
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readSuggestions(): Promise<SuggestionSnapshot> {
  const mirror = loadMirror();
  if (Date.now() < mirror.pauseUntil) {
    if (mirror.messages.length > 0) return snapshotFromMessages(mirror.messages);
    throw new Error("read paused");
  }
  const remote = await fetchMessages();
  if (remote === "pause") {
    const paused = loadMirror();
    paused.pauseUntil = Date.now() + PAUSE_MS;
    paused.nextWriteAt = Math.max(paused.nextWriteAt, paused.pauseUntil);
    saveMirror(paused);
    if (paused.messages.length > 0) return snapshotFromMessages(paused.messages);
    throw new Error("read 429");
  }
  if (remote === "down") {
    if (mirror.messages.length > 0) return snapshotFromMessages(mirror.messages);
    throw new Error("read failed");
  }
  const current = loadMirror();
  current.messages = unionMessages(remote, current.messages);
  const pending = hasPending(current.messages, remote);
  current.dirty = pending;
  saveMirror(current);
  if (pending && Date.now() >= current.nextWriteAt && Date.now() >= current.pauseUntil) {
    await queueFlush(false);
  }
  return snapshotFromMessages(loadMirror().messages);
}

function messageBody(item: Suggestion): string {
  const encoder = new TextEncoder();
  let text = item.text;
  let body = JSON.stringify({ ...item, text });
  while (encoder.encode(body).length > 3800 && text.length > 40) {
    text = text.slice(0, text.length - 40);
    body = JSON.stringify({ ...item, text });
  }
  return body;
}

export async function appendSuggestion(item: Suggestion): Promise<SuggestionSnapshot> {
  const added = remember(JSON.parse(messageBody(item)) as Suggestion);
  if (added && Date.now() >= loadMirror().pauseUntil) await queueFlush(true);
  return snapshotFromMessages(loadMirror().messages);
}

export async function deleteSuggestion(id: string): Promise<SuggestionSnapshot> {
  if (!id.trim()) throw new Error("missing id");
  const added = remember({ id, deleted: true });
  if (added && Date.now() >= loadMirror().pauseUntil) await queueFlush(true);
  return snapshotFromMessages(loadMirror().messages);
}

export async function markSuggestionDone(id: string): Promise<SuggestionSnapshot> {
  if (!id.trim()) throw new Error("missing id");
  const current = snapshotFromMessages(loadMirror().messages);
  const removed = removedIdSet(current.deletedIds);
  if (removed.has(id) || removed.has(id.trim())) return current;
  const added = remember({ id, done: true });
  if (added && Date.now() >= loadMirror().pauseUntil) await queueFlush(true);
  return snapshotFromMessages(loadMirror().messages);
}
