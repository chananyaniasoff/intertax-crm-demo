import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

export type { CSSProperties };
export { useEffect, useMemo, useRef, useState } from "react";

/**
 * Cursor light host tokens, copied from the canvas runtime
 * (`canvasPaletteLight` + `categoryPaletteLight` + `chartPalette`).
 * The CRM canvas paints Overview with these tokens (headings, dividers,
 * buttons, links) and lays its no-grey blue chrome on top.
 */
const theme = {
  kind: "light",
  brand: "cursor" as const,
  bg: {
    editor: "#FCFCFC",
    chrome: "#F8F8F8",
    elevated: "#FCFCFC",
  },
  text: {
    primary: "#141414",
    secondary: "#141414BD",
    tertiary: "#14141499",
    quaternary: "#1414145C",
    link: "#2778C1",
    onAccent: "#FCFCFC",
  },
  stroke: {
    primary: "#14141433",
    secondary: "#1414141F",
    tertiary: "#14141414",
    focused: "#2778C1",
  },
  fill: {
    primary: "#14141433",
    secondary: "#14141424",
    tertiary: "#14141414",
    quaternary: "#1414140F",
  },
  accent: {
    primary: "#2778C1",
    control: "#2778C1",
    controlHover: "#256EB0",
  },
  diff: {
    insertedLine: "#00AF6624",
    removedLine: "#FF617B38",
    stripAdded: "#007041CC",
    stripRemoved: "#BE1744CC",
  },
  category: {
    gray: "#14141499",
    purple: "#7565CC",
    green: "#007041",
    yellow: "#A46700",
    cyan: "#176C74",
    pink: "#92156A",
    blue: "#2778C1",
    orange: "#C93714",
    red: "#BE1744",
  },
  palette: {
    foreground: "#141414",
    foregroundSecondary: "#141414BD",
    foregroundTertiary: "#14141499",
    foregroundQuaternary: "#1414145C",
    editor: "#FCFCFC",
    chrome: "#F8F8F8",
    sidebar: "#F3F3F3",
    elevated: "#FCFCFC",
    fillPrimary: "#14141433",
    fillSecondary: "#14141424",
    fillTertiary: "#14141414",
    fillQuaternary: "#1414140F",
    strokePrimary: "#14141433",
    strokeSecondary: "#1414141F",
    strokeTertiary: "#14141414",
    strokeFocused: "#2778C1",
    accent: "#2778C1",
    buttonBackground: "#2778C1",
    buttonForeground: "#FCFCFC",
    buttonHoverBackground: "#256EB0",
    link: "#2778C1",
    diffInsertedLine: "#00AF6624",
    diffRemovedLine: "#FF617B38",
    diffStripAdded: "#007041CC",
    diffStripRemoved: "#BE1744CC",
  },
  radius: { none: 0, xs: 2, sm: 4, md: 6, lg: 8, xl: 12, full: 9999 },
  typography: {
    fontFamily: "inherit",
    h1: { fontSize: "24px", lineHeight: "30px", fontWeight: 590 },
    h2: { fontSize: "18px", lineHeight: "24px", fontWeight: 590 },
    h3: { fontSize: "16px", lineHeight: "22px", fontWeight: 590 },
    body: { fontSize: "14px", lineHeight: "20px", fontWeight: 400 },
    small: { fontSize: "12px", lineHeight: "16px", fontWeight: 400 },
  },
  chart: {
    palette: {
      green: "#1F8A65E8",
      darkGreen: "#0D855AE0",
      lightGreen: "#52B896E0",
      mintGreen: "#7DCAB0E0",
      blue: "#2E79B5E0",
      lightBlue: "#70B0D8E0",
      indigo: "#5A6CC0F0",
      lightIndigo: "#9AAADCE0",
      purple: "#7B64B8F0",
      lightPurple: "#AA98D8E0",
      warmPink: "#C85898E0",
      lightPink: "#E8A0C4E0",
      brightOrange: "#F0A040E0",
      deepOrange: "#C06028E0",
      goldenYellow: "#E8C030E0",
      darkAmber: "#C04848E0",
      warmPeach: "#F0A088E0",
      vibrantTeal: "#2A9A8AE0",
      muted: "#8888A8E0",
      neutralLine: "#888899D0",
    },
    sequence: [
      "#1F8A65E8",
      "#70B0D8E0",
      "#5A6CC0F0",
      "#F0A040E0",
      "#C06028E0",
      "#E8C030E0",
      "#C85898E0",
      "#F0A088E0",
      "#7B64B8F0",
      "#7DCAB0E0",
      "#8888A8E0",
      "#2A9A8AE0",
    ],
  },
};

