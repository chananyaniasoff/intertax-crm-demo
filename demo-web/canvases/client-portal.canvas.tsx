import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  TextArea,
  TextInput,
  TodoList,
  useCanvasState,
  useHostTheme,
  useState,
} from "cursor/canvas";
import type { TodoItem } from "cursor/canvas";

/** Bust stale portal preview when shell chrome changes. */
const PORTAL_SHELL_BUILD = "v11-2026-09-25-sumit-receipts";

const PRIMARY_RAIL_WIDTH = 72;
const SECONDARY_SIDEBAR_WIDTH = 248;

const SHELL_FILL = {
  flex: 1,
  minHeight: 0,
  height: "100%" as const,
  overflow: "hidden" as const,
  boxSizing: "border-box" as const,
};

const SHELL_SCROLL = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflowY: "auto" as const,
  WebkitOverflowScrolling: "touch" as const,
  boxSizing: "border-box" as const,
};

const SHELL_RAIL = {
  flexShrink: 0,
  alignSelf: "stretch" as const,
  minHeight: 0,
  maxHeight: "100%" as const,
  overflowY: "auto" as const,
  overflowX: "hidden" as const,
  WebkitOverflowScrolling: "touch" as const,
  boxSizing: "border-box" as const,
};

type Screen =
  | "login"
  | "home"
  | "documents"
  | "invoices"
  | "requests"
  | "messages"
  | "profile"
  | "services";

type AccountId = "acme" | "cohen";

/** Client Portal chrome language (distinct from profile preferred language). */
type UiLang = "en" | "he";

type DocStatus = "requested" | "uploaded" | "shared" | "reviewed";

/** Inbound channel that auto-adds files to portal Documents. */
type PortalInboundSource = "email" | "whatsapp";

/**
 * Attachments that arrived from the client’s registered company email
 * or WhatsApp number and were auto-filed into portal Documents.
 * Portal-local demo (CRM has no matching shared inbound key yet).
 */
type PortalInboundAttachment = {
  id: string;
  accountId: AccountId;
  source: PortalInboundSource;
  fileName: string;
  /** Matched registered email or WhatsApp phone. */
  from: string;
  receivedAt: string;
  note?: string;
};

/** Mirrors CRM tax-return document requests (separate canvas store). */
type PortalCrmDocRequest = {
  id: string;
  crmClientHint: string;
  year: string;
  docName: string;
  docType: string;
  status: "pending" | "uploaded";
  createdAt: string;
  uploadedFileName?: string;
};

/** Small eye SVG used as View control on uploaded checklist rows. */
function PortalEyeViewButton({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        padding: 0,
        borderRadius: 6,
        border: `1px solid ${color}`,
        background: "transparent",
        cursor: "pointer",
        color,
        flexShrink: 0,
      }}
    >
      <svg
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7-9.5-7-9.5-7z" />
        <circle cx="12" cy="12" r="2.75" />
      </svg>
    </button>
  );
}

type DocRow = {
  id: string;
  name: string;
  category: string;
  status: DocStatus;
  due?: string;
  note?: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  date: string;
  amount: string;
  status: "unpaid" | "paid" | "draft";
  source: "CRM" | "Wave";
  kind: "tax-invoice" | "payment-request";
  description: string;
};

/** Read-only קבלה rows pulled from Sumit (demo — no live API). */
type SumitReceiptRow = {
  id: string;
  number: string;
  date: string;
  amount: string;
  status: "issued" | "cancelled";
  source: "Sumit";
  description: string;
};

type PortalMessage = {
  id: string;
  from: "firm" | "you";
  author: string;
  subject: string;
  body: string;
  time: string;
  unread?: boolean;
};

type ServiceStatus = {
  id: string;
  name: string;
  status: "not-started" | "in-process" | "up-to-date";
  detail: string;
};

type PortalAccount = {
  id: AccountId;
  kind: "Company" | "Individual";
  displayName: string;
  nameHe: string;
  email: string;
  phone: string;
  identityLabel: string;
  identityValue: string;
  preferredLanguage: "English" | "Hebrew";
  address: string;
  contactRole?: string;
  greeting: string;
  greetingHe: string;
  docs: DocRow[];
  invoices: InvoiceRow[];
  receipts: SumitReceiptRow[];
  requests: TodoItem[];
  messages: PortalMessage[];
  services: ServiceStatus[];
};

