/**
 * TEMPORARY review-only overlay. Not part of the CRM.
 * Coworkers can pin Hebrew suggestions, mark one done, and delete one at a time.
 * They cannot edit CRM fields here.
 */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ANONYMOUS_AUTHOR,
  appendSuggestion,
  deleteSuggestion,
  markSuggestionDone,
  mergeSuggestions,
  readSuggestions,
  type Suggestion,
  type SuggestionSnapshot,
} from "./store";
import "./suggestions.css";

const AUTHOR_KEY = "intertax-demo-suggestion-author";

type Draft = {
  xPct: number;
  yPct: number;
  anchor: string;
  clientX: number;
  clientY: number;
};

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sug-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function meaningful(value: string): boolean {
  return value.replace(/[\s\u2010-\u2015\u2212._·|:–—-]+/g, "").length >= 2;
}

function directText(element: HTMLElement): string {
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent || "";
  }
  return text.replace(/\s+/g, " ").trim();
}

function tableAnchor(start: HTMLElement): string {
  const cell = start.closest("td, th");
  if (!(cell instanceof HTMLTableCellElement)) return "";
  const row = cell.closest("tr");
  if (!row) return "";
  const cells = [...row.cells];
  const index = cells.indexOf(cell);
  const headerText = cell.closest("table")?.querySelectorAll("thead th")[index]?.textContent || "";
  const name = clip(cells[0]?.textContent || "", 40);
  const header = clip(headerText, 40);
  const bits = [name, header].filter((bit, bitIndex, all) => meaningful(bit) && all.indexOf(bit) === bitIndex);
  if (bits.length > 0) return clip(bits.join(" · "), 80);
  const rowText = clip(row.innerText || "", 80);
  return meaningful(rowText) ? rowText : "";
}

function anchorFrom(start: HTMLElement | null): string {
  if (!start) return "";
  const fromTable = tableAnchor(start);
  if (fromTable) return fromTable;
  let element: HTMLElement | null = start;
  for (let depth = 0; depth < 8 && element; depth += 1) {
    if (element === document.body || element === document.documentElement) break;
    const aria = element.getAttribute("aria-label")?.trim() || "";
    if (meaningful(aria)) return clip(aria, 80);
    const placeholder =
      "placeholder" in element ? String((element as HTMLInputElement).placeholder || "").trim() : "";
    if (meaningful(placeholder)) return clip(placeholder, 80);
    const own = directText(element);
    if (meaningful(own) && own.length <= 80) return own;
    element = element.parentElement;
  }
  const fallback = clip(start.innerText || start.textContent || "", 80);
  return meaningful(fallback) ? fallback : "";
}

function readAnchor(clientX: number, clientY: number): string {
  const root = document.querySelector("[data-suggestion-root]") as HTMLElement | null;
  if (root) root.style.visibility = "hidden";
  const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (root) root.style.visibility = "";
  return anchorFrom(hit);
}

function composerStyle(draft: Draft): CSSProperties {
  const width = Math.min(320, window.innerWidth - 16);
  const left = Math.min(Math.max(8, draft.clientX - width / 2), window.innerWidth - width - 8);
  const top =
    draft.clientY > window.innerHeight - 280
      ? Math.max(8, draft.clientY - 280)
      : Math.min(draft.clientY + 14, window.innerHeight - 280);
  return { left, top };
}

