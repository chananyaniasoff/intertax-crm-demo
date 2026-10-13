/**
 * TEMPORARY review-only suggestion store. Not part of the CRM.
 * Delete demo-web/src/temp-suggestions, demo-web/public/suggestions.html,
 * and the SuggestionLayer mount in main.tsx to remove this layer.
 *
 * The crudcrud collection used before this answers every read and write with
 * 400 "Endpoint has exceeded allowed number of requests (100)." jsonblob.com
 * still blocks browser writes from this network with Cloudflare.
 *
 * The shared log is one public ntfy.sh topic. A save POSTs one message. It
 * never replaces the whole list, so two people adding at once cannot wipe
 * each other. ntfy.sh public topics cannot delete or edit one cached message
 * without auth, so a delete POSTs a tombstone `{ "id": "<same id>", "deleted":
 * true }` and a done mark POSTs `{ "id": "<same id>", "done": true }`. Both
 * leave every other message in place. Readers skip an id once any tombstone
 * names it. Readers treat the latest done flag for that id as its done state,
 * and a tombstone still wins over done. ntfy.sh keeps each message for 12
 * hours and does not require an account. The topic name is a public resource
 * id, not an API secret. Do not put private client data in a suggestion.
 *
 * A POST often returns HTTP 200 before GET /json?poll=1&since=all includes
 * that message (about two seconds on the public server). Re-posting while the
 * cache catches up burns the anonymous daily message cap (250) and the
 * request bucket (60, then one every 5 seconds). Post once. Poll the read a
 * couple of times. If the POST succeeded and the read is still behind, merge
 * that one message into the local snapshot instead of failing the save.
 *
 * KEEP THE URL IN SYNC with demo-web/public/suggestions.html.
 * Poll about every 30s. The demo page and the inbox poll separately.
 */

export const SUGGESTION_TOPIC_URL = "https://ntfy.sh/intertax-crm-demo-sug-7f3a9c2e4b81";

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

function suggestionsFromTopic(text: string): SuggestionSnapshot {
  const ntfyDeleted = new Set<string>();
  const tombstones = new Set<string>();
  const doneFlags = new Map<string, boolean>();
  const messages: { id: string; body: string; time: number; index: number }[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!event || typeof event !== "object") continue;
    const record = event as Record<string, unknown>;
    if (record.event === "message_delete" && typeof record.sequence_id === "string") {
      ntfyDeleted.add(record.sequence_id);
      continue;
    }
    if (record.event !== "message" || typeof record.message !== "string") continue;
    messages.push({
      id: typeof record.id === "string" ? record.id : "",
      body: record.message,
      time: typeof record.time === "number" ? record.time : 0,
      index: messages.length,
    });
  }
  messages.sort((a, b) => a.time - b.time || a.index - b.index);
  const byId = new Map<string, Suggestion>();
  for (const message of messages) {
    if (ntfyDeleted.has(message.id)) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(message.body);
    } catch {
      continue;
    }
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

function clipError(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export async function readSuggestions(): Promise<SuggestionSnapshot> {
  const response = await fetch(`${SUGGESTION_TOPIC_URL}/json?poll=1&since=all`, {
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) {
    const detail = clipError(await response.text().catch(() => ""));
    throw new Error(`read ${response.status}${detail ? ` ${detail}` : ""}`);
  }
  return suggestionsFromTopic(await response.text());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

async function postMessage(body: string): Promise<void> {
  let lastError: Error = new Error("write failed");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(SUGGESTION_TOPIC_URL, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "text/plain; charset=UTF-8" },
        body,
      });
      const text = await response.text().catch(() => "");
      if (response.ok) return;
      const detail = clipError(text);
      lastError = new Error(`write ${response.status}${detail ? ` ${detail}` : ""}`);
      await sleep(response.status === 429 ? 6000 : 1000 * (attempt + 1));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("write failed");
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

async function pollSnapshot(
  ready: (snapshot: SuggestionSnapshot) => boolean,
): Promise<SuggestionSnapshot | null> {
  let last: SuggestionSnapshot | null = null;
  const pauses = [2200, 1500];
  for (const pause of pauses) {
    await sleep(pause);
    try {
      last = await readSuggestions();
      if (ready(last)) return last;
    } catch {
      /* A rate-limited read must not undo a POST that already returned 200. */
    }
  }
  return last;
}

function emptySnapshot(): SuggestionSnapshot {
  return { suggestions: [], deletedIds: [], doneIds: [] };
}

function hasId(ids: string[], id: string): boolean {
  return ids.includes(id) || ids.includes(id.trim());
}

export async function appendSuggestion(item: Suggestion): Promise<SuggestionSnapshot> {
  try {
    const current = await readSuggestions();
    if (current.suggestions.some((suggestion) => suggestion.id === item.id)) return current;
  } catch {
    /* Still try the write. A failed read is not proof the note is missing. */
  }
  await postMessage(messageBody(item));
  const confirmed = await pollSnapshot((snapshot) =>
    snapshot.suggestions.some((suggestion) => suggestion.id === item.id),
  );
  if (confirmed?.suggestions.some((suggestion) => suggestion.id === item.id)) return confirmed;
  const base = confirmed ?? emptySnapshot();
  return {
    suggestions: mergeSuggestions(base.suggestions, [item], base.deletedIds),
    deletedIds: base.deletedIds,
    doneIds: base.doneIds,
  };
}

export async function deleteSuggestion(id: string): Promise<SuggestionSnapshot> {
  if (!id.trim()) throw new Error("missing id");
  try {
    const current = await readSuggestions();
    const marked = hasId(current.deletedIds, id);
    const present = current.suggestions.some((suggestion) => suggestion.id === id);
    if (marked && !present) return current;
  } catch {
    /* Post the tombstone even if the latest read was rate-limited. */
  }
  await postMessage(JSON.stringify({ id, deleted: true }));
  const confirmed = await pollSnapshot((snapshot) => {
    const gone = !snapshot.suggestions.some((suggestion) => suggestion.id === id);
    return gone && hasId(snapshot.deletedIds, id);
  });
  if (
    confirmed &&
    hasId(confirmed.deletedIds, id) &&
    !confirmed.suggestions.some((suggestion) => suggestion.id === id)
  ) {
    return confirmed;
  }
  const base = confirmed ?? emptySnapshot();
  const deletedIds = hasId(base.deletedIds, id) ? base.deletedIds : [...base.deletedIds, id];
  return {
    suggestions: base.suggestions.filter((suggestion) => suggestion.id !== id),
    deletedIds,
    doneIds: base.doneIds.filter((doneId) => doneId !== id && doneId.trim() !== id.trim()),
  };
}

export async function markSuggestionDone(id: string): Promise<SuggestionSnapshot> {
  if (!id.trim()) throw new Error("missing id");
  try {
    const current = await readSuggestions();
    if (hasId(current.deletedIds, id)) return current;
    if (hasId(current.doneIds, id)) return current;
  } catch {
    /* Post the done mark even if the latest read was rate-limited. */
  }
  await postMessage(JSON.stringify({ id, done: true }));
  const confirmed = await pollSnapshot(
    (snapshot) => hasId(snapshot.deletedIds, id) || hasId(snapshot.doneIds, id),
  );
  if (confirmed && (hasId(confirmed.deletedIds, id) || hasId(confirmed.doneIds, id))) return confirmed;
  const base = confirmed ?? emptySnapshot();
  if (hasId(base.deletedIds, id)) return base;
  return {
    ...base,
    doneIds: hasId(base.doneIds, id) ? base.doneIds : [...base.doneIds, id],
  };
}