/** Client Portal UI strings — English | עברית. Demo names stay as-is. */
const PORTAL_UI = {
  brandSubtitle: { en: "Client Portal", he: "פורטל לקוחות" },
  english: { en: "English", he: "English" },
  hebrew: { en: "עברית", he: "עברית" },
  navHome: { en: "Overview", he: "סקירה" },
  navDocuments: { en: "Documents", he: "מסמכים" },
  navInvoices: { en: "Invoices", he: "חשבוניות" },
  navRequests: { en: "Requests", he: "בקשות" },
  navMessages: { en: "Messages", he: "הודעות" },
  navProfile: { en: "Profile", he: "פרופיל" },
  navServices: { en: "Services", he: "שירותים" },
  signOut: { en: "Sign out", he: "התנתקות" },
  shellHint: {
    en: "Documents, invoices, and firm requests — including attachments from your registered email and WhatsApp.",
    he: "מסמכים, חשבוניות ובקשות מהמשרד — כולל קבצים מצורפים מהאימייל ומהוואטסאפ הרשומים.",
  },
  kindCompany: { en: "Company", he: "חברה" },
  kindIndividual: { en: "Individual", he: "פרטי" },

  loginHeadline: {
    en: "Your accounting, in one place",
    he: "הנהלת החשבונות שלכם, במקום אחד",
  },
  loginIntro: {
    en: "Sign in to view documents the firm requests, pay invoices, complete checklists, and read portal messages. Attachments you send from your registered email or WhatsApp are filed here automatically.",
    he: "התחברו כדי לצפות במסמכים שהמשרד מבקש, לשלם חשבוניות, להשלים רשימות משימות ולקרוא הודעות בפורטל. קבצים מצורפים ששלחתם מהאימייל או מהוואטסאפ הרשומים נשמרים כאן אוטומטית.",
  },
  signIn: { en: "Sign in", he: "התחברות" },
  continueDemo: {
    en: "Continue as demo client",
    he: "המשך כלקוח לדוגמה",
  },
  demoAccount: { en: "Demo account", he: "חשבון לדוגמה" },
  companyAcme: {
    en: "Company — Acme Trading",
    he: "חברה — Acme Trading",
  },
  individualNoam: {
    en: "Individual — Noam Cohen",
    he: "פרטי — Noam Cohen",
  },
  demoInviteHint: {
    en: "Client login is invited by a Manager after conversion. Prospects have no portal access.",
    he: "גישה לפורטל נשלחת על ידי מנהל לאחר המרה ללקוח. ללקוחות פוטנציאליים אין כניסה.",
  },
  email: { en: "Email", he: "אימייל" },
  password: { en: "Password", he: "סיסמה" },
  forgotPassword: { en: "Forgot password", he: "שכחתי סיסמה" },
  signedInDemo: { en: "Signed-in demo", he: "הדגמה מחוברת" },
  portalVsWhatsApp: {
    en: "Portal, email & WhatsApp files",
    he: "קבצים בפורטל, באימייל ובוואטסאפ",
  },
  portalVsWhatsAppBody: {
    en: "Chat on WhatsApp stays for quick questions. Any attachment you send from your registered company email or WhatsApp number is auto-added to Documents here (and to the firm’s client folder). Portal uploads and firm requests live in the same file list.",
    he: "הצ'אט בוואטסאפ נשאר לשאלות קצרות. כל קובץ מצורף שתשלחו מהאימייל או ממספר הוואטסאפ הרשומים בחברה מתווסף אוטומטית למסמכים כאן (ולתיקיית הלקוח במשרד). העלאות מהפורטל ובקשות מהמשרד מופיעות באותה רשימה.",
  },
  footerSample: {
    en: "Intertax · Accounting & tax · Client-facing sample (UX canvas, not production)",
    he: "Intertax · הנהלת חשבונות ומיסוי · דוגמת ממשק לקוח (קנבס UX, לא מערכת חיה)",
  },

  homeIntro: {
    en: "Here is what needs your attention. Complete requests and uploads here. Files you attach from your registered email or WhatsApp also land in Documents.",
    he: "להלן מה שדורש את תשומת לבכם. השלימו בקשות והעלאות כאן. קבצים שתצרפו מהאימייל או מהוואטסאפ הרשומים יופיעו גם במסמכים.",
  },
  statDocsRequested: { en: "Docs requested", he: "מסמכים מבוקשים" },
  statUnpaidInvoices: { en: "Unpaid invoices", he: "חשבוניות לתשלום" },
  statOpenRequests: { en: "Open requests", he: "בקשות פתוחות" },
  statUnreadMessages: { en: "Unread messages", he: "הודעות שלא נקראו" },
  nextActions: { en: "Next actions", he: "הפעולות הבאות" },
  docsRequestedTitle: {
    en: "document requested",
    he: "מסמך מבוקש",
  },
  docsRequestedTitlePlural: {
    en: "documents requested",
    he: "מסמכים מבוקשים",
  },
  docsRequestedDetail: {
    en: "Upload files the firm needs for your file.",
    he: "העלו את הקבצים שהמשרד צריך לתיק שלכם.",
  },
  openDocuments: { en: "Open Documents", he: "מעבר למסמכים" },
  unpaidInvoiceTitle: {
    en: "unpaid invoice",
    he: "חשבונית לתשלום",
  },
  unpaidInvoiceTitlePlural: {
    en: "unpaid invoices",
    he: "חשבוניות לתשלום",
  },
  unpaidInvoiceDetail: {
    en: "View PDF and payment details.",
    he: "צפייה ב־PDF ובפרטי תשלום.",
  },
  openInvoices: { en: "Open Invoices", he: "מעבר לחשבוניות" },
  openRequestTitle: { en: "open request", he: "בקשה פתוחה" },
  openRequestTitlePlural: { en: "open requests", he: "בקשות פתוחות" },
  openRequestDetail: {
    en: "Checklist items from Intertax for you to complete.",
    he: "פריטי רשימה מ־Intertax להשלמה מצדכם.",
  },
  viewRequests: { en: "View Requests", he: "צפייה בבקשות" },
  unreadMessageTitle: {
    en: "unread portal message",
    he: "הודעת פורטל שלא נקראה",
  },
  unreadMessageTitlePlural: {
    en: "unread portal messages",
    he: "הודעות פורטל שלא נקראו",
  },
  unreadMessageDetail: {
    en: "Portal message thread with the firm.",
    he: "שרשור הודעות פורטל עם המשרד.",
  },
  openMessages: { en: "Open Messages", he: "מעבר להודעות" },
  serviceSnapshot: { en: "Service snapshot", he: "מצב שירותים" },
  serviceSnapshotHint: {
    en: "Read-only status from the firm — no staff process tools.",
    he: "סטטוס לקריאה בלבד מהמשרד — ללא כלי עבודה של הצוות.",
  },
  fullServiceStatus: { en: "Full service status", he: "מצב שירותים מלא" },
  myDetails: { en: "My details", he: "הפרטים שלי" },

  documentsTitle: { en: "Documents", he: "מסמכים" },
  documentsIntro: {
    en: "Files the firm shares with you, uploads you send here, and attachments auto-filed from your registered email and WhatsApp. You never see the office Windows share — these land in the firm’s client folder for staff.",
    he: "קבצים שהמשרד משתף איתכם, העלאות שאתם שולחים כאן, וקבצים מצורפים שנקלטים אוטומטית מהאימייל ומהוואטסאפ הרשומים. אתם לא רואים את שיתוף Windows של המשרד — הם נשמרים בתיקיית הלקוח לצוות.",
  },
  inboundFromChannels: {
    en: "From email & WhatsApp",
    he: "מאימייל ווואטסאפ",
  },
  inboundFromChannelsIntro: {
    en: "Every attachment from your registered company email and WhatsApp number is added to your portal file automatically.",
    he: "כל קובץ מצורף מהאימייל של החברה ומהוואטסאפ הרשומים מתווסף אוטומטית לקבצים בפורטל.",
  },
  inboundRegisteredAs: {
    en: "Registered sources for this account",
    he: "מקורות רשומים לחשבון זה",
  },
  inboundSourceEmail: { en: "Email", he: "אימייל" },
  inboundSourceWhatsApp: { en: "WhatsApp", he: "וואטסאפ" },
  inboundColFile: { en: "File", he: "קובץ" },
  inboundColSource: { en: "Source", he: "מקור" },
  inboundColFrom: { en: "From", he: "מאת" },
  inboundColReceived: { en: "Received", he: "התקבל" },
  inboundColNote: { en: "Note", he: "הערה" },
  inboundStatusIngested: {
    en: "Auto-added",
    he: "נוסף אוטומטית",
  },
  whatsappLabel: { en: "WhatsApp", he: "וואטסאפ" },
  requestedFromYou: { en: "Requested from you", he: "מבוקש מכם" },
  itemsStillNeeded: {
    en: "item still needed for your file.",
    he: "פריט עדיין נדרש לתיק שלכם.",
  },
  itemsStillNeededPlural: {
    en: "items still needed for your file.",
    he: "פריטים עדיין נדרשים לתיק שלכם.",
  },
  uploadDocument: { en: "Upload a document", he: "העלאת מסמך" },
  uploadHint: {
    en: "Demo affordance — choose a file in production. Optional note for the firm:",
    he: "הדגמה — בפרודקשן בוחרים קובץ. הערה אופציונלית למשרד:",
  },
  uploadPlaceholder: {
    en: "e.g. March Discount bank export",
    he: "לדוגמה: ייצוא בנק דיסקונט למרץ",
  },
  chooseFileUpload: {
    en: "Choose file & upload",
    he: "בחירת קובץ והעלאה",
  },
  clear: { en: "Clear", he: "ניקוי" },
  queuedUntitled: {
    en: "Queued: untitled upload (demo)",
    he: "בתור: העלאה ללא שם (הדגמה)",
  },
  queuedPrefix: { en: "Queued", he: "בתור" },
  queuedWouldSave: {
    en: "would save under Portal-Uploads for staff review.",
    he: "יישמר תחת Portal-Uploads לבדיקת הצוות.",
  },
  requested: { en: "Requested", he: "מבוקש" },
  sharedAndUploaded: {
    en: "Shared & uploaded",
    he: "משותף ומועלה",
  },
  colDocument: { en: "Document", he: "מסמך" },
  colCategory: { en: "Category", he: "קטגוריה" },
  colStatus: { en: "Status", he: "סטטוס" },
  colDueNote: { en: "Due / note", he: "יעד / הערה" },
  colNote: { en: "Note", he: "הערה" },
  statusLegend: {
    en: "Status legend: Requested · Uploaded · Shared with you · Reviewed",
    he: "מקרא סטטוס: מבוקש · הועלה · שותף איתכם · נבדק",
  },
  docRequested: { en: "Requested", he: "מבוקש" },
  docUploaded: { en: "Uploaded", he: "הועלה" },
  docShared: { en: "Shared with you", he: "שותף איתכם" },
  docReviewed: { en: "Reviewed", he: "נבדק" },

  invoicesTitle: { en: "Invoices", he: "חשבוניות" },
  invoicesIntro: {
    en: "CRM tax invoices and דרישת תשלום, Wave history, and Sumit receipts (קבלות) pulled read-only. Sources are labelled. Pay / view are placeholders. CRM does not issue receipts.",
    he: "חשבוניות מס ודרישות תשלום מה־CRM, היסטוריית Wave, וקבלות מ־Sumit שנמשכות לקריאה בלבד. המקור מסומן בכל שורה. תשלום / צפייה הם placeholders. ה־CRM לא מנפיק קבלות.",
  },
  colInvoice: { en: "Invoice", he: "חשבונית" },
  colDate: { en: "Date", he: "תאריך" },
  colAmount: { en: "Amount", he: "סכום" },
  colSource: { en: "Source", he: "מקור" },
  unpaid: { en: "Unpaid", he: "לא שולם" },
  paid: { en: "Paid", he: "שולם" },
  draft: { en: "Draft", he: "טיוטה" },
  waveHistory: { en: "Wave (history)", he: "Wave (היסטוריה)" },
  sourceCrm: { en: "CRM", he: "CRM" },
  sourceCrmInvoice: { en: "CRM · tax invoice", he: "CRM · חשבונית מס" },
  sourceCrmPaymentRequest: {
    en: "CRM · payment request",
    he: "CRM · דרישת תשלום",
  },
  sourceSumit: { en: "Sumit", he: "Sumit" },
  receiptsTitle: { en: "Sumit receipts (קבלות)", he: "קבלות Sumit" },
  receiptsIntro: {
    en: "Pulled from Sumit after matching this portal client to a Sumit customer. Read-only — Intertax CRM does not issue קבלה.",
    he: "נמשך מ־Sumit לאחר התאמת לקוח הפורטל ללקוח ב־Sumit. לקריאה בלבד — CRM של Intertax לא מנפיק קבלה.",
  },
  receiptsCaption: {
    en: "Source: Sumit API (demo rows labelled as pulled from Sumit) · no live fetch in this canvas",
    he: "מקור: Sumit API (שורות דוגמה מסומנות כנמשכות מ־Sumit) · אין שליפה חיה בקנבס זה",
  },
  receiptsPulledLabel: {
    en: "Pulled from Sumit",
    he: "נמשך מ־Sumit",
  },
  colReceipt: { en: "Receipt", he: "קבלה" },
  receiptIssued: { en: "Issued", he: "הונפקה" },
  receiptCancelled: { en: "Cancelled", he: "בוטלה" },
  dateLabel: { en: "Date", he: "תאריך" },
  amountLabel: { en: "Amount", he: "סכום" },
  payPlaceholder: { en: "Pay (placeholder)", he: "תשלום (הדגמה)" },
  viewPdf: { en: "View PDF", he: "צפייה ב־PDF" },
  download: { en: "Download", he: "הורדה" },
  historicalWaveTitle: {
    en: "Historical Wave invoice",
    he: "חשבונית Wave היסטורית",
  },
  historicalWaveBody: {
    en: "Imported for reference. New invoices are issued only in the Intertax CRM.",
    he: "יובאה לעיון. חשבוניות חדשות מונפקות רק ב־CRM של Intertax.",
  },

  requestsTitle: { en: "Requests", he: "בקשות" },
  requestsIntro: {
    en: "Checklist items from the firm. Completing an item here is the client-facing side of the missing-docs / engagement checklist — not staff pipeline tools.",
    he: "פריטי רשימה מהמשרד. השלמת פריט כאן היא הצד הלקוח של רשימת מסמכים חסרים / מעורבות — לא כלי תהליך של הצוות.",
  },
  tip: { en: "Tip", he: "טיפ" },
  requestsTipBody: {
    en: "Document uploads for open requests belong under Documents. Portal messages are for questions about a request; WhatsApp stays for informal chat.",
    he: "העלאת מסמכים לבקשות פתוחות שייכת למסמכים. הודעות הפורטל לשאלות על בקשה; וואטסאפ נשאר לצ׳אט לא פורמלי.",
  },
  crmDocRequestsTitle: {
    en: "Tax return documents from your accountant",
    he: "מסמכי דוח אישי מהמשרד",
  },
  crmDocRequestsIntro: {
    en: "Demo mirror of CRM “Request document” (state is not shared across canvases). Mark uploaded — the row turns green with a View eye, and the file appears under Documents automatically.",
    he: "הדגמה מקבילה לבקשת מסמך ב־CRM (המצב לא משותף בין קנבסים). סמנו הועלה — השורה הופכת לירוקה עם עין לצפייה, והקובץ מופיע אוטומטית במסמכים.",
  },
  crmDocPending: { en: "Pending upload", he: "ממתין להעלאה" },
  crmDocUploaded: { en: "Uploaded", he: "הועלה" },
  crmMarkUploaded: {
    en: "Mark as uploaded (demo)",
    he: "סמן כהועלה (הדגמה)",
  },
  crmViewDoc: { en: "View", he: "צפייה" },
  crmDocPreviewTitle: {
    en: "Uploaded document (demo)",
    he: "מסמך שהועלה (הדגמה)",
  },
  crmDocPreviewBody: {
    en: "“{file}” is now in Documents and marked complete on your checklist.",
    he: "“{file}” מופיע במסמכים ומסומן כהושלם ברשימה.",
  },
  crmClosePreview: { en: "Close preview", he: "סגירת תצוגה" },
  crmAddDemoRequest: {
    en: "Add demo Form 106 request",
    he: "הוסף בקשת 106 לדוגמה",
  },
  crmYear: { en: "Tax year", he: "שנת מס" },
  crmAutoInDocuments: {
    en: "Portal upload (tax return)",
    he: "העלאת פורטל (דוח אישי)",
  },

  messagesTitle: { en: "Messages", he: "הודעות" },
  messagesIntro: {
    en: "Portal inbox for formal notes between you and Intertax. Distinct from Client WhatsApp on the staff CRM.",
    he: "תיבת דואר בפורטל להודעות רשמיות ביניכם לבין Intertax. נפרד מוואטסאפ לקוח במערכת העובדים.",
  },
  inbox: { en: "Inbox", he: "תיבה נכנסת" },
  newBadge: { en: "New", he: "חדש" },
  reply: { en: "Reply", he: "תשובה" },
  replyPlaceholder: {
    en: "Write a portal reply…",
    he: "כתבו תשובה בפורטל…",
  },
  send: { en: "Send", he: "שליחה" },
  sentDemo: { en: "Sent (demo)", he: "נשלח (הדגמה)" },
  you: { en: "You", he: "אתם" },

  profileTitle: { en: "My details", he: "הפרטים שלי" },
  profileIntro: {
    en: "View your client profile. Only safe contact fields are editable — legal identity and engagement terms stay firm-controlled.",
    he: "צפייה בפרופיל הלקוח. רק שדות קשר בטוחים ניתנים לעריכה — זהות משפטית ותנאי התקשרות נשארים בשליטת המשרד.",
  },
  account: { en: "Account", he: "חשבון" },
  identityCompany: {
    en: "Company number (ח.פ.)",
    he: "מספר חברה (ח.פ.)",
  },
  identityId: {
    en: "Israeli ID (ת.ז.)",
    he: "תעודת זהות (ת.ז.)",
  },
  nameEn: { en: "Name (EN)", he: "שם באנגלית" },
  nameHe: { en: "Name (HE)", he: "שם בעברית" },
  type: { en: "Type", he: "סוג" },
  identityReadOnly: {
    en: "Identity numbers are read-only. Contact Intertax to correct them.",
    he: "מספרי זהות לקריאה בלבד. פנו ל־Intertax לתיקון.",
  },
  editableContact: { en: "Editable contact", he: "פרטי קשר לעריכה" },
  emailPrimary: { en: "Email (primary)", he: "אימייל (ראשי)" },
  emailFirmConfirm: {
    en: "Email changes require firm confirmation (demo: read-only).",
    he: "שינוי אימייל דורש אישור המשרד (הדגמה: לקריאה בלבד).",
  },
  phone: { en: "Phone", he: "טלפון" },
  preferredLanguage: {
    en: "Preferred language",
    he: "שפת העדפה",
  },
  langEnglish: { en: "English", he: "English" },
  langHebrew: { en: "Hebrew (עברית)", he: "עברית" },
  saveChanges: { en: "Save changes", he: "שמירת שינויים" },
  savedDemo: { en: "Saved (demo)", he: "נשמר (הדגמה)" },
  languageWord: { en: "language", he: "שפה" },
  addressContacts: { en: "Address & contacts", he: "כתובת ואנשי קשר" },
  confirmDetails: {
    en: "I confirm these contact details are current (demo)",
    he: "אני מאשר/ת שפרטי הקשר מעודכנים (הדגמה)",
  },

  servicesTitle: { en: "Service status", he: "מצב שירותים" },
  servicesIntro: {
    en: "Client-friendly summary of the services on your engagement. Read-only — no staff checklists, stage boards, or comment streams.",
    he: "סיכום ידידותי של השירותים בהסכם שלכם. לקריאה בלבד — ללא רשימות צוות, לוחות שלבים או זרמי הערות.",
  },
  status: { en: "Status", he: "סטטוס" },
  svcNotStarted: { en: "Not started", he: "לא התחיל" },
  svcInProcess: { en: "In process", he: "בתהליך" },
  svcUpToDate: { en: "Up to date", he: "מעודכן" },
  needSomethingElse: {
    en: "Need something else?",
    he: "צריכים משהו נוסף?",
  },
  needSomethingElseBody: {
    en: "Ask your accountant via portal Messages for formal requests, or WhatsApp for a quick question. New services are added by the firm, not from this screen.",
    he: "פנו לרואה החשבון דרך הודעות הפורטל לבקשות רשמיות, או בוואטסאפ לשאלה קצרה. שירותים חדשים מתווספים על ידי המשרד, לא ממסך זה.",
  },
} as const;