export function SuggestionLayer() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [doneError, setDoneError] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const removedIdsRef = useRef(new Set<string>());
  const pendingDoneRef = useRef(new Set<string>());

  const markedDone = (id: string) => doneIds.has(id) || doneIds.has(id.trim());

  const absorb = (snapshot: SuggestionSnapshot) => {
    for (const id of snapshot.deletedIds) {
      removedIdsRef.current.add(id);
      pendingDoneRef.current.delete(id);
    }
    const nextDone = new Set<string>();
    for (const id of snapshot.doneIds) nextDone.add(id);
    for (const id of pendingDoneRef.current) nextDone.add(id);
    for (const id of removedIdsRef.current) nextDone.delete(id);
    setDoneIds(nextDone);
    setSuggestions((current) => mergeSuggestions(current, snapshot.suggestions, removedIdsRef.current));
  };

  const expandSuggestion = (id: string) => {
    setActiveId(id);
    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const collapseSuggestion = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    try {
      setAuthor(localStorage.getItem(AUTHOR_KEY) || "");
    } catch {
      /* The name is optional. The shared list does not depend on localStorage. */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void readSuggestions()
        .then((next) => {
          if (cancelled) return;
          absorb(next);
          setLoadError(null);
        })
        .catch(() => {
          if (!cancelled) setLoadError("לא הצלחנו לטעון את ההצעות.");
        });
    };
    load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  useEffect(() => {
    if (!adding && !draft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      setAdding(false);
      setText("");
      setSaveError(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [adding, draft]);

  useEffect(() => {
    if (!activeId || !panelOpen) return;
    document.querySelector(`[data-suggestion-id="${activeId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId, panelOpen, suggestions]);

  const placeAt = (clientX: number, clientY: number) => {
    const xPct = Math.round((clientX / window.innerWidth) * 10000) / 100;
    const yPct = Math.round((clientY / window.innerHeight) * 10000) / 100;
    setDraft({
      xPct,
      yPct,
      anchor: readAnchor(clientX, clientY),
      clientX,
      clientY,
    });
    setText("");
    setSaveError(null);
    setPanelOpen(false);
  };

  const cancelDraft = () => {
    setDraft(null);
    setText("");
    setSaveError(null);
  };

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    const suggestionText = text.trim();
    if (!suggestionText) return;
    const authorName = author.trim() || ANONYMOUS_AUTHOR;
    const item: Suggestion = {
      id: newId(),
      createdAt: new Date().toISOString(),
      author: authorName,
      text: suggestionText,
      xPct: draft.xPct,
      yPct: draft.yPct,
      anchor: draft.anchor,
    };
    setSaving(true);
    setSaveError(null);
    void appendSuggestion(item)
      .then((next) => {
        absorb(next);
        if (author.trim()) {
          try {
            localStorage.setItem(AUTHOR_KEY, author.trim());
          } catch {
            /* Ignore. The suggestion itself is already in the shared store. */
          }
        }
        setDraft(null);
        setText("");
        setAdding(false);
        setPanelOpen(true);
        setActiveId(item.id);
      })
      .catch(() => {
        setSaveError("לא הצלחנו לשמור את ההצעה. נסו שוב.");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const onDelete = (id: string) => {
    if (deletingId || markingId) return;
    if (!window.confirm("למחוק את ההצעה?")) return;
    removedIdsRef.current.add(id);
    pendingDoneRef.current.delete(id);
    setDoneIds((current) => {
      const next = new Set(current);
      next.delete(id);
      next.delete(id.trim());
      return next;
    });
    setSuggestions((current) => current.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
    setDeletingId(id);
    setDeleteError(null);
    void deleteSuggestion(id)
      .then((next) => {
        absorb(next);
      })
      .catch(() => {
        removedIdsRef.current.delete(id);
        setDeleteError("לא הצלחנו למחוק את ההצעה. נסו שוב.");
        void readSuggestions()
          .then((next) => {
            absorb(next);
          })
          .catch(() => {
            /* The message above already explains the failed delete. */
          });
      })
      .finally(() => {
        setDeletingId((current) => (current === id ? null : current));
      });
  };

  const onDone = (id: string) => {
    if (deletingId || markingId || markedDone(id)) return;
    pendingDoneRef.current.add(id);
    setDoneIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    collapseSuggestion(id);
    setMarkingId(id);
    setDoneError(null);
    void markSuggestionDone(id)
      .then((next) => {
        absorb(next);
      })
      .catch(() => {
        pendingDoneRef.current.delete(id);
        setDoneIds((current) => {
          const next = new Set(current);
          next.delete(id);
          next.delete(id.trim());
          return next;
        });
        setDoneError("לא הצלחנו לסמן את ההצעה כבוצעה. נסו שוב.");
      })
      .finally(() => {
        setMarkingId((current) => (current === id ? null : current));
      });
  };

  const tree = (
    <div className="itx-sug-root" lang="he" dir="rtl" data-suggestion-root>
      {(adding || draft) && (
        <div
          className="itx-sug-shield"
          onClick={(event) => {
            if (draft || saving) return;
            placeAt(event.clientX, event.clientY);
          }}
        />
      )}
      {(adding || draft) && (
        <div className="itx-sug-banner">
          {draft
            ? "מלאו את ההצעה. הלחיצה הזו לא משנה את המערכת."
            : "לחצו על המקום בדף שאליו ההצעה מתייחסת"}
        </div>
      )}
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.id}
          type="button"
          className={[
            "itx-sug-pin",
            suggestion.id === activeId ? "is-active" : "",
            markedDone(suggestion.id) ? "is-done" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ left: `${suggestion.xPct}%`, top: `${suggestion.yPct}%` }}
          title={`${suggestion.author}: ${suggestion.text}`}
          onClick={(event) => {
            event.stopPropagation();
            setActiveId(suggestion.id);
            setPanelOpen(true);
          }}
        >
          {index + 1}
        </button>
      ))}
      {draft && (
        <form className="itx-sug-composer" style={composerStyle(draft)} onSubmit={onSave}>
          <h2>הצעה חדשה</h2>
          <p className="itx-sug-meta">
            {draft.anchor ? `ליד: ${draft.anchor}` : "בלי טקסט קרוב"}
            {` · ${Math.round(draft.xPct)}% לרוחב, ${Math.round(draft.yPct)}% לגובה`}
          </p>
          <label>
            שם
            <input
              value={author}
              maxLength={60}
              placeholder="לא חובה"
              autoComplete="name"
              disabled={saving}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </label>
          <label>
            ההצעה
            <textarea
              value={text}
              maxLength={2000}
              required
              rows={4}
              placeholder="מה כדאי לשנות או להוסיף?"
              disabled={saving}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {saveError && <p className="itx-sug-error">{saveError}</p>}
          <div className="itx-sug-actions">
            <button className="itx-sug-btn" type="submit" disabled={saving || !text.trim()}>
              {saving ? "שומר…" : "שמירה"}
            </button>
            <button className="itx-sug-btn secondary" type="button" disabled={saving} onClick={cancelDraft}>
              ביטול
            </button>
          </div>
        </form>
      )}
      <div className="itx-sug-dock">
        <button
          type="button"
          className={adding || draft ? "itx-sug-btn is-on" : "itx-sug-btn"}
          onClick={() => {
            if (adding || draft) {
              cancelDraft();
              setAdding(false);
              return;
            }
            setAdding(true);
            setPanelOpen(false);
          }}
        >
          {adding || draft ? "ביטול הוספה" : "הוספת הצעה"}
        </button>
        <button
          type="button"
          className="itx-sug-btn secondary"
          onClick={() => setPanelOpen((open) => !open)}
        >
          {panelOpen ? "סגירת הרשימה" : `ההצעות (${suggestions.length})`}
        </button>
      </div>
      {panelOpen && (
        <aside className="itx-sug-panel" aria-label="הצעות">
          <h2>הצעות</h2>
          <p className="itx-sug-note">
            שכבה זמנית. מכאן מוסיפים הערות בלבד — אי אפשר לערוך את המערכת. «בוצע» מצמצם את
            ההצעה לשורה אצל כולם, ואפשר להרחיב אותה שוב. מחיקה מסירה את ההצעה מהרשימה המשותפת.
          </p>
          {loadError && (
            <p className="itx-sug-error">
              {loadError}{" "}
              <button
                type="button"
                className="itx-sug-text-btn"
                onClick={() => {
                  void readSuggestions()
                    .then((next) => {
                      absorb(next);
                      setLoadError(null);
                    })
                    .catch(() => setLoadError("לא הצלחנו לטעון את ההצעות."));
                }}
              >
                רענון
              </button>
            </p>
          )}
          {deleteError && <p className="itx-sug-error">{deleteError}</p>}
          {doneError && <p className="itx-sug-error">{doneError}</p>}
          {suggestions.length === 0 ? (
            <p className="itx-sug-empty">אין עדיין הצעות. לחצו על «הוספת הצעה» ואז על מקום בדף.</p>
          ) : (
            <ol className="itx-sug-list">
              {suggestions.map((suggestion, index) => {
                const done = markedDone(suggestion.id);
                const open = !done || expandedIds.has(suggestion.id);
                const itemClass = [
                  "itx-sug-item",
                  suggestion.id === activeId ? "is-active" : "",
                  done ? "is-done" : "",
                  done && !open ? "is-collapsed" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const deleteButton = (
                  <button
                    type="button"
                    className="itx-sug-delete"
                    disabled={deletingId !== null || markingId !== null}
                    onClick={() => onDelete(suggestion.id)}
                  >
                    {deletingId === suggestion.id ? "מוחק…" : "מחיקה"}
                  </button>
                );
                if (done && !open) {
                  return (
                    <li key={suggestion.id}>
                      <div className={itemClass} data-suggestion-id={suggestion.id}>
                        <div className="itx-sug-collapsed-row">
                          <button
                            type="button"
                            className="itx-sug-line"
                            aria-expanded={false}
                            onClick={() => expandSuggestion(suggestion.id)}
                          >
                            <span className="itx-sug-num">{index + 1}</span>
                            <span className="itx-sug-author">{suggestion.author}</span>
                          </button>
                          <p className="itx-sug-line-text">{suggestion.text}</p>
                          <button
                            type="button"
                            className="itx-sug-mini"
                            onClick={() => expandSuggestion(suggestion.id)}
                          >
                            הרחבה
                          </button>
                          {deleteButton}
                        </div>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={suggestion.id}>
                    <div className={itemClass} data-suggestion-id={suggestion.id}>
                      <div className="itx-sug-item-main">
                        <button
                          type="button"
                          className="itx-sug-item-head"
                          aria-expanded={done ? true : undefined}
                          onClick={() => {
                            if (done) collapseSuggestion(suggestion.id);
                            else setActiveId(suggestion.id);
                          }}
                        >
                          <span className="itx-sug-num">{index + 1}</span>
                          <span className="itx-sug-author">{suggestion.author}</span>
                          <time className="itx-sug-time" dateTime={suggestion.createdAt}>
                            {formatTime(suggestion.createdAt)}
                          </time>
                        </button>
                        <p className="itx-sug-text">{suggestion.text}</p>
                        <p className="itx-sug-meta">
                          {suggestion.anchor ? `ליד: ${suggestion.anchor}` : "בלי טקסט קרוב"}
                          {` · ${Math.round(suggestion.xPct)}% לרוחב, ${Math.round(suggestion.yPct)}% לגובה`}
                        </p>
                      </div>
                      <div className="itx-sug-item-actions">
                        {done ? (
                          <button
                            type="button"
                            className="itx-sug-mini"
                            onClick={() => collapseSuggestion(suggestion.id)}
                          >
                            צמצום
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="itx-sug-done"
                            disabled={markingId !== null || deletingId !== null}
                            onClick={() => onDone(suggestion.id)}
                          >
                            {markingId === suggestion.id ? "מסמן…" : "בוצע"}
                          </button>
                        )}
                        {deleteButton}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="itx-sug-links">
            <a href={`${import.meta.env.BASE_URL}suggestions.html`} target="_blank" rel="noopener noreferrer">
              רשימת ההצעות
            </a>
          </div>
        </aside>
      )}
    </div>
  );

  return createPortal(tree, document.body);
}