const themeWithTokens = { ...theme, tokens: theme };

export function useHostTheme() {
  return themeWithTokens;
}

export type SetCanvasState<T> = (action: T | ((prev: T) => T)) => void;

/**
 * Cursor's useCanvasState is one store per key. The Time clock sidebar and the
 * Time clock panel (and Billing, and other tabs) each call it with the same
 * key. Separate useState copies never see each other's clicks.
 */
type CanvasListener = () => void;
const canvasValues = new Map<string, unknown>();
const canvasListeners = new Map<string, Set<CanvasListener>>();
const canvasSubscribe = new Map<string, (listener: CanvasListener) => () => void>();
const canvasSnapshot = new Map<string, () => unknown>();

function canvasStorageKey(key: string) {
  return `intertax-crm-demo:${key}`;
}

function readCanvasValue<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(canvasStorageKey(key));
    if (raw == null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function listenersFor(key: string) {
  let listeners = canvasListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    canvasListeners.set(key, listeners);
  }
  return listeners;
}

function subscribeCanvas(key: string) {
  let subscribe = canvasSubscribe.get(key);
  if (!subscribe) {
    subscribe = (listener: CanvasListener) => {
      const listeners = listenersFor(key);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    };
    canvasSubscribe.set(key, subscribe);
  }
  return subscribe;
}

function snapshotCanvas(key: string) {
  let snapshot = canvasSnapshot.get(key);
  if (!snapshot) {
    snapshot = () => canvasValues.get(key);
    canvasSnapshot.set(key, snapshot);
  }
  return snapshot;
}

function publishCanvas(key: string, next: unknown) {
  if (Object.is(canvasValues.get(key), next)) return;
  canvasValues.set(key, next);
  try {
    localStorage.setItem(canvasStorageKey(key), JSON.stringify(next));
  } catch {
    /* quota — every subscriber still sees the click */
  }
  listenersFor(key).forEach((listener) => listener());
}

export function useCanvasState<T>(key: string, defaultValue: T): [T, SetCanvasState<T>] {
  if (!canvasValues.has(key)) {
    canvasValues.set(key, readCanvasValue(key, defaultValue));
  }
  const value = useSyncExternalStore(
    subscribeCanvas(key),
    snapshotCanvas(key),
    snapshotCanvas(key),
  ) as T;
  const set = useCallback<SetCanvasState<T>>((action) => {
    const prev = canvasValues.get(key) as T;
    const next = typeof action === "function" ? (action as (prev: T) => T)(prev) : action;
    publishCanvas(key, next);
  }, [key]);
  return [value, set];
}

export function useCanvasAction(): (action: unknown) => void {
  return () => {};
}

export function mergeStyle(base: CSSProperties, override?: CSSProperties): CSSProperties {
  return { ...base, ...override };
}

export type StackProps = { children?: ReactNode; gap?: number; style?: CSSProperties };
export function Stack({ children, gap = 0, style }: StackProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0, ...style }}>
      {children}
    </div>
  );
}