type PortalUiKey = keyof typeof PORTAL_UI;

function t(lang: UiLang, key: PortalUiKey): string {
  return PORTAL_UI[key][lang];
}

function navLabel(lang: UiLang, id: Screen): string {
  switch (id) {
    case "home":
      return t(lang, "navHome");
    case "documents":
      return t(lang, "navDocuments");
    case "invoices":
      return t(lang, "navInvoices");
    case "requests":
      return t(lang, "navRequests");
    case "messages":
      return t(lang, "navMessages");
    case "profile":
      return t(lang, "navProfile");
    case "services":
      return t(lang, "navServices");
    default:
      return id;
  }
}

const NAV_SCREENS: Screen[] = [
  "home",
  "documents",
  "invoices",
  "requests",
  "messages",
  "profile",
  "services",
];

const ACCOUNTS: Record<AccountId, PortalAccount> = {
  acme: {
    id: "acme",
    kind: "Company",
    displayName: "Acme Trading Ltd",
    nameHe: "אקמי טריידינג בע״מ",
    email: "finance@acmetrading.example",
    phone: "+972-3-555-0142",
    identityLabel: "Company number (ח.פ.)",
    identityValue: "512345678",
    preferredLanguage: "English",
    address: "12 Rothschild Blvd, Tel Aviv",
    contactRole: "Authorized signatory: Dana Levi",
    greeting: "Welcome back, Acme Trading",
    greetingHe: "ברוכים השבים, Acme Trading",
    docs: [
      {
        id: "d1",
        name: "Bank statements — March 2026",
        category: "Bookkeeping",
        status: "requested",
        due: "Due 20 Mar",
        note: "PDF or CSV from your business account",
      },
      {
        id: "d2",
        name: "Expense invoices — Q1",
        category: "Bookkeeping",
        status: "requested",
        due: "Due 28 Mar",
      },
      {
        id: "d3",
        name: "Certificate of incorporation",
        category: "Admin",
        status: "shared",
        note: "Shared by Intertax",
      },
      {
        id: "d4",
        name: "VAT certificate",
        category: "Admin",
        status: "uploaded",
        note: "Uploaded 02 Mar · pending review",
      },
      {
        id: "d5",
        name: "Prior year financials 2024",
        category: "Audit",
        status: "reviewed",
      },
    ],
    invoices: [
      {
        id: "i1",
        number: "ITX-2026-0142",
        date: "01 Mar 2026",
        amount: "₪ 4,800",
        status: "unpaid",
        source: "CRM",
        kind: "tax-invoice",
        description: "Monthly bookkeeping + VAT — March",
      },
      {
        id: "pr1",
        number: "PR-2026-031",
        date: "01 Mar 2026",
        amount: "₪ 4,800",
        status: "unpaid",
        source: "CRM",
        kind: "payment-request",
        description: "דרישת תשלום — March fees (linked to ITX-2026-0142)",
      },
      {
        id: "i2",
        number: "ITX-2026-0098",
        date: "01 Feb 2026",
        amount: "₪ 4,800",
        status: "paid",
        source: "CRM",
        kind: "tax-invoice",
        description: "Monthly bookkeeping + VAT — February",
      },
      {
        id: "i3",
        number: "W-88421",
        date: "15 Dec 2025",
        amount: "₪ 6,200",
        status: "paid",
        source: "Wave",
        kind: "tax-invoice",
        description: "Year-end package (historical)",
      },
    ],
    receipts: [
      {
        id: "sr1",
        number: "S-קבלה-118204",
        date: "03 Feb 2026",
        amount: "₪ 4,800",
        status: "issued",
        source: "Sumit",
        description: "February bookkeeping — pulled from Sumit",
      },
      {
        id: "sr2",
        number: "S-קבלה-117901",
        date: "04 Jan 2026",
        amount: "₪ 4,800",
        status: "issued",
        source: "Sumit",
        description: "January bookkeeping — pulled from Sumit",
      },
      {
        id: "sr3",
        number: "S-קבלה-116440",
        date: "18 Dec 2025",
        amount: "₪ 6,200",
        status: "cancelled",
        source: "Sumit",
        description: "Year-end receipt voided in Sumit — pulled from Sumit",
      },
    ],
    requests: [
      {
        id: "r1",
        content: "Upload March bank statements",
        status: "pending",
      },
      {
        id: "r2",
        content: "Confirm authorized signatory details on Profile",
        status: "pending",
      },
      {
        id: "r3",
        content: "Review draft VAT report for February",
        status: "in_progress",
      },
      {
        id: "r4",
        content: "Pay invoice ITX-2026-0142",
        status: "pending",
      },
      {
        id: "r5",
        content: "Return signed engagement letter",
        status: "completed",
      },
    ],
    messages: [
      {
        id: "m1",
        from: "firm",
        author: "Intertax · Yael Cohen",
        subject: "Documents needed for March close",
        body: "Please upload bank statements and expense invoices for March so we can close the books on schedule.",
        time: "Today · 09:40",
        unread: true,
      },
      {
        id: "m2",
        from: "firm",
        author: "Intertax · Billing",
        subject: "Invoice ITX-2026-0142 is ready",
        body: "Your March fee invoice is available under Invoices. You can view the PDF or mark payment once transferred.",
        time: "01 Mar · 08:15",
        unread: true,
      },
      {
        id: "m3",
        from: "you",
        author: "You",
        subject: "Re: VAT certificate",
        body: "Uploaded the updated VAT certificate to Documents. Please confirm when reviewed.",
        time: "02 Mar · 16:02",
      },
      {
        id: "m4",
        from: "firm",
        author: "Intertax · Bookkeeping",
        subject: "February books complete",
        body: "February bookkeeping is finished. The draft VAT report is ready for your review under Requests.",
        time: "28 Feb · 11:20",
      },
    ],
    services: [
      {
        id: "s1",
        name: "Bookkeeping",
        status: "in-process",
        detail: "March close in progress · waiting on bank statements",
      },
      {
        id: "s2",
        name: "VAT",
        status: "up-to-date",
        detail: "February report filed · next cycle March",
      },
      {
        id: "s3",
        name: "Annual accounts / audit",
        status: "not-started",
        detail: "2025 engagement not started yet",
      },
      {
        id: "s4",
        name: "Company secretary",
        status: "up-to-date",
        detail: "Registrar filings current",
      },
    ],
  },
  cohen: {
    id: "cohen",
    kind: "Individual",
    displayName: "Noam Cohen",
    nameHe: "נועם כהן",
    email: "noam.cohen@example.com",
    phone: "+972-52-555-0199",
    identityLabel: "Israeli ID (ת.ז.)",
    identityValue: "301234567",
    preferredLanguage: "Hebrew",
    address: "8 HaShalom St, Ra'anana",
    greeting: "Welcome, Noam",
    greetingHe: "שלום, נועם",
    docs: [
      {
        id: "d1",
        name: "Form 106 — 2025",
        category: "Tax",
        status: "requested",
        due: "Due 15 Apr",
        note: "From each employer",
      },
      {
        id: "d2",
        name: "Pension / Form 867",
        category: "Tax",
        status: "requested",
        due: "Due 15 Apr",
      },
      {
        id: "d3",
        name: "ID / passport scan",
        category: "KYC",
        status: "uploaded",
        note: "Uploaded 10 Feb · pending review",
      },
      {
        id: "d4",
        name: "Prior year assessment (שומה)",
        category: "Tax",
        status: "shared",
        note: "Shared by Intertax for reference",
      },
      {
        id: "d5",
        name: "Power of attorney — Tax Authority",
        category: "Admin",
        status: "reviewed",
      },
    ],
    invoices: [
      {
        id: "i1",
        number: "ITX-2026-0201",
        date: "10 Mar 2026",
        amount: "₪ 1,950",
        status: "unpaid",
        source: "CRM",
        kind: "tax-invoice",
        description: "Individual tax return preparation — 2025",
      },
      {
        id: "pr1",
        number: "PR-2026-018",
        date: "10 Mar 2026",
        amount: "₪ 1,950",
        status: "unpaid",
        source: "CRM",
        kind: "payment-request",
        description: "דרישת תשלום — 2025 tax return (linked to ITX-2026-0201)",
      },
      {
        id: "i2",
        number: "W-77102",
        date: "12 May 2025",
        amount: "₪ 1,800",
        status: "paid",
        source: "Wave",
        kind: "tax-invoice",
        description: "Tax return 2024 (historical)",
      },
    ],
    receipts: [
      {
        id: "sr1",
        number: "S-קבלה-109332",
        date: "20 May 2025",
        amount: "₪ 1,800",
        status: "issued",
        source: "Sumit",
        description: "2024 tax return payment — pulled from Sumit",
      },
      {
        id: "sr2",
        number: "S-קבלה-102118",
        date: "02 Jun 2024",
        amount: "₪ 1,650",
        status: "issued",
        source: "Sumit",
        description: "2023 tax return payment — pulled from Sumit",
      },
    ],
    requests: [
      {
        id: "r1",
        content: "Upload Form 106 for all 2025 employers",
        status: "pending",
      },
      {
        id: "r2",
        content: "Upload pension / Form 867 slips",
        status: "pending",
      },
      {
        id: "r3",
        content: "Confirm residency and contact phone",
        status: "in_progress",
      },
      {
        id: "r4",
        content: "Pay invoice ITX-2026-0201",
        status: "pending",
      },
      {
        id: "r5",
        content: "Sign tax authority power of attorney",
        status: "completed",
      },
    ],
    messages: [
      {
        id: "m1",
        from: "firm",
        author: "Intertax · Tax team",
        subject: "2025 tax documents checklist",
        body: "We opened your 2025 return file. Please upload Form 106 and pension slips when ready — or send them from your registered email / WhatsApp; attachments are auto-added to Documents.",
        time: "Today · 10:05",
        unread: true,
      },
      {
        id: "m2",
        from: "firm",
        author: "Intertax · Billing",
        subject: "Tax preparation invoice",
        body: "Invoice ITX-2026-0201 is available. Payment details are on the PDF.",
        time: "10 Mar · 09:00",
      },
      {
        id: "m3",
        from: "you",
        author: "You",
        subject: "ID scan uploaded",
        body: "Uploaded my ID scan under Documents. Please let me know if anything else is missing.",
        time: "10 Feb · 18:44",
      },
    ],
    services: [
      {
        id: "s1",
        name: "Tax return (individual)",
        status: "in-process",
        detail: "2025 return open · waiting on Form 106 / 867",
      },
      {
        id: "s2",
        name: "Consulting",
        status: "up-to-date",
        detail: "No open consulting items",
      },
    ],
  },
};

/** Demo inbound files matched to each account’s registered email + WhatsApp phone. */
const DEFAULT_INBOUND_ATTACHMENTS: PortalInboundAttachment[] = [
  {
    id: "in-acme-email-1",
    accountId: "acme",
    source: "email",
    fileName: "Discount_bank_export_Mar2026.csv",
    from: "finance@acmetrading.example",
    receivedAt: "16 Mar 2026 · 09:41",
    note: "Subject: March bank export",
  },
  {
    id: "in-acme-email-2",
    accountId: "acme",
    source: "email",
    fileName: "Supplier_invoice_Reuven_Ltd.pdf",
    from: "finance@acmetrading.example",
    receivedAt: "14 Mar 2026 · 17:02",
    note: "Subject: Re: Q1 expenses",
  },
  {
    id: "in-acme-wa-1",
    accountId: "acme",
    source: "whatsapp",
    fileName: "VAT_certificate_scan.jpg",
    from: "+972-3-555-0142",
    receivedAt: "15 Mar 2026 · 11:20",
    note: "Photo from WhatsApp chat",
  },
  {
    id: "in-acme-wa-2",
    accountId: "acme",
    source: "whatsapp",
    fileName: "Expense_receipt_parking.pdf",
    from: "+972-3-555-0142",
    receivedAt: "12 Mar 2026 · 18:45",
  },
  {
    id: "in-cohen-email-1",
    accountId: "cohen",
    source: "email",
    fileName: "Form_106_Employer_Alpha.pdf",
    from: "noam.cohen@example.com",
    receivedAt: "11 Mar 2026 · 08:15",
    note: "Subject: Form 106 as requested",
  },
  {
    id: "in-cohen-wa-1",
    accountId: "cohen",
    source: "whatsapp",
    fileName: "Pension_Form_867_scan.pdf",
    from: "+972-52-555-0199",
    receivedAt: "12 Mar 2026 · 19:03",
    note: "PDF from WhatsApp",
  },
];

function docStatusLabel(lang: UiLang, status: DocStatus): string {
  if (status === "requested") return t(lang, "docRequested");
  if (status === "uploaded") return t(lang, "docUploaded");
  if (status === "shared") return t(lang, "docShared");
  return t(lang, "docReviewed");
}

function docTone(
  status: DocStatus,
): "danger" | "warning" | "info" | "success" | "neutral" {
  if (status === "requested") return "warning";
  if (status === "uploaded") return "info";
  if (status === "shared") return "neutral";
  return "success";
}

function invoiceSourceLabel(lang: UiLang, inv: InvoiceRow): string {
  if (inv.source === "Wave") return t(lang, "waveHistory");
  if (inv.kind === "payment-request") return t(lang, "sourceCrmPaymentRequest");
  return t(lang, "sourceCrmInvoice");
}

function receiptStatusLabel(
  lang: UiLang,
  status: SumitReceiptRow["status"],
): string {
  if (status === "cancelled") return t(lang, "receiptCancelled");
  return t(lang, "receiptIssued");
}

function receiptTone(
  status: SumitReceiptRow["status"],
): "success" | "neutral" {
  return status === "cancelled" ? "neutral" : "success";
}

function invoiceTone(
  status: InvoiceRow["status"],
): "danger" | "success" | "neutral" {
  if (status === "unpaid") return "danger";
  if (status === "paid") return "success";
  return "neutral";
}

function invoiceStatusLabel(
  lang: UiLang,
  status: InvoiceRow["status"],
): string {
  if (status === "unpaid") return t(lang, "unpaid");
  if (status === "paid") return t(lang, "paid");
  return t(lang, "draft");
}

function serviceLabel(
  lang: UiLang,
  status: ServiceStatus["status"],
): string {
  if (status === "not-started") return t(lang, "svcNotStarted");
  if (status === "in-process") return t(lang, "svcInProcess");
  return t(lang, "svcUpToDate");
}

/** Firm service catalog name → localized display (keys stay English). */
function serviceNameLabel(lang: UiLang, name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (key === "bookkeeping") return lang === "he" ? "הנהלת חשבונות" : "Bookkeeping";
  if (key === "vat") return lang === "he" ? "מע״מ" : "VAT";
  if (key === "audit") return lang === "he" ? "ביקורת" : "Audit";
  if (key === "payroll") return lang === "he" ? "משכורות" : "Payroll";
  if (key === "tax return" || key === "tax return (individual)") {
    return lang === "he" ? "דוח אישי" : name.trim();
  }
  if (key === "consulting") return lang === "he" ? "ייעוץ" : "Consulting";
  if (key === "billing") return lang === "he" ? "חיובים" : "Billing";
  if (key === "company secretary") {
    return lang === "he" ? "מזכירות חברה" : "Company secretary";
  }
  if (
    key === "annual accounts / audit" ||
    key === "annual accounts" ||
    key === "annual account"
  ) {
    return lang === "he" ? "דוחות כספיים / ביקורת" : name.trim();
  }
  if (key === "invoices") return lang === "he" ? "חשבוניות" : "Invoices";
  if (key === "docs" || key === "documents") {
    return lang === "he" ? "מסמכים" : name.trim();
  }
  return name.trim();
}

function serviceTone(
  status: ServiceStatus["status"],
): "danger" | "warning" | "success" {
  if (status === "not-started") return "danger";
  if (status === "in-process") return "warning";
  return "success";
}

function kindLabel(lang: UiLang, kind: PortalAccount["kind"]): string {
  return kind === "Company" ? t(lang, "kindCompany") : t(lang, "kindIndividual");
}

function countBy<T>(items: T[], pred: (item: T) => boolean): number {
  return items.filter(pred).length;
}

function LangToggle({
  lang,
  setLang,
}: {
  lang: UiLang;
  setLang: (v: UiLang) => void;
}) {
  return (
    <Row gap={4} align="center">
      <Pill active={lang === "en"} onClick={() => setLang("en")} size="sm">
        {t(lang, "english")}
      </Pill>
      <Text size="small" tone="tertiary">
        |
      </Text>
      <Pill active={lang === "he"} onClick={() => setLang("he")} size="sm">
        {t(lang, "hebrew")}
      </Pill>
    </Row>
  );
}

function BrandMark({
  size = "md",
  lang,
}: {
  size?: "sm" | "md" | "lg";
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const pad = size === "lg" ? "14px 18px" : size === "md" ? "10px 14px" : "6px 10px";
  const titleSize = size === "lg" ? 22 : size === "md" ? 16 : 13;
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        padding: pad,
        background: theme.fill.secondary,
        border: `1px solid ${theme.stroke.secondary}`,
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontSize: titleSize,
          fontWeight: 600,
          color: theme.text.primary,
          letterSpacing: "0.04em",
        }}
      >
        INTERTAX
      </span>
      <span
        style={{
          fontSize: size === "lg" ? 13 : 11,
          color: theme.accent.primary,
          fontWeight: 500,
        }}
      >
        {t(lang, "brandSubtitle")}
      </span>
    </div>
  );
}

function PortalRailIcon({
  kind,
  active,
  color,
}: {
  kind: Screen;
  active: boolean;
  color: string;
}) {
  const sw = active ? 2.25 : 1.75;
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4.5 11.5 12 5l7.5 6.5" />
          <path d="M7 10.5V19h10v-8.5" />
        </svg>
      );
    case "documents":
      return (
        <svg {...common}>
          <path d="M7 4.5h7l4 4V19.5H7z" />
          <path d="M14 4.5V9h4.5" />
          <path d="M9.5 13h5M9.5 16h5" />
        </svg>
      );
    case "invoices":
      return (
        <svg {...common}>
          <rect x="4.5" y="6" width="15" height="12" rx="2" />
          <path d="M4.5 10h15" />
          <path d="M8 14h3.5" />
        </svg>
      );
    case "requests":
      return (
        <svg {...common}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4.5 6.2l1.4 1.4L8.2 5" />
          <path d="M4.5 12.2l1.4 1.4L8.2 11" />
          <path d="M4.5 18.2l1.4 1.4L8.2 17" />
        </svg>
      );
    case "messages":
      return (
        <svg {...common}>
          <path d="M5 17.5V7.8A2.8 2.8 0 0 1 7.8 5h8.4A2.8 2.8 0 0 1 19 7.8v5.4A2.8 2.8 0 0 1 16.2 16H9l-4 2.5z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="3.2" />
          <path d="M5.5 19c.8-3.4 3.2-5.2 6.5-5.2s5.7 1.8 6.5 5.2" />
        </svg>
      );
    case "services":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
        </svg>
      );
  }
}