export type RowProps = {
  children?: ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
  wrap?: boolean;
  style?: CSSProperties;
};
const flexAlign = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" } as const;
export function Row({ children, gap = 0, align = "stretch", justify = "start", wrap, style }: RowProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap,
        alignItems: flexAlign[align],
        justifyContent: justify === "start" ? "flex-start" : justify === "end" ? "flex-end" : justify,
        flexWrap: wrap ? "wrap" : undefined,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type GridProps = {
  children?: ReactNode;
  columns: number | string;
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  style?: CSSProperties;
};
export function Grid({ children, columns, gap = 0, align = "stretch", style }: GridProps) {
  const template = typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns;
  return (
    <div style={{ display: "grid", gridTemplateColumns: template, gap, alignItems: flexAlign[align], ...style }}>
      {children}
    </div>
  );
}

export function Divider({ style }: { style?: CSSProperties }) {
  return (
    <hr
      style={{
        width: "100%",
        border: "none",
        borderTop: `1px solid ${theme.stroke.tertiary}`,
        margin: 0,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function Spacer() {
  return <div style={{ flex: 1, minWidth: 0 }} />;
}

export type TableColumnAlign = "left" | "center" | "right";
export type TableRowTone = "success" | "danger" | "warning" | "info" | "neutral";
export type TableProps = {
  headers: ReactNode[];
  rows: ReactNode[][];
  columnAlign?: Array<TableColumnAlign | undefined>;
  rowTone?: Array<TableRowTone | undefined>;
  framed?: boolean;
  striped?: boolean;
  stickyHeader?: boolean;
  style?: CSSProperties;
  emptyMessage?: ReactNode;
};
const toneColor: Record<string, string> = {
  success: theme.chart.palette.lightGreen,
  danger: theme.chart.palette.darkAmber,
  warning: theme.chart.palette.brightOrange,
  info: theme.chart.palette.lightBlue,
  neutral: theme.chart.palette.muted,
};
export function Table({
  headers,
  rows,
  columnAlign,
  rowTone,
  framed = true,
  striped,
  stickyHeader,
  style,
  emptyMessage = "No rows.",
}: TableProps) {
  const cellPad = "8px 12px";
  const align = (index: number) => columnAlign?.[index] ?? "left";
  const table = (
    <table
      style={{
        minWidth: "100%",
        borderCollapse: stickyHeader ? "separate" : "collapse",
        borderSpacing: stickyHeader ? 0 : undefined,
        tableLayout: "auto",
        fontSize: theme.typography.body.fontSize,
        lineHeight: theme.typography.body.lineHeight,
        fontFamily: theme.typography.fontFamily,
        color: theme.text.primary,
        ...(!framed ? style : undefined),
      }}
    >
      <thead style={{ background: stickyHeader ? undefined : theme.fill.quaternary }}>
        <tr>
          {headers.map((header, i) => (
            <th
              key={i}
              scope="col"
              style={{
                padding: cellPad,
                textAlign: align(i),
                fontWeight: 600,
                color: theme.text.primary,
                borderBottom: `1px solid ${theme.stroke.secondary}`,
                position: stickyHeader ? "sticky" : undefined,
                top: stickyHeader ? 0 : undefined,
                zIndex: stickyHeader ? 2 : undefined,
                backgroundColor: stickyHeader ? theme.bg.editor : undefined,
                backgroundImage: stickyHeader
                  ? `linear-gradient(${theme.fill.quaternary}, ${theme.fill.quaternary})`
                  : undefined,
              }}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={Math.max(headers.length, 1)}
              style={{
                padding: cellPad,
                textAlign: align(0),
                verticalAlign: "top",
                color: theme.text.secondary,
                borderBottom: `1px solid ${theme.stroke.tertiary}`,
              }}
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row, r) => (
            <tr
              key={r}
              style={{
                borderBottom: r < rows.length - 1 ? `1px solid ${theme.stroke.tertiary}` : undefined,
                background: striped && r % 2 === 1 ? theme.fill.quaternary : undefined,
              }}
            >
              {headers.map((_, c) => {
                const marker = c === 0 ? rowTone?.[r] : undefined;
                const content = row[c] ?? null;
                return (
                  <td key={c} style={{ padding: cellPad, textAlign: align(c), verticalAlign: "top" }}>
                    {marker ? (
                      <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6, minWidth: 0, maxWidth: "100%" }}>
                        <span
                          aria-hidden
                          style={{
                            width: 6,
                            height: 6,
                            marginTop: 7,
                            borderRadius: "50%",
                            background: toneColor[marker] ?? toneColor.neutral,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ minWidth: 0, flex: 1 }}>{content}</span>
                      </span>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
  if (!framed) return table;
  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        border: `1px solid ${theme.stroke.tertiary}`,
        borderRadius: theme.radius.lg,
        background: theme.bg.editor,
        overflowX: "auto",
        overflowY: stickyHeader ? "auto" : "clip",
        ...style,
      }}
    >
      {table}
    </div>
  );
}

const textTone = {
  primary: theme.text.primary,
  secondary: theme.text.secondary,
  tertiary: theme.text.tertiary,
  quaternary: theme.text.quaternary,
} as const;
const textWeight = { normal: 400, medium: 500, semibold: 590, bold: 650 } as const;
export type TextProps = {
  children?: ReactNode;
  tone?: keyof typeof textTone;
  size?: "body" | "small";
  as?: "p" | "span";
  weight?: keyof typeof textWeight;
  italic?: boolean;
  truncate?: boolean | "start" | "end";
  style?: CSSProperties;
};
export function Text({ children, tone = "primary", size = "body", as, weight = "normal", italic, truncate, style }: TextProps) {
  const Tag = as ?? "p";
  return (
    <Tag
        style={{
          margin: 0,
          color: textTone[tone],
          fontFamily: theme.typography.fontFamily,
          fontSize: size === "small" ? theme.typography.small.fontSize : theme.typography.body.fontSize,
          lineHeight: size === "small" ? theme.typography.small.lineHeight : theme.typography.body.lineHeight,
          fontWeight: textWeight[weight],
        fontStyle: italic ? "italic" : undefined,
        overflow: truncate ? "hidden" : undefined,
        textOverflow: truncate ? "ellipsis" : undefined,
        whiteSpace: truncate ? "nowrap" : undefined,
        direction: truncate === "start" ? "rtl" : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

function heading(
  tag: "h1" | "h2" | "h3",
  preset: { fontSize: string; lineHeight: string; fontWeight: number },
  children?: ReactNode,
  style?: CSSProperties,
) {
  const Tag = tag;
  return (
    <Tag
      style={{
        margin: 0,
        color: theme.text.primary,
        fontFamily: theme.typography.fontFamily,
        fontSize: preset.fontSize,
        lineHeight: preset.lineHeight,
        fontWeight: preset.fontWeight,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
export function H1({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return heading("h1", theme.typography.h1, children, style);
}
export function H2({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return heading("h2", theme.typography.h2, children, style);
}
export function H3({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return heading("h3", theme.typography.h3, children, style);
}

const cardCtx = createContext({ open: true, collapsible: false, toggle: () => {} });

export type CardProps = {
  children?: ReactNode;
  variant?: "default" | "borderless";
  size?: "base" | "lg";
  stickyHeader?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: CSSProperties;
};
export function Card({
  children,
  variant = "default",
  collapsible,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  style,
}: CardProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const toggle = () => {
    const next = !open;
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolled(next);
  };
  return (
    <cardCtx.Provider value={{ open: !collapsible || open, collapsible: Boolean(collapsible), toggle }}>
      <div
        style={{
          boxSizing: "border-box",
          background: theme.bg.editor,
          overflow: "clip",
          border: variant === "borderless" ? "none" : `1px solid ${theme.stroke.tertiary}`,
          borderRadius: variant === "borderless" ? 0 : theme.radius.lg,
          minWidth: 0,
          ...style,
        }}
      >
        {children}
      </div>
    </cardCtx.Provider>
  );
}

export function CardHeader({ children, trailing, style }: { children?: ReactNode; trailing?: ReactNode; style?: CSSProperties }) {
  const card = useContext(cardCtx);
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: "0 8px",
        fontSize: 12,
        fontFamily: theme.typography.fontFamily,
        color: theme.text.primary,
        borderBottom: `1px solid ${theme.stroke.tertiary}`,
        cursor: card.collapsible ? "pointer" : undefined,
        ...style,
      }}
      onClick={card.collapsible ? card.toggle : undefined}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {trailing}
    </div>
  );
}

export function CardBody({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const card = useContext(cardCtx);
  if (!card.open) return null;
  return (
    <div
      style={{
        boxSizing: "border-box",
        padding: 12,
        fontSize: theme.typography.small.fontSize,
        lineHeight: theme.typography.small.lineHeight,
        fontFamily: theme.typography.fontFamily,
        color: theme.text.secondary,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type PillProps = {
  children?: ReactNode;
  active?: boolean;
  tone?: string;
  size?: "sm" | "md";
  leadingContent?: ReactNode;
  keyboardHint?: string;
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
  onClick?: () => void;
};
export function Pill({ children, active = false, size = "md", leadingContent, keyboardHint, disabled, title, style, onClick }: PillProps) {
  const sm = size === "sm";
  const clickable = Boolean(onClick);
  const face: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    borderRadius: theme.radius.full,
    whiteSpace: "nowrap",
    userSelect: "none",
    fontFamily: theme.typography.fontFamily,
    fontWeight: active ? 500 : 400,
    fontSize: sm ? 10 : 12,
    lineHeight: sm ? "12px" : "14px",
    background: sm ? theme.fill.quaternary : active ? theme.fill.secondary : "transparent",
    color: active ? theme.text.primary : theme.text.secondary,
    border: sm ? "none" : `1px solid ${active ? "transparent" : theme.stroke.secondary}`,
    padding: sm ? "2px 6px" : "6px 10px",
    gap: sm ? 4 : 6,
    cursor: clickable ? (disabled ? "not-allowed" : "pointer") : "default",
    opacity: disabled ? 0.3 : 1,
    margin: 0,
    ...style,
  };
  const body = (
    <>
      {leadingContent ? <span style={{ display: "inline-flex", flexShrink: 0 }}>{leadingContent}</span> : null}
      <span style={{ flexShrink: 0 }}>{children}</span>
      {keyboardHint ? <span style={{ flexShrink: 0, color: theme.text.primary, opacity: 0.3 }}>{keyboardHint}</span> : null}
    </>
  );
  if (!clickable) {
    return (
      <span title={title} style={face}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" title={title} disabled={disabled} onClick={disabled ? undefined : onClick} style={face}>
      {body}
    </button>
  );
}

export function Stat({ value, label, tone, style }: { value: ReactNode; label: string; tone?: string; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "12px 8px", minWidth: 0, ...style }}>
      <div
        style={{
          fontSize: 24,
          lineHeight: "28px",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: tone ? toneColor[tone] ?? theme.text.primary : theme.text.primary,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: theme.typography.small.fontSize, lineHeight: theme.typography.small.lineHeight, color: theme.text.secondary }}>
        {label}
      </div>
    </div>
  );
}

export function Callout({
  children,
  tone = "info",
  title,
  icon,
  style,
}: {
  children?: ReactNode;
  tone?: string;
  title?: ReactNode;
  icon?: ReactNode;
  style?: CSSProperties;
}) {
  const color = toneColor[tone] ?? toneColor.info;
  return (
    <div
      role="note"
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        color: theme.text.primary,
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.body.fontSize,
        fontWeight: theme.typography.body.fontWeight,
        lineHeight: theme.typography.body.lineHeight,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: 12,
          height: theme.typography.body.lineHeight,
          color,
        }}
      >
        {icon ?? (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "block" }} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {title ? <div style={{ color: theme.text.primary, fontWeight: 500 }}>{title}</div> : null}
        {children != null ? <div style={{ color: theme.text.primary }}>{children}</div> : null}
      </div>
    </div>
  );
}

export type TextInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  style?: CSSProperties;
};
const fieldStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: "4px 8px",
  border: `1px solid ${theme.stroke.secondary}`,
  borderRadius: theme.radius.md,
  background: theme.fill.tertiary,
  color: theme.text.primary,
  fontFamily: theme.typography.fontFamily,
  fontSize: 13,
  lineHeight: "18px",
  letterSpacing: "0.13px",
  outline: "none",
};
export function TextInput({ value, onChange, placeholder, disabled, type = "text", style }: TextInputProps) {
  return (
    <input
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        ...fieldStyle,
        height: 28,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "text",
        ...style,
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  style?: CSSProperties;
}) {
  return (
    <textarea
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        ...fieldStyle,
        minHeight: 28,
        resize: "none",
        overflow: "hidden",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "text",
        ...style,
      }}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  style,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  style?: CSSProperties;
}) {
  const on = Boolean(checked);
  return (
    <label
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        fontSize: 13,
        lineHeight: "18px",
        color: theme.text.primary,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 14, height: 14, margin: 0 }}
      />
      <span
        aria-hidden
        style={{
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: theme.radius.sm,
          border: `1px solid ${on ? theme.accent.control : theme.stroke.primary}`,
          background: on ? theme.accent.control : theme.fill.tertiary,
          flexShrink: 0,
        }}
      >
        {on ? (
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2 5.2 4.2 7.5 8 3" stroke={theme.text.onAccent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      {label}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  size = "sm",
  style,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: CSSProperties;
}) {
  const md = size === "md";
  const trackW = md ? 36 : 28;
  const trackH = md ? 20 : 16;
  const knob = md ? 16 : 12;
  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      aria-checked={Boolean(checked)}
      onClick={() => {
        if (disabled) return;
        onChange?.(!checked);
      }}
      style={{
        width: trackW,
        height: trackH,
        borderRadius: 999,
        border: `1px solid ${checked ? theme.accent.primary : theme.stroke.primary}`,
        background: checked ? theme.accent.primary : theme.fill.tertiary,
        position: "relative",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxSizing: "border-box",
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: (trackH - knob) / 2 - 1,
          left: checked ? trackW - knob - 3 : 2,
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: theme.bg.editor,
        }}
      />
    </button>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectProps = {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
};
export function Select({ value, onChange, options, placeholder, disabled, style }: SelectProps) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      style={{
        ...fieldStyle,
        height: 28,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  style,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const primary = variant === "primary";
  const ghost = variant === "ghost";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        height: 24,
        padding: "0 6px",
        borderRadius: theme.radius.md,
        fontSize: theme.typography.body.fontSize,
        lineHeight: theme.typography.body.lineHeight,
        fontWeight: 500,
        fontFamily: theme.typography.fontFamily,
        cursor: disabled ? "not-allowed" : "pointer",
        border: "1px solid transparent",
        opacity: disabled ? 0.5 : 1,
        width: "auto",
        whiteSpace: "nowrap",
        userSelect: "none",
        boxSizing: "border-box",
        background: primary ? theme.accent.control : ghost ? "transparent" : theme.fill.secondary,
        color: primary ? theme.text.onAccent : ghost ? theme.text.secondary : theme.text.primary,
        borderColor: primary ? theme.accent.control : ghost ? "transparent" : theme.stroke.primary,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TodoItem = {
  id: string;
  content: string;
  status: TodoStatus;
};
export function TodoList({
  todos,
  onTodoClick,
}: {
  todos: TodoItem[];
  onTodoClick?: (todo: TodoItem) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {todos.map((todo) => {
        const done = todo.status === "completed" || todo.status === "cancelled";
        return (
          <button
            key={todo.id}
            type="button"
            onClick={() => onTodoClick?.(todo)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              textAlign: "start",
              border: `1px solid ${theme.stroke.secondary}`,
              background: theme.bg.elevated,
              borderRadius: 8,
              padding: "8px 10px",
              cursor: onTodoClick ? "pointer" : "default",
              font: "inherit",
              color: theme.text.primary,
              fontSize: 14,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                flexShrink: 0,
                border: `1px solid ${done ? theme.accent.primary : theme.stroke.primary}`,
                background: done ? theme.accent.primary : "transparent",
              }}
            />
            <span style={{ textDecoration: done ? "line-through" : undefined, opacity: done ? 0.7 : 1 }}>
              {todo.content}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function IconButton({
  children,
  onClick,
  disabled,
  title,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "circle";
  size?: "sm" | "md";
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: 6,
        background: "transparent",
        color: theme.text.primary,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function CollapsibleSection({
  title,
  leading,
  count,
  trailing,
  children,
  defaultOpen,
  style,
}: {
  title: string;
  leading?: ReactNode;
  count?: number;
  trailing?: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "transparent",
          color: theme.text.primary,
          font: "inherit",
          padding: "6px 0",
          cursor: "pointer",
          textAlign: "start",
        }}
      >
        <span>{open ? "▾" : "▸"}</span>
        {leading}
        <span style={{ fontWeight: 600 }}>{title}</span>
        {count != null ? <span style={{ color: theme.text.tertiary }}>{count}</span> : null}
        <span style={{ flex: 1 }} />
        {trailing}
      </button>
      {open ? <div style={{ paddingInlineStart: 18 }}>{children}</div> : null}
    </div>
  );
}

type ChartSeries = { name: string; data: number[]; tone?: string };
const seriesColor = (series: ChartSeries, index: number) =>
  (series.tone && toneColor[series.tone]) || theme.chart.sequence[index % theme.chart.sequence.length];

export function BarChart({
  categories,
  series,
  height = 220,
  style,
}: {
  categories: string[];
  series: ChartSeries[];
  height?: number;
  stacked?: boolean;
  horizontal?: boolean;
  normalized?: boolean;
  valueSuffix?: string;
  valuePrefix?: string;
  showValues?: boolean;
  style?: CSSProperties;
}) {
  const peak = Math.max(1, ...series.flatMap((item) => item.data.map((n) => Number(n) || 0)));
  return (
    <div style={{ ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height }}>
        {categories.map((category, index) => (
          <div key={category} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
              {series.map((item, seriesIndex) => (
                <div
                  key={item.name}
                  title={`${item.name}: ${item.data[index] ?? 0}`}
                  style={{
                    flex: 1,
                    height: `${((Number(item.data[index]) || 0) / peak) * 100}%`,
                    background: seriesColor(item, seriesIndex),
                    minHeight: 2,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {category}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  categories,
  series,
  height = 220,
  style,
}: {
  categories: string[];
  series: ChartSeries[];
  height?: number;
  fill?: boolean;
  valueSuffix?: string;
  valuePrefix?: string;
  showValues?: boolean;
  showHoverGuide?: boolean;
  style?: CSSProperties;
}) {
  const peak = Math.max(1, ...series.flatMap((item) => item.data.map((n) => Number(n) || 0)));
  const width = 640;
  const pathFor = (item: ChartSeries) =>
    item.data
      .map((value, index) => {
        const x = categories.length <= 1 ? width / 2 : (index / (categories.length - 1)) * width;
        const y = height - ((Number(value) || 0) / peak) * (height - 16);
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} style={{ width: "100%", height: height + 24, ...style }}>
      {series.map((item, index) => (
        <path key={item.name} d={pathFor(item)} fill="none" stroke={seriesColor(item, index)} strokeWidth={2} />
      ))}
    </svg>
  );
}

export function PieChart({
  data,
  size = 200,
  donut,
  style,
}: {
  data: Array<{ label: string; value: number; tone?: string }>;
  size?: number;
  donut?: boolean;
  style?: CSSProperties;
}) {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0) || 1;
  let cursor = 0;
  const radius = size / 2;
  const slices = data.map((item, index) => {
    const sweep = ((Number(item.value) || 0) / total) * Math.PI * 2;
    const start = cursor;
    cursor += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = radius + radius * Math.cos(start - Math.PI / 2);
    const y1 = radius + radius * Math.sin(start - Math.PI / 2);
    const x2 = radius + radius * Math.cos(start + sweep - Math.PI / 2);
    const y2 = radius + radius * Math.sin(start + sweep - Math.PI / 2);
    return { ...item, d: `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`, color: (item.tone && toneColor[item.tone]) || theme.chart.sequence[index % theme.chart.sequence.length] };
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice) => (
          <path key={slice.label} d={slice.d} fill={slice.color}>
            <title>{`${slice.label}: ${slice.value}`}</title>
          </path>
        ))}
        {donut ? <circle cx={radius} cy={radius} r={radius * 0.55} fill={theme.bg.elevated} /> : null}
      </svg>
      <div style={{ fontSize: 12, color: theme.text.secondary }}>
        {data.map((item) => (
          <div key={item.label}>
            {item.label}: {item.value}
          </div>
        ))}
      </div>
    </div>
  );
}