function PortalModuleChromeBar({
  screen,
  lang,
}: {
  screen: Exclude<Screen, "login">;
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const accent = theme.accent.primary;
  return (
    <Row align="center" gap={12} style={{ flexShrink: 0, width: "100%" }}>
      <Spacer />
      <Pill
        active
        leadingContent={
          <PortalRailIcon kind={screen} active color={accent} />
        }
      >
        {navLabel(lang, screen)}
      </Pill>
    </Row>
  );
}

function PortalPrimaryRail({
  screen,
  onNavigate,
  badges,
  lang,
}: {
  screen: Exclude<Screen, "login">;
  onNavigate: (s: Exclude<Screen, "login">) => void;
  badges: Partial<Record<Exclude<Screen, "login">, number>>;
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const accent = theme.accent.primary;
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const rtl = lang === "he";
  /**
   * EN (LTR): top-trailing via insetInlineEnd → physical top-right.
   * HE rail sits on the right; keep badge on physical top-right (outer).
   * Plain insetInlineEnd in RTL would flip to top-left (was wrong).
   * Positive inset keeps badges inside SHELL_RAIL overflowX:hidden.
   */
  const badgeCorner = rtl
    ? ({ top: -2, insetInlineStart: 2 } as const)
    : ({ top: -2, insetInlineEnd: 2 } as const);

  return (
    <div
      data-chrome={`portal-primary-rail-${PORTAL_SHELL_BUILD}`}
      style={{
        ...SHELL_RAIL,
        width: PRIMARY_RAIL_WIDTH,
        flexShrink: 0,
        boxSizing: "border-box",
        padding: "10px 6px 12px",
        background: theme.fill.tertiary,
        borderInlineEnd: `1px solid ${theme.stroke.tertiary}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        height: "100%",
        maxHeight: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        {NAV_SCREENS.map((id) => {
          const selected = screen === id;
          const hovered = hoverKey === id && !selected;
          const emphasized = selected || hovered;
          const badge = badges[id] && badges[id]! > 0 ? badges[id]! : 0;
          const iconColor = emphasized ? accent : theme.text.secondary;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              onMouseEnter={() => setHoverKey(id)}
              onMouseLeave={() =>
                setHoverKey((k) => (k === id ? null : k))
              }
              title={navLabel(lang, id)}
              aria-current={selected ? "page" : undefined}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 2px",
              }}
            >
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: 52,
                    height: 32,
                    borderRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: selected
                      ? theme.fill.secondary
                      : "transparent",
                    boxSizing: "border-box",
                  }}
                >
                  <PortalRailIcon
                    kind={id}
                    active={selected}
                    color={iconColor}
                  />
                </div>
                {badge > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      ...badgeCorner,
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 999,
                      background: theme.category.red,
                      color: theme.text.onAccent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      lineHeight: 1,
                      boxSizing: "border-box",
                      pointerEvents: "none",
                    }}
                  >
                    {badge > 9 ? "9+" : badge}
                  </div>
                ) : null}
              </div>
              <Text
                size="small"
                weight={selected ? "semibold" : "normal"}
                style={{
                  fontSize: 10,
                  lineHeight: 1.15,
                  textAlign: "center",
                  color: emphasized ? accent : theme.text.secondary,
                  maxWidth: 64,
                }}
              >
                {navLabel(lang, id)}
              </Text>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PortalAccountSidebar({
  account,
  onSignOut,
  lang,
  setLang,
}: {
  account: PortalAccount;
  onSignOut: () => void;
  lang: UiLang;
  setLang: (v: UiLang) => void;
}) {
  const theme = useHostTheme();
  const name =
    lang === "he" && account.nameHe
      ? account.nameHe
      : account.displayName;

  return (
    <div
      data-chrome="portal-secondary-sidebar"
      style={{
        ...SHELL_RAIL,
        width: SECONDARY_SIDEBAR_WIDTH,
        flexShrink: 0,
        boxSizing: "border-box",
        padding: "14px 12px 12px",
        background: theme.bg.elevated,
        borderInlineEnd: `1px solid ${theme.stroke.tertiary}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        maxHeight: "100%",
      }}
    >
      <BrandMark size="sm" lang={lang} />
      <Divider />
      <Stack gap={6}>
        <Text size="small" weight="semibold">
          {name}
        </Text>
        <Pill size="sm">{kindLabel(lang, account.kind)}</Pill>
        <Text size="small" tone="tertiary">
          {account.email}
        </Text>
        <Text size="small" tone="tertiary">
          {t(lang, "whatsappLabel")}: {account.phone}
        </Text>
      </Stack>
      <Divider />
      <Stack gap={6}>
        <Text size="small" tone="secondary">
          {t(lang, "english")} | {t(lang, "hebrew")}
        </Text>
        <LangToggle lang={lang} setLang={setLang} />
      </Stack>
      <Text size="small" tone="tertiary">
        {t(lang, "shellHint")}
      </Text>
      <Spacer />
      <Button variant="ghost" onClick={onSignOut}>
        {t(lang, "signOut")}
      </Button>
    </div>
  );
}

function LoginScreen({
  accountId,
  setAccountId,
  email,
  setEmail,
  onSignIn,
  lang,
  setLang,
}: {
  accountId: AccountId;
  setAccountId: (id: AccountId) => void;
  email: string;
  setEmail: (v: string) => void;
  onSignIn: () => void;
  lang: UiLang;
  setLang: (v: UiLang) => void;
}) {
  const theme = useHostTheme();
  const account = ACCOUNTS[accountId];

  return (
    <Stack gap={28} style={{ maxWidth: 720, margin: "0 auto", paddingTop: 24 }}>
      <Row align="center" gap={12} wrap>
        <Spacer />
        <LangToggle lang={lang} setLang={setLang} />
      </Row>

      <Stack gap={16} style={{ alignItems: "flex-start" }}>
        <BrandMark size="lg" lang={lang} />
        <H1 style={{ margin: 0 }}>{t(lang, "loginHeadline")}</H1>
        <Text tone="secondary" style={{ maxWidth: 480 }}>
          {t(lang, "loginIntro")}
        </Text>
        <Row gap={8}>
          <Button variant="primary" onClick={onSignIn}>
            {t(lang, "signIn")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setEmail(account.email);
              onSignIn();
            }}
          >
            {t(lang, "continueDemo")}
          </Button>
        </Row>
      </Stack>

      <Divider />

      <Grid columns={2} gap={20}>
        <Stack gap={12}>
          <H3>{t(lang, "demoAccount")}</H3>
          <Row gap={8} wrap>
            <Pill
              active={accountId === "acme"}
              onClick={() => {
                setAccountId("acme");
                setEmail(ACCOUNTS.acme.email);
              }}
            >
              {t(lang, "companyAcme")}
            </Pill>
            <Pill
              active={accountId === "cohen"}
              onClick={() => {
                setAccountId("cohen");
                setEmail(ACCOUNTS.cohen.email);
              }}
            >
              {t(lang, "individualNoam")}
            </Pill>
          </Row>
          <Text size="small" tone="secondary">
            {t(lang, "demoInviteHint")}
          </Text>
        </Stack>

        <Card>
          <CardHeader>{t(lang, "signIn")}</CardHeader>
          <CardBody>
            <Stack gap={10}>
              <Text size="small" weight="semibold">
                {t(lang, "email")}
              </Text>
              <TextInput
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
              />
              <Text size="small" weight="semibold">
                {t(lang, "password")}
              </Text>
              <TextInput
                value="••••••••"
                onChange={() => {}}
                type="password"
                placeholder={t(lang, "password")}
              />
              <Row gap={8}>
                <Button variant="primary" onClick={onSignIn}>
                  {t(lang, "signIn")}
                </Button>
                <Button variant="ghost">{t(lang, "forgotPassword")}</Button>
              </Row>
              <Text size="small" tone="tertiary">
                {t(lang, "signedInDemo")}: {account.displayName} ·{" "}
                {kindLabel(lang, account.kind)}
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Callout tone="info" title={t(lang, "portalVsWhatsApp")}>
        {t(lang, "portalVsWhatsAppBody")}
      </Callout>

      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${theme.stroke.tertiary}`,
          background: theme.fill.tertiary,
        }}
      >
        <Text size="small" tone="secondary">
          {t(lang, "footerSample")}
        </Text>
      </div>
    </Stack>
  );
}

function HomeScreen({
  account,
  onNavigate,
  lang,
}: {
  account: PortalAccount;
  onNavigate: (s: Screen) => void;
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const openRequests = countBy(
    account.requests,
    (r) => r.status === "pending" || r.status === "in_progress",
  );
  const unpaid = countBy(account.invoices, (i) => i.status === "unpaid");
  const docsNeeded = countBy(account.docs, (d) => d.status === "requested");
  const unread = countBy(account.messages, (m) => Boolean(m.unread));

  const nextActions = [
    docsNeeded > 0
      ? {
          title: `${docsNeeded} ${
            docsNeeded === 1
              ? t(lang, "docsRequestedTitle")
              : t(lang, "docsRequestedTitlePlural")
          }`,
          detail: t(lang, "docsRequestedDetail"),
          screen: "documents" as Screen,
          cta: t(lang, "openDocuments"),
        }
      : null,
    unpaid > 0
      ? {
          title: `${unpaid} ${
            unpaid === 1
              ? t(lang, "unpaidInvoiceTitle")
              : t(lang, "unpaidInvoiceTitlePlural")
          }`,
          detail: t(lang, "unpaidInvoiceDetail"),
          screen: "invoices" as Screen,
          cta: t(lang, "openInvoices"),
        }
      : null,
    openRequests > 0
      ? {
          title: `${openRequests} ${
            openRequests === 1
              ? t(lang, "openRequestTitle")
              : t(lang, "openRequestTitlePlural")
          }`,
          detail: t(lang, "openRequestDetail"),
          screen: "requests" as Screen,
          cta: t(lang, "viewRequests"),
        }
      : null,
    unread > 0
      ? {
          title: `${unread} ${
            unread === 1
              ? t(lang, "unreadMessageTitle")
              : t(lang, "unreadMessageTitlePlural")
          }`,
          detail: t(lang, "unreadMessageDetail"),
          screen: "messages" as Screen,
          cta: t(lang, "openMessages"),
        }
      : null,
  ].filter(Boolean) as {
    title: string;
    detail: string;
    screen: Screen;
    cta: string;
  }[];

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>{lang === "he" ? account.greetingHe : account.greeting}</H1>
        <Text tone="secondary">{t(lang, "homeIntro")}</Text>
      </Stack>

      <Row gap={16} wrap>
        <Stat
          value={String(docsNeeded)}
          label={t(lang, "statDocsRequested")}
          tone="warning"
        />
        <Stat
          value={String(unpaid)}
          label={t(lang, "statUnpaidInvoices")}
          tone="danger"
        />
        <Stat
          value={String(openRequests)}
          label={t(lang, "statOpenRequests")}
          tone="info"
        />
        <Stat
          value={String(unread)}
          label={t(lang, "statUnreadMessages")}
        />
      </Row>

      <H2>{t(lang, "nextActions")}</H2>
      <Stack gap={10}>
        {nextActions.map((action) => (
          <div
            key={action.screen + action.title}
            style={{
              padding: 14,
              borderRadius: 8,
              border: `1px solid ${theme.stroke.secondary}`,
              background: theme.bg.elevated,
            }}
          >
            <Row align="center" gap={12} wrap>
              <Stack gap={4} style={{ flex: 1, minWidth: 200 }}>
                <Text weight="semibold">{action.title}</Text>
                <Text size="small" tone="secondary">
                  {action.detail}
                </Text>
              </Stack>
              <Button
                variant="primary"
                onClick={() => onNavigate(action.screen)}
              >
                {action.cta}
              </Button>
            </Row>
          </div>
        ))}
      </Stack>

      <H2>{t(lang, "serviceSnapshot")}</H2>
      <Text size="small" tone="secondary">
        {t(lang, "serviceSnapshotHint")}
      </Text>
      <Grid columns={2} gap={12}>
        {account.services.map((svc) => (
          <Card key={svc.id}>
            <CardHeader
              trailing={
                <Text
                  size="small"
                  weight="semibold"
                  style={{ color: theme.accent.primary }}
                >
                  {serviceLabel(lang, svc.status)}
                </Text>
              }
            >
              {serviceNameLabel(lang, svc.name)}
            </CardHeader>
            <CardBody>
              <Text size="small" tone="secondary">
                {svc.detail}
              </Text>
            </CardBody>
          </Card>
        ))}
      </Grid>

      <Row gap={8}>
        <Button variant="secondary" onClick={() => onNavigate("services")}>
          {t(lang, "fullServiceStatus")}
        </Button>
        <Button variant="ghost" onClick={() => onNavigate("profile")}>
          {t(lang, "myDetails")}
        </Button>
      </Row>
    </Stack>
  );
}

function DocumentsScreen({
  account,
  uploadedNote,
  setUploadedNote,
  crmRequests,
  setCrmRequests,
  inboundAttachments,
  lang,
}: {
  account: PortalAccount;
  uploadedNote: string;
  setUploadedNote: (v: string) => void;
  crmRequests: PortalCrmDocRequest[];
  setCrmRequests: (
    v: PortalCrmDocRequest[] | ((prev: PortalCrmDocRequest[]) => PortalCrmDocRequest[]),
  ) => void;
  inboundAttachments: PortalInboundAttachment[];
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const [viewCrmId, setViewCrmId] = useState<string | null>(null);
  const requested = account.docs.filter((d) => d.status === "requested");
  const others = account.docs.filter((d) => d.status !== "requested");
  const crmUploadedDocs = crmRequests
    .filter((r) => r.status === "uploaded")
    .map((r) => ({
      id: r.id,
      name: r.uploadedFileName ?? `${r.docName}.pdf`,
      category: t(lang, "crmAutoInDocuments"),
      status: "uploaded" as const,
      note: `${r.docType} · ${r.year}`,
    }));
  const inboundAsShared = inboundAttachments.map((a) => ({
    id: a.id,
    name: a.fileName,
    category:
      a.source === "email"
        ? t(lang, "inboundSourceEmail")
        : t(lang, "inboundSourceWhatsApp"),
    status: "uploaded" as const,
    note: `${a.receivedAt}${a.note ? ` · ${a.note}` : ""}`,
  }));
  const sharedRows = [...inboundAsShared, ...others, ...crmUploadedDocs];
  const queuedPrefix = `${t(lang, "queuedPrefix")}:`;
  const pendingCrm = crmRequests.filter((r) => r.status === "pending");
  const viewing = crmRequests.find((r) => r.id === viewCrmId) ?? null;

  const markCrmUploaded = (id: string) => {
    setCrmRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const fileName = `${r.docName.replace(/\s+/g, "_")}_${r.year}.pdf`;
        return {
          ...r,
          status: "uploaded" as const,
          uploadedFileName: fileName,
        };
      }),
    );
    setViewCrmId(id);
  };

  const addDemoRequest = () => {
    const id = `crm-demo-${Date.now()}`;
    setCrmRequests((prev) => [
      {
        id,
        crmClientHint: "c-yael · Yael Mizrahi",
        year: "2024",
        docName: lang === "he" ? "טופס 106 — מעסיק" : "Form 106 — employer",
        docType: lang === "he" ? "טופס 106" : "Form 106",
        status: "pending",
        createdAt: new Date().toISOString().slice(0, 10),
      },
      ...prev,
    ]);
  };

  const sourceLabel = (source: PortalInboundSource) =>
    source === "email"
      ? t(lang, "inboundSourceEmail")
      : t(lang, "inboundSourceWhatsApp");

  return (
    <Stack gap={18}>
      <Stack gap={6}>
        <H1>{t(lang, "documentsTitle")}</H1>
        <Text tone="secondary">{t(lang, "documentsIntro")}</Text>
      </Stack>

      {requested.length > 0 || pendingCrm.length > 0 ? (
        <Callout tone="warning" title={t(lang, "requestedFromYou")}>
          {`${requested.length + pendingCrm.length} ${
            requested.length + pendingCrm.length === 1
              ? t(lang, "itemsStillNeeded")
              : t(lang, "itemsStillNeededPlural")
          }`}
        </Callout>
      ) : null}

      {inboundAttachments.length > 0 ? (
        <Card>
          <CardHeader>{t(lang, "inboundFromChannels")}</CardHeader>
          <CardBody>
            <Stack gap={10}>
              <Text size="small" tone="secondary">
                {t(lang, "inboundFromChannelsIntro")}
              </Text>
              <Text size="small" tone="tertiary">
                {t(lang, "inboundRegisteredAs")}: {account.email} ·{" "}
                {t(lang, "whatsappLabel")} {account.phone}
              </Text>
              <Table
                headers={[
                  t(lang, "inboundColFile"),
                  t(lang, "inboundColSource"),
                  t(lang, "inboundColFrom"),
                  t(lang, "inboundColReceived"),
                  t(lang, "colStatus"),
                  t(lang, "inboundColNote"),
                ]}
                rows={inboundAttachments.map((a) => [
                  a.fileName,
                  <Pill
                    key={`${a.id}-src`}
                    size="sm"
                    tone={a.source === "email" ? "info" : "success"}
                  >
                    {sourceLabel(a.source)}
                  </Pill>,
                  a.from,
                  a.receivedAt,
                  <Pill key={`${a.id}-st`} size="sm" tone="success">
                    {t(lang, "inboundStatusIngested")}
                  </Pill>,
                  a.note ?? "—",
                ])}
                rowTone={inboundAttachments.map((a) =>
                  a.source === "email" ? "info" : "success",
                )}
                striped
              />
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>{t(lang, "crmDocRequestsTitle")}</CardHeader>
        <CardBody>
          <Stack gap={10}>
            <Text size="small" tone="secondary">
              {t(lang, "crmDocRequestsIntro")}
            </Text>
            <Row gap={8} wrap>
              <Button variant="secondary" onClick={addDemoRequest}>
                {t(lang, "crmAddDemoRequest")}
              </Button>
            </Row>
            {crmRequests.length === 0 ? null : (
              <Stack gap={8}>
                {crmRequests.map((req) => {
                  const uploaded = req.status === "uploaded";
                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: theme.fill.tertiary,
                        border: `1px solid ${
                          uploaded
                            ? theme.category.green
                            : theme.category.yellow
                        }`,
                      }}
                    >
                      <Row gap={8} wrap align="center">
                        <Stack gap={2} style={{ flex: 1, minWidth: 140 }}>
                          <Text size="small" weight="semibold">
                            {req.docName}
                          </Text>
                          <Text size="small" tone="tertiary">
                            {req.docType} · {t(lang, "crmYear")} {req.year} ·{" "}
                            {req.crmClientHint}
                          </Text>
                          {uploaded && req.uploadedFileName ? (
                            <Text size="small" tone="secondary">
                              {req.uploadedFileName}
                            </Text>
                          ) : null}
                        </Stack>
                        <Pill size="sm" tone={uploaded ? "success" : "warning"}>
                          {uploaded
                            ? t(lang, "crmDocUploaded")
                            : t(lang, "crmDocPending")}
                        </Pill>
                        {uploaded ? (
                          <PortalEyeViewButton
                            label={t(lang, "crmViewDoc")}
                            onClick={() => setViewCrmId(req.id)}
                            color={theme.category.green}
                          />
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => markCrmUploaded(req.id)}
                          >
                            {t(lang, "crmMarkUploaded")}
                          </Button>
                        )}
                      </Row>
                    </div>
                  );
                })}
              </Stack>
            )}
            {viewing && viewing.status === "uploaded" ? (
              <Callout tone="success" title={t(lang, "crmDocPreviewTitle")}>
                <Stack gap={8}>
                  <Text size="small">
                    {t(lang, "crmDocPreviewBody").replace(
                      "{file}",
                      viewing.uploadedFileName ?? `${viewing.docName}.pdf`,
                    )}
                  </Text>
                  <Button variant="ghost" onClick={() => setViewCrmId(null)}>
                    {t(lang, "crmClosePreview")}
                  </Button>
                </Stack>
              </Callout>
            ) : null}
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>{t(lang, "uploadDocument")}</CardHeader>
        <CardBody>
          <Stack gap={10}>
            <Text size="small" tone="secondary">
              {t(lang, "uploadHint")}
            </Text>
            <TextInput
              value={uploadedNote}
              onChange={setUploadedNote}
              placeholder={t(lang, "uploadPlaceholder")}
            />
            <Row gap={8}>
              <Button
                variant="primary"
                onClick={() =>
                  setUploadedNote(
                    uploadedNote.trim()
                      ? `${queuedPrefix} ${uploadedNote.trim()}`
                      : t(lang, "queuedUntitled"),
                  )
                }
              >
                {t(lang, "chooseFileUpload")}
              </Button>
              <Button variant="ghost" onClick={() => setUploadedNote("")}>
                {t(lang, "clear")}
              </Button>
            </Row>
            {uploadedNote.startsWith(queuedPrefix) ||
            uploadedNote.startsWith("Queued:") ? (
              <Text size="small" tone="secondary">
                {uploadedNote} · {t(lang, "queuedWouldSave")}
              </Text>
            ) : null}
          </Stack>
        </CardBody>
      </Card>

      <H2>{t(lang, "requested")}</H2>
      <Table
        headers={[
          t(lang, "colDocument"),
          t(lang, "colCategory"),
          t(lang, "colStatus"),
          t(lang, "colDueNote"),
        ]}
        rows={requested.map((d) => [
          d.name,
          d.category,
          docStatusLabel(lang, d.status),
          d.due ?? d.note ?? "—",
        ])}
        rowTone={requested.map((d) => docTone(d.status))}
        striped
      />

      <H2>{t(lang, "sharedAndUploaded")}</H2>
      <Table
        headers={[
          t(lang, "colDocument"),
          t(lang, "colCategory"),
          t(lang, "colStatus"),
          t(lang, "colNote"),
        ]}
        rows={sharedRows.map((d) => [
          d.name,
          d.category,
          docStatusLabel(lang, d.status),
          d.note ?? "—",
        ])}
        rowTone={sharedRows.map((d) => docTone(d.status))}
        striped
      />

      <Text size="small" tone="tertiary">
        {t(lang, "statusLegend")}
      </Text>
      <div
        style={{
          height: 1,
          background: theme.stroke.tertiary,
        }}
      />
    </Stack>
  );
}

function InvoicesScreen({
  account,
  selectedInvoiceId,
  setSelectedInvoiceId,
  lang,
}: {
  account: PortalAccount;
  selectedInvoiceId: string;
  setSelectedInvoiceId: (id: string) => void;
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const selected =
    account.invoices.find((i) => i.id === selectedInvoiceId) ??
    account.invoices[0];

  return (
    <Stack gap={18}>
      <Stack gap={6}>
        <H1>{t(lang, "invoicesTitle")}</H1>
        <Text tone="secondary">{t(lang, "invoicesIntro")}</Text>
      </Stack>

      <Table
        headers={[
          t(lang, "colInvoice"),
          t(lang, "colDate"),
          t(lang, "colAmount"),
          t(lang, "colStatus"),
          t(lang, "colSource"),
        ]}
        rows={account.invoices.map((inv) => [
          <Button
            key={inv.id}
            variant={selected?.id === inv.id ? "primary" : "ghost"}
            onClick={() => setSelectedInvoiceId(inv.id)}
          >
            {inv.number}
          </Button>,
          inv.date,
          inv.amount,
          invoiceStatusLabel(lang, inv.status),
          invoiceSourceLabel(lang, inv),
        ])}
        rowTone={account.invoices.map((inv) => invoiceTone(inv.status))}
        columnAlign={["left", "left", "right", "left", "left"]}
        striped
      />

      {selected ? (
        <Card>
          <CardHeader
            trailing={
              <Pill size="sm">{invoiceSourceLabel(lang, selected)}</Pill>
            }
          >
            {selected.number}
          </CardHeader>
          <CardBody>
            <Stack gap={10}>
              <Text weight="semibold">{selected.description}</Text>
              <Row gap={16} wrap>
                <Text size="small" tone="secondary">
                  {t(lang, "dateLabel")} · {selected.date}
                </Text>
                <Text size="small" tone="secondary">
                  {t(lang, "amountLabel")} · {selected.amount}
                </Text>
                <Text
                  size="small"
                  weight="semibold"
                  style={{
                    color:
                      selected.status === "unpaid"
                        ? theme.category.red
                        : theme.category.green,
                  }}
                >
                  {invoiceStatusLabel(lang, selected.status)}
                </Text>
              </Row>
              <Row gap={8}>
                <Button variant="primary" disabled={selected.status === "paid"}>
                  {t(lang, "payPlaceholder")}
                </Button>
                <Button variant="secondary">{t(lang, "viewPdf")}</Button>
                <Button variant="ghost">{t(lang, "download")}</Button>
              </Row>
              {selected.source === "Wave" ? (
                <Callout tone="neutral" title={t(lang, "historicalWaveTitle")}>
                  {t(lang, "historicalWaveBody")}
                </Callout>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      <Divider />

      <Stack gap={8}>
        <Row gap={8} align="center" wrap>
          <H2>{t(lang, "receiptsTitle")}</H2>
          <Pill size="sm" active>
            {t(lang, "sourceSumit")}
          </Pill>
        </Row>
        <Text tone="secondary">{t(lang, "receiptsIntro")}</Text>
        <Stat
          value={String(account.receipts.length)}
          label={t(lang, "receiptsPulledLabel")}
          tone="info"
        />
        <Table
          headers={[
            t(lang, "colReceipt"),
            t(lang, "colDate"),
            t(lang, "colAmount"),
            t(lang, "colStatus"),
            t(lang, "colSource"),
          ]}
          rows={account.receipts.map((row) => [
            <Stack key={row.id} gap={2}>
              <Text weight="semibold">{row.number}</Text>
              <Text size="small" tone="tertiary">
                {t(lang, "receiptsPulledLabel")}
              </Text>
            </Stack>,
            row.date,
            row.amount,
            receiptStatusLabel(lang, row.status),
            t(lang, "sourceSumit"),
          ])}
          rowTone={account.receipts.map((row) => receiptTone(row.status))}
          columnAlign={["left", "left", "right", "left", "left"]}
          striped
        />
        <Text size="small" tone="tertiary">
          {t(lang, "receiptsCaption")}
        </Text>
      </Stack>
    </Stack>
  );
}

function RequestsScreen({
  account,
  requestDone,
  setRequestDone,
  crmRequests,
  setCrmRequests,
  lang,
}: {
  account: PortalAccount;
  requestDone: Record<string, boolean>;
  setRequestDone: (v: Record<string, boolean>) => void;
  crmRequests: PortalCrmDocRequest[];
  setCrmRequests: (
    v: PortalCrmDocRequest[] | ((prev: PortalCrmDocRequest[]) => PortalCrmDocRequest[]),
  ) => void;
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const [viewCrmId, setViewCrmId] = useState<string | null>(null);
  const todos: TodoItem[] = account.requests.map((r) => {
    if (requestDone[r.id]) {
      return { ...r, status: "completed" as const };
    }
    return r;
  });
  const viewing = crmRequests.find((r) => r.id === viewCrmId) ?? null;

  const markCrmUploaded = (id: string) => {
    setCrmRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const fileName = `${r.docName.replace(/\s+/g, "_")}_${r.year}.pdf`;
        return {
          ...r,
          status: "uploaded" as const,
          uploadedFileName: fileName,
        };
      }),
    );
    setViewCrmId(id);
  };

  return (
    <Stack gap={18}>
      <Stack gap={6}>
        <H1>{t(lang, "requestsTitle")}</H1>
        <Text tone="secondary">{t(lang, "requestsIntro")}</Text>
      </Stack>

      {crmRequests.length > 0 ? (
        <Stack gap={8}>
          <H3>{t(lang, "crmDocRequestsTitle")}</H3>
          <Text size="small" tone="tertiary">
            {t(lang, "crmDocRequestsIntro")}
          </Text>
          {crmRequests.map((req) => {
            const uploaded = req.status === "uploaded";
            return (
              <div
                key={req.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: theme.fill.tertiary,
                  border: `1px solid ${
                    uploaded ? theme.category.green : theme.category.yellow
                  }`,
                }}
              >
                <Row gap={8} wrap align="center">
                  <Stack gap={2} style={{ flex: 1, minWidth: 140 }}>
                    <Text size="small" weight="semibold">
                      {req.docName}
                    </Text>
                    <Text size="small" tone="tertiary">
                      {req.docType} · {req.year}
                    </Text>
                  </Stack>
                  <Pill size="sm" tone={uploaded ? "success" : "warning"}>
                    {uploaded
                      ? t(lang, "crmDocUploaded")
                      : t(lang, "crmDocPending")}
                  </Pill>
                  {uploaded ? (
                    <PortalEyeViewButton
                      label={t(lang, "crmViewDoc")}
                      onClick={() => setViewCrmId(req.id)}
                      color={theme.category.green}
                    />
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => markCrmUploaded(req.id)}
                    >
                      {t(lang, "crmMarkUploaded")}
                    </Button>
                  )}
                </Row>
              </div>
            );
          })}
          {viewing && viewing.status === "uploaded" ? (
            <Callout tone="success" title={t(lang, "crmDocPreviewTitle")}>
              <Stack gap={8}>
                <Text size="small">
                  {t(lang, "crmDocPreviewBody").replace(
                    "{file}",
                    viewing.uploadedFileName ?? `${viewing.docName}.pdf`,
                  )}
                </Text>
                <Button variant="ghost" onClick={() => setViewCrmId(null)}>
                  {t(lang, "crmClosePreview")}
                </Button>
              </Stack>
            </Callout>
          ) : null}
        </Stack>
      ) : null}

      <TodoList
        todos={todos}
        onTodoClick={(todo) => {
          if (todo.status === "completed") {
            setRequestDone({ ...requestDone, [todo.id]: false });
          } else {
            setRequestDone({ ...requestDone, [todo.id]: true });
          }
        }}
      />

      <Callout tone="info" title={t(lang, "tip")}>
        {t(lang, "requestsTipBody")}
      </Callout>
    </Stack>
  );
}

function MessagesScreen({
  account,
  selectedMessageId,
  setSelectedMessageId,
  draft,
  setDraft,
  sentNote,
  setSentNote,
  lang,
}: {
  account: PortalAccount;
  selectedMessageId: string;
  setSelectedMessageId: (id: string) => void;
  draft: string;
  setDraft: (v: string) => void;
  sentNote: string;
  setSentNote: (v: string) => void;
  lang: UiLang;
}) {
  const theme = useHostTheme();
  const selected =
    account.messages.find((m) => m.id === selectedMessageId) ??
    account.messages[0];

  return (
    <Stack gap={18}>
      <Stack gap={6}>
        <H1>{t(lang, "messagesTitle")}</H1>
        <Text tone="secondary">{t(lang, "messagesIntro")}</Text>
      </Stack>

      <Grid columns="minmax(0, 1fr) minmax(0, 1.2fr)" gap={16}>
        <Stack gap={8}>
          <H3>{t(lang, "inbox")}</H3>
          {account.messages.map((msg) => {
            const active = selected?.id === msg.id;
            const author =
              msg.from === "you" ? t(lang, "you") : msg.author;
            return (
              <div
                key={msg.id}
                onClick={() => setSelectedMessageId(msg.id)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `1px solid ${
                    active ? theme.accent.primary : theme.stroke.tertiary
                  }`,
                  background: active
                    ? theme.fill.secondary
                    : theme.bg.elevated,
                }}
              >
                <Stack gap={4}>
                  <Row align="center" gap={8}>
                    <Text size="small" weight="semibold" truncate>
                      {msg.subject}
                    </Text>
                    {msg.unread ? (
                      <Pill size="sm" active>
                        {t(lang, "newBadge")}
                      </Pill>
                    ) : null}
                  </Row>
                  <Text size="small" tone="tertiary">
                    {author} · {msg.time}
                  </Text>
                </Stack>
              </div>
            );
          })}
        </Stack>

        {selected ? (
          <Card>
            <CardHeader>{selected.subject}</CardHeader>
            <CardBody>
              <Stack gap={12}>
                <Row align="center" gap={8}>
                  <Text size="small" weight="semibold">
                    {selected.from === "you"
                      ? t(lang, "you")
                      : selected.author}
                  </Text>
                  <Spacer />
                  <Text size="small" tone="tertiary">
                    {selected.time}
                  </Text>
                </Row>
                <Text>{selected.body}</Text>
                <Divider />
                <Text size="small" weight="semibold">
                  {t(lang, "reply")}
                </Text>
                <TextArea
                  value={draft}
                  onChange={setDraft}
                  placeholder={t(lang, "replyPlaceholder")}
                  rows={4}
                />
                <Row gap={8}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (!draft.trim()) return;
                      setSentNote(
                        `${t(lang, "sentDemo")}: ${draft.trim()}`,
                      );
                      setDraft("");
                    }}
                  >
                    {t(lang, "send")}
                  </Button>
                  <Button variant="ghost" onClick={() => setDraft("")}>
                    {t(lang, "clear")}
                  </Button>
                </Row>
                {sentNote ? (
                  <Text size="small" tone="secondary">
                    {sentNote}
                  </Text>
                ) : null}
              </Stack>
            </CardBody>
          </Card>
        ) : null}
      </Grid>
    </Stack>
  );
}

function ProfileScreen({
  account,
  phoneEdit,
  setPhoneEdit,
  langEdit,
  setLangEdit,
  savedNote,
  setSavedNote,
  lang,
}: {
  account: PortalAccount;
  phoneEdit: string;
  setPhoneEdit: (v: string) => void;
  langEdit: "English" | "Hebrew";
  setLangEdit: (v: "English" | "Hebrew") => void;
  savedNote: string;
  setSavedNote: (v: string) => void;
  lang: UiLang;
}) {
  return (
    <Stack gap={18}>
      <Stack gap={6}>
        <H1>{t(lang, "profileTitle")}</H1>
        <Text tone="secondary">{t(lang, "profileIntro")}</Text>
      </Stack>

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader>{t(lang, "account")}</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Row justify="space-between">
                <Text size="small" tone="secondary">
                  {t(lang, "nameEn")}
                </Text>
                <Text size="small" weight="semibold">
                  {account.displayName}
                </Text>
              </Row>
              <Row justify="space-between">
                <Text size="small" tone="secondary">
                  {t(lang, "nameHe")}
                </Text>
                <Text size="small" weight="semibold">
                  {account.nameHe}
                </Text>
              </Row>
              <Row justify="space-between">
                <Text size="small" tone="secondary">
                  {t(lang, "type")}
                </Text>
                <Pill size="sm">{kindLabel(lang, account.kind)}</Pill>
              </Row>
              <Row justify="space-between">
                <Text size="small" tone="secondary">
                  {account.kind === "Company"
                    ? t(lang, "identityCompany")
                    : t(lang, "identityId")}
                </Text>
                <Text size="small" weight="semibold">
                  {account.identityValue}
                </Text>
              </Row>
              <Text size="small" tone="tertiary">
                {t(lang, "identityReadOnly")}
              </Text>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>{t(lang, "editableContact")}</CardHeader>
          <CardBody>
            <Stack gap={10}>
              <Text size="small" weight="semibold">
                {t(lang, "emailPrimary")}
              </Text>
              <Text size="small" tone="secondary">
                {account.email}
              </Text>
              <Text size="small" tone="tertiary">
                {t(lang, "emailFirmConfirm")}
              </Text>
              <Text size="small" weight="semibold">
                {t(lang, "phone")}
              </Text>
              <TextInput value={phoneEdit} onChange={setPhoneEdit} />
              <Text size="small" weight="semibold">
                {t(lang, "preferredLanguage")}
              </Text>
              <Row gap={8}>
                <Pill
                  active={langEdit === "English"}
                  onClick={() => setLangEdit("English")}
                >
                  {t(lang, "langEnglish")}
                </Pill>
                <Pill
                  active={langEdit === "Hebrew"}
                  onClick={() => setLangEdit("Hebrew")}
                >
                  {t(lang, "langHebrew")}
                </Pill>
              </Row>
              <Row gap={8}>
                <Button
                  variant="primary"
                  onClick={() =>
                    setSavedNote(
                      `${t(lang, "savedDemo")}: ${t(lang, "phone")} ${phoneEdit}, ${t(lang, "languageWord")} ${langEdit}`,
                    )
                  }
                >
                  {t(lang, "saveChanges")}
                </Button>
              </Row>
              {savedNote ? (
                <Text size="small" tone="secondary">
                  {savedNote}
                </Text>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Card>
        <CardHeader>{t(lang, "addressContacts")}</CardHeader>
        <CardBody>
          <Stack gap={6}>
            <Text>{account.address}</Text>
            {account.contactRole ? (
              <Text size="small" tone="secondary">
                {account.contactRole}
              </Text>
            ) : null}
            <Checkbox
              checked
              label={t(lang, "confirmDetails")}
              onChange={() => {}}
            />
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

function ServicesScreen({
  account,
  lang,
}: {
  account: PortalAccount;
  lang: UiLang;
}) {
  const theme = useHostTheme();
  return (
    <Stack gap={18}>
      <Stack gap={6}>
        <H1>{t(lang, "servicesTitle")}</H1>
        <Text tone="secondary">{t(lang, "servicesIntro")}</Text>
      </Stack>

      <Stack gap={12}>
        {account.services.map((svc) => (
          <div
            key={svc.id}
            style={{
              padding: 14,
              borderRadius: 8,
              border: `1px solid ${theme.stroke.secondary}`,
              background: theme.bg.elevated,
            }}
          >
            <Row align="center" gap={12} wrap>
              <Stack gap={4} style={{ flex: 1, minWidth: 220 }}>
                <Text weight="semibold">{serviceNameLabel(lang, svc.name)}</Text>
                <Text size="small" tone="secondary">
                  {svc.detail}
                </Text>
              </Stack>
              <Stat
                value={serviceLabel(lang, svc.status)}
                label={t(lang, "status")}
                tone={serviceTone(svc.status)}
              />
            </Row>
          </div>
        ))}
      </Stack>

      <Callout tone="neutral" title={t(lang, "needSomethingElse")}>
        {t(lang, "needSomethingElseBody")}
      </Callout>
    </Stack>
  );
}

export default function ClientPortalCanvas() {
  const theme = useHostTheme();
  const [screen, setScreen] = useCanvasState<Screen>("portalScreen", "login");
  const [uiLang, setUiLang] = useCanvasState<UiLang>("portalUiLang", "en");
  const [accountId, setAccountId] = useCanvasState<AccountId>(
    "portalAccountId",
    "acme",
  );
  const [email, setEmail] = useCanvasState(
    "portalEmail",
    ACCOUNTS.acme.email,
  );
  const [uploadNote, setUploadNote] = useCanvasState("portalUploadNote", "");
  const [selectedInvoiceId, setSelectedInvoiceId] = useCanvasState(
    "portalInvoiceId",
    "i1",
  );
  const [requestDone, setRequestDone] = useCanvasState<Record<string, boolean>>(
    "portalRequestDone",
    {},
  );
  const [selectedMessageId, setSelectedMessageId] = useCanvasState(
    "portalMessageId",
    "m1",
  );
  const [messageDraft, setMessageDraft] = useCanvasState(
    "portalMessageDraft",
    "",
  );
  const [sentNote, setSentNote] = useCanvasState("portalSentNote", "");
  const [phoneEdit, setPhoneEdit] = useCanvasState(
    "portalPhoneEdit",
    ACCOUNTS.acme.phone,
  );
  const [langEdit, setLangEdit] = useCanvasState<"English" | "Hebrew">(
    "portalLangEdit",
    ACCOUNTS.acme.preferredLanguage,
  );
  const [savedNote, setSavedNote] = useCanvasState("portalSavedNote", "");
  const [crmDocRequests, setCrmDocRequests] = useCanvasState<
    PortalCrmDocRequest[]
  >("portalCrmTaxDocRequests.v1", [
    {
      id: "crm-seed-106-2024",
      crmClientHint: "c-yael · Yael Mizrahi",
      year: "2024",
      docName: "Form 106 — employer",
      docType: "Form 106",
      status: "pending",
      createdAt: "2026-03-10",
    },
    {
      id: "crm-seed-bank-2024",
      crmClientHint: "c-yael · Yael Mizrahi",
      year: "2024",
      docName: "Bank statements 2024",
      docType: "Bank statements",
      status: "pending",
      createdAt: "2026-03-10",
    },
  ]);
  const [inboundAttachments] = useCanvasState<PortalInboundAttachment[]>(
    "portalInboundAttachments.v1",
    DEFAULT_INBOUND_ATTACHMENTS,
  );

  const account = ACCOUNTS[accountId];
  const rtl = uiLang === "he";
  const accountInbound = inboundAttachments.filter(
    (a) => a.accountId === accountId,
  );

  const signIn = () => {
    const next = ACCOUNTS[accountId];
    setPhoneEdit(next.phone);
    setLangEdit(next.preferredLanguage);
    setSelectedInvoiceId(next.invoices[0]?.id ?? "i1");
    setSelectedMessageId(next.messages[0]?.id ?? "m1");
    setRequestDone({});
    setUploadNote("");
    setSentNote("");
    setSavedNote("");
    setMessageDraft("");
    setScreen("home");
  };

  const signOut = () => {
    setScreen("login");
  };

  const navigate = (s: Screen) => {
    if (s === "login") {
      setScreen("login");
      return;
    }
    setScreen(s);
  };

  const activeScreen: Exclude<Screen, "login"> =
    screen === "login" ? "home" : screen;

  const navBadges: Partial<Record<Exclude<Screen, "login">, number>> = {
    documents:
      countBy(account.docs, (d) => d.status === "requested") +
      countBy(crmDocRequests, (r) => r.status === "pending"),
    invoices: countBy(account.invoices, (i) => i.status === "unpaid"),
    requests:
      countBy(
        account.requests,
        (r) =>
          (r.status === "pending" || r.status === "in_progress") &&
          !requestDone[r.id],
      ) + countBy(crmDocRequests, (r) => r.status === "pending"),
    messages: countBy(account.messages, (m) => Boolean(m.unread)),
  };

  const shellStyle = {
    ...SHELL_FILL,
    background: theme.bg.editor,
    color: theme.text.primary,
    direction: (rtl ? "rtl" : "ltr") as "rtl" | "ltr",
    textAlign: (rtl ? "right" : "left") as "right" | "left",
  };

  if (screen === "login") {
    return (
      <div
        style={{
          ...shellStyle,
          overflowY: "auto",
          padding: 24,
        }}
        dir={rtl ? "rtl" : "ltr"}
      >
        <LoginScreen
          accountId={accountId}
          setAccountId={(id) => {
            setAccountId(id);
            setEmail(ACCOUNTS[id].email);
          }}
          email={email}
          setEmail={setEmail}
          onSignIn={signIn}
          lang={uiLang}
          setLang={setUiLang}
        />
      </div>
    );
  }

  return (
    <div style={shellStyle} dir={rtl ? "rtl" : "ltr"}>
      <div
        data-chrome={`portal-shell-${PORTAL_SHELL_BUILD}`}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          ...SHELL_FILL,
        }}
      >
        <PortalPrimaryRail
          screen={activeScreen}
          onNavigate={navigate}
          badges={navBadges}
          lang={uiLang}
        />
        <PortalAccountSidebar
          account={account}
          onSignOut={signOut}
          lang={uiLang}
          setLang={setUiLang}
        />
        <div
          style={{
            ...SHELL_SCROLL,
            padding: "16px 24px 28px",
          }}
        >
          <Stack gap={16} style={{ maxWidth: 960, margin: "0 auto" }}>
            <PortalModuleChromeBar screen={activeScreen} lang={uiLang} />
            {activeScreen === "home" ? (
              <HomeScreen
                account={account}
                onNavigate={navigate}
                lang={uiLang}
              />
            ) : null}
            {activeScreen === "documents" ? (
              <DocumentsScreen
                account={account}
                uploadedNote={uploadNote}
                setUploadedNote={setUploadNote}
                crmRequests={crmDocRequests}
                setCrmRequests={setCrmDocRequests}
                inboundAttachments={accountInbound}
                lang={uiLang}
              />
            ) : null}
            {activeScreen === "invoices" ? (
              <InvoicesScreen
                account={account}
                selectedInvoiceId={selectedInvoiceId}
                setSelectedInvoiceId={setSelectedInvoiceId}
                lang={uiLang}
              />
            ) : null}
            {activeScreen === "requests" ? (
              <RequestsScreen
                account={account}
                requestDone={requestDone}
                setRequestDone={setRequestDone}
                crmRequests={crmDocRequests}
                setCrmRequests={setCrmDocRequests}
                lang={uiLang}
              />
            ) : null}
            {activeScreen === "messages" ? (
              <MessagesScreen
                account={account}
                selectedMessageId={selectedMessageId}
                setSelectedMessageId={setSelectedMessageId}
                draft={messageDraft}
                setDraft={setMessageDraft}
                sentNote={sentNote}
                setSentNote={setSentNote}
                lang={uiLang}
              />
            ) : null}
            {activeScreen === "profile" ? (
              <ProfileScreen
                account={account}
                phoneEdit={phoneEdit}
                setPhoneEdit={setPhoneEdit}
                langEdit={langEdit}
                setLangEdit={setLangEdit}
                savedNote={savedNote}
                setSavedNote={setSavedNote}
                lang={uiLang}
              />
            ) : null}
            {activeScreen === "services" ? (
              <ServicesScreen account={account} lang={uiLang} />
            ) : null}
          </Stack>
        </div>
      </div>
    </div>
  );
}
