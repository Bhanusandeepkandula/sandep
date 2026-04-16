import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import {
  Home,
  BarChart2,
  Wallet,
  User,
  Plus,
  Sparkles,
  RefreshCw,
  Users,
  ArrowLeft,
  Check,
  Bell,
  Pencil,
  X,
  LogOut,
  Copy,
  Trash2,
  QrCode,
  ScanLine,
  Target,
  Lock,
  ChevronRight,
  ClipboardList,
  Camera,
  ImageIcon,
  FileText,
  Palette,
  BrainCircuit,
  AlertTriangle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import ReactCountryFlag from "react-country-flag";
import { T, card, card2, inp, lbl, pill, THEMES, applyTheme } from "./config.js";
import { uid, tdStr, dAgo, getCat, fmt, filterTx, tot, effectiveAmount } from "./utils.js";
import { TxRow } from "./TxRow.jsx";
import { BudgetBar } from "./BudgetBar.jsx";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, deleteUser as fbDeleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db, auth, initAnalytics } from "./firebase.js";
import { FALLBACK_CATALOG, offlineStorageKey, FIXED_EXPENSE_TEMPLATES } from "./fallbackCatalog.js";
import AuthGate from "./AuthGate.jsx";
import { useShellLayout } from "./useShellLayout.js";
import {
  loadProfiles,
  profileDisplayName,
  pinToPassword,
  isValidPin,
  PENDING_LOGIN_EMAIL_KEY,
} from "./auth/pinProfiles.js";
import { parseExpenseCsv } from "./importParse.js";
import {
  extractExpenseJson,
  normalizeScanResult,
  formatMissingScanFieldsMessage,
  isVisionTransactionList,
  buildImportRowsFromVisionTransactions,
} from "./scanAi.js";
import { convertOcrToCsv, convertBillToCsvRobust, ocrTextLooksMissingFourDigitYear } from "./ocrConvert.js";
import { buildImageToExpenseCsvPrompt } from "./ocrExternalLlmPrompt.js";
import { uploadReceiptImage } from "./receiptUpload.js";
import { canRunBrowserOcr, extractReceiptTextWithOcr } from "./receiptOcr.js";
import { extractTextFromFile, fileToDataUrl } from "./docExtract.js";
import { TxDetail } from "./TxDetail.jsx";
import { SplitQrScanModal } from "./SplitQrScanModal.jsx";
import { OcrCsvVoiceControls } from "./OcrCsvVoiceControls.jsx";
import { HomeSkeleton, AnalyticsSkeleton, BudgetsSkeleton } from "./SkeletonBones.jsx";
import { CategoryIcon } from "./categoryIcons.jsx";
import { SpendingReport } from "./SpendingReport.jsx";
import { useDialog } from "./AppDialogs.jsx";
import { PullToRefresh } from "./PullToRefresh.jsx";
import {
  buildSplitSharePayload,
  parseSplitSharePayload,
  normalizePerson,
  sameSplitPerson,
  personStableKey,
} from "./splitContactShare.js";
import {
  enrichSplitPeopleFromContacts,
  publishPeerProfileIndex,
  upsertSplitMirrors,
  deleteMirrorsForOwnerTransaction,
} from "./splitPeerSync.js";

/** UI + modal value for overall monthly cap (stored as `monthlyBudgetTotal` on settings/app, not under `budgets`). */
const MONTH_TOTAL_BUDGET_KEY = "__month_total__";

const CURRENCIES = [
  { code: "INR", country: "IN", locale: "en-IN", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", country: "US", locale: "en-US", symbol: "$", name: "US Dollar" },
  { code: "EUR", country: "EU", locale: "de-DE", symbol: "€", name: "Euro" },
  { code: "GBP", country: "GB", locale: "en-GB", symbol: "£", name: "British Pound" },
  { code: "JPY", country: "JP", locale: "ja-JP", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", country: "CN", locale: "zh-CN", symbol: "¥", name: "Chinese Yuan" },
  { code: "AUD", country: "AU", locale: "en-AU", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", country: "CA", locale: "en-CA", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", country: "CH", locale: "de-CH", symbol: "CHF", name: "Swiss Franc" },
  { code: "SGD", country: "SG", locale: "en-SG", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", country: "HK", locale: "zh-HK", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "KRW", country: "KR", locale: "ko-KR", symbol: "₩", name: "South Korean Won" },
  { code: "MXN", country: "MX", locale: "es-MX", symbol: "MX$", name: "Mexican Peso" },
  { code: "BRL", country: "BR", locale: "pt-BR", symbol: "R$", name: "Brazilian Real" },
  { code: "ZAR", country: "ZA", locale: "en-ZA", symbol: "R", name: "South African Rand" },
  { code: "AED", country: "AE", locale: "ar-AE", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", country: "SA", locale: "ar-SA", symbol: "﷼", name: "Saudi Riyal" },
  { code: "THB", country: "TH", locale: "th-TH", symbol: "฿", name: "Thai Baht" },
  { code: "IDR", country: "ID", locale: "id-ID", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "MYR", country: "MY", locale: "ms-MY", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "PHP", country: "PH", locale: "en-PH", symbol: "₱", name: "Philippine Peso" },
  { code: "VND", country: "VN", locale: "vi-VN", symbol: "₫", name: "Vietnamese Dong" },
  { code: "TWD", country: "TW", locale: "zh-TW", symbol: "NT$", name: "New Taiwan Dollar" },
  { code: "TRY", country: "TR", locale: "tr-TR", symbol: "₺", name: "Turkish Lira" },
  { code: "RUB", country: "RU", locale: "ru-RU", symbol: "₽", name: "Russian Ruble" },
  { code: "PLN", country: "PL", locale: "pl-PL", symbol: "zł", name: "Polish Zloty" },
  { code: "SEK", country: "SE", locale: "sv-SE", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", country: "NO", locale: "nb-NO", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", country: "DK", locale: "da-DK", symbol: "kr", name: "Danish Krone" },
  { code: "NZD", country: "NZ", locale: "en-NZ", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "EGP", country: "EG", locale: "ar-EG", symbol: "E£", name: "Egyptian Pound" },
  { code: "NGN", country: "NG", locale: "en-NG", symbol: "₦", name: "Nigerian Naira" },
  { code: "KES", country: "KE", locale: "en-KE", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "PKR", country: "PK", locale: "ur-PK", symbol: "₨", name: "Pakistani Rupee" },
  { code: "BDT", country: "BD", locale: "bn-BD", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "LKR", country: "LK", locale: "si-LK", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "NPR", country: "NP", locale: "ne-NP", symbol: "Rs", name: "Nepalese Rupee" },
  { code: "CLP", country: "CL", locale: "es-CL", symbol: "CL$", name: "Chilean Peso" },
  { code: "COP", country: "CO", locale: "es-CO", symbol: "COL$", name: "Colombian Peso" },
  { code: "ARS", country: "AR", locale: "es-AR", symbol: "AR$", name: "Argentine Peso" },
  { code: "PEN", country: "PE", locale: "es-PE", symbol: "S/", name: "Peruvian Sol" },
];

/**
 * SVG flag for a currency (Twemoji via react-country-flag).
 * Falls back to currency code when the country is unknown (e.g. EUR/EU).
 */
function CurrencyFlag({ country, code, size = 20, round = false }) {
  const cc = (country || "").toUpperCase();
  if (!cc || cc === "EU") {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: size * 1.35, height: size,
          borderRadius: round ? "50%" : 4,
          background: "linear-gradient(135deg,#003399,#ffcc00)",
          color: "#fff", fontSize: Math.round(size * 0.52), fontWeight: 800,
          letterSpacing: 0.4, flexShrink: 0,
        }}
      >
        {code || "€"}
      </span>
    );
  }
  return (
    <ReactCountryFlag
      countryCode={cc}
      svg
      aria-label={cc}
      style={{
        width: size * 1.35,
        height: size,
        borderRadius: round ? "50%" : 3,
        objectFit: "cover",
        flexShrink: 0,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.08) inset",
      }}
      title={cc}
    />
  );
}

/**
 * Collapsible copy-paste prompt for vision LLMs (ChatGPT, Claude, Gemini, etc.) → expense CSV.
 * @param {{ prompt: string; onCopy: () => void | Promise<void>; disabled?: boolean; blurb: string }} p
 */
function ExternalLlmCsvPromptPanel({ prompt, onCopy, disabled, blurb }) {
  return (
    <details style={{ ...card2, marginTop: 14, marginBottom: 12, fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, color: T.txt, userSelect: "none" }}>
        Universal prompt: image → expense CSV (any LLM)
      </summary>
      <div style={{ marginTop: 12 }}>
        <p style={{ margin: "0 0 10px", color: T.sub }}>{blurb}</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onCopy()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: T.r,
              border: "none",
              background: disabled ? T.mut : T.acc,
              color: T.btnTxt,
              fontWeight: 700,
              fontSize: 13,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <Copy size={16} aria-hidden />
            Copy prompt
          </button>
          <span style={{ fontSize: 11, color: T.mut }}>Includes your app’s category and payment names.</span>
        </div>
        <textarea
          readOnly
          value={prompt}
          rows={14}
          aria-label="Prompt to copy for external AI tools"
          style={{
            ...inp,
            width: "100%",
            fontFamily: "ui-monospace, monospace",
            fontSize: 16,
            lineHeight: 1.35,
            resize: "vertical",
            minHeight: 200,
            maxHeight: 360,
          }}
        />
      </div>
    </details>
  );
}

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

function sanitizeForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export default function App({ onReady }) {
  const dlg = useDialog();
  const [tab, setTabRaw] = useState("home");
  const setTab = useCallback((t) => {
    setTabRaw((prev) => {
      if (t !== prev && mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
      return t;
    });
  }, []);
  const [txs, setTxs] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [fixedDraft, setFixedDraft] = useState({ name: "", amount: "", category: "", dueDay: "1" });
  const [people, setPeople] = useState([]);
  const [catalog, setCatalog] = useState({
    categories: [],
    payments: [],
    currencyCode: "",
    locale: "",
    dateLocale: "",
    footerLine1: "",
    footerLine2: "",
  });
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [df, setDf] = useState("month");
  const [cS, setCS] = useState("");
  const [cE, setCE] = useState("");

  const [addMode, setAddMode] = useState("manual");
  const [step, setStep] = useState("mode");
  const [form, setForm] = useState({ amount: "", category: "", date: tdStr(), payment: "", notes: "", tags: "" });
  const [fErr, setFErr] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  /** Brief confirmation after save when navigating to Home. */
  const [splitOn, setSplitOn] = useState(false);
  const [splitType, setSplitType] = useState("equal");
  const [splitPpl, setSplitPpl] = useState([]);
  const [previewImg, setPreviewImg] = useState(null);
  /** Optional rows from last AI scan (line items). */
  const [scanLineItems, setScanLineItems] = useState(null);
  /** During image/statement scan: read → ai → parse. */
  const [scanPhase, setScanPhase] = useState(null);
  const [scanErr, setScanErr] = useState("");
  /** After receipt scan: fields the model could not read (suppresses auto-fill for those). */
  const [scanMissingFieldKeys, setScanMissingFieldKeys] = useState([]);
  /** Friendly prompt asking the user to complete missing bill details. */
  const [scanFillPrompt, setScanFillPrompt] = useState("");
  const scanCameraRef = useRef();
  const scanGalleryRef = useRef();
  const stmtRef = useRef();
  const csvRef = useRef();
  const ocrCsvImgRef = useRef();
  /** Last uploaded image on OCR→CSV (for vision fallback when local OCR → CSV is weak). */
  const ocrCsvImageDataUrlRef = useRef(null);
  const mainScrollRef = useRef(null);
  const handlePullRefresh = useCallback(async () => {
    dlg.toast("Refreshed", { type: "success", duration: 1500 });
  }, [dlg]);
  /** Paste OCR / bill text → OpenAI → import-ready CSV (dev: Vite /api/convert). */
  const [ocrCsvText, setOcrCsvText] = useState("");
  const [ocrCsvOut, setOcrCsvOut] = useState("");
  const [ocrCsvBusy, setOcrCsvBusy] = useState(false);
  const [ocrCsvTessBusy, setOcrCsvTessBusy] = useState(false);
  const [ocrCsvErr, setOcrCsvErr] = useState("");
  /** Short prompts from the model when OCR/image data was incomplete — user should answer in the text box and convert again. */
  const [ocrCsvFollowUp, setOcrCsvFollowUp] = useState(/** @type {string[]} */ ([]));
  /** Sent to OpenAI before CSV conversion so statement screenshots are not dated with a guessed year. */
  const [ocrDateYear, setOcrDateYear] = useState(() => String(new Date().getFullYear()));
  /** Optional 01–12 when OCR shows day-only lines. */
  const [ocrDateMonth, setOcrDateMonth] = useState("");
  /** User cancelled mid-scan or navigated away from processing. */
  const scanCancelledRef = useRef(false);
  /** Abort in-flight Anthropic request when user cancels. */
  const scanFetchAbortRef = useRef(null);
  /** Phase order for current scan: includes `ocr` when Tesseract runs on this file. */
  const scanPhaseOrderRef = useRef(["read", "ai", "parse"]);
  /** Parsed CSV ready to confirm (one file per import). */
  const [importBundle, setImportBundle] = useState(null);
  const [importSaving, setImportSaving] = useState(false);
  const [editingImportIdx, setEditingImportIdx] = useState(null);
  const [editImportDraft, setEditImportDraft] = useState(null);
  /** When set, success screen shows bulk-import copy. */
  const [bulkSuccess, setBulkSuccess] = useState(null);

  const [selectedTx, setSelectedTx] = useState(null);
  /** Tracks which tx IDs we've already seen from Firestore (to detect newly-arrived mirrors). */
  const seenTxIdsRef = useRef(null);
  /** Tracks mirror tx ids we've already notified for (prevents duplicate toasts across reconnects). */
  const notifiedMirrorIdsRef = useRef(new Set());
  /** Tracks last-known amount for each mirror so we can notify on master edits. */
  const mirrorAmountRef = useRef({});
  /** Tracks last-known metadata for each mirror (category/notes) so deletion notifications can name the bill. */
  const mirrorMetaRef = useRef({});
  /** Tracks last-known settlement state on the MASTER's own tx docs so we can notify the master when a peer settles (or un-settles). Keyed by txId → { [peerUid]: amount }. */
  const peerSettlementsRef = useRef({});
  /** Tracks last-known `settlement` field on mirror txs so the slave gets notified when the master records (or clears) a payment on their behalf. */
  const mirrorSettlementRef = useRef({});
  /** Pending cross-user settlement writes that the slave couldn't push to the master yet (rules not deployed, offline, etc.). Retried on mount / focus / online / every new save. */
  const pendingPeerWritesRef = useRef([]);
  const pendingRetryTimerRef = useRef(null);

  const [tips, setTips] = useState([]);
  const [ldTips, setLdTips] = useState(false);
  /** Timestamp of last saved AI insights (Firestore); new generation replaces stored tips. */
  const [aiInsightsUpdatedAt, setAiInsightsUpdatedAt] = useState(0);
  const [insightHomeDismissRev, setInsightHomeDismissRev] = useState(0);

  const [showBM, setShowBM] = useState(false);
  const [budgetSubTab, setBudgetSubTab] = useState("budgets");
  const [reportSubTab, setReportSubTab] = useState("spending");
  /** Header-level display-name editor (bottom-sheet card). */
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [bmCat, setBmCat] = useState("");
  const [bmAmt, setBmAmt] = useState("");
  /** Overall monthly spending cap (optional, no category). Synced as `monthlyBudgetTotal` in Firestore. */
  const [monthlyBudgetTotal, setMonthlyBudgetTotal] = useState(null);

  const [newP, setNewP] = useState("");

  /** When set, overrides global `config/app` for this user only (stored in settings/app). */
  const [userCategories, setUserCategories] = useState(null);
  const [userPayments, setUserPayments] = useState(null);
  const [userCurrency, setUserCurrency] = useState(null);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [reportFreq, setReportFreq] = useState("weekly");
  const [userTheme, setUserTheme] = useState(() => {
    try { return localStorage.getItem("track_theme") || "default"; } catch { return "default"; }
  });
  const [, setThemeVer] = useState(0);

  const [fbStatus, setFbStatus] = useState("loading");
  const [fbErrorDetail, setFbErrorDetail] = useState("");
  /** Increment to re-run Firebase bootstrap (e.g. after transient Firestore `unavailable`). */
  const [fbBootKey, setFbBootKey] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  /** Stable UUID for this person (stored in settings + device); written on each transaction. */
  const [profileTagUuid, setProfileTagUuid] = useState("");
  const [deviceProfiles, setDeviceProfiles] = useState(() => loadProfiles());
  const [signInIdCopied, setSignInIdCopied] = useState(false);
  /** PIN confirmation modal: delete all expenses for the signed-in Firebase account. */
  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [deleteAllPin, setDeleteAllPin] = useState("");
  const [deleteAllErr, setDeleteAllErr] = useState("");
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [deleteAcctModal, setDeleteAcctModal] = useState(false);
  const [deleteAcctPin, setDeleteAcctPin] = useState("");
  const [deleteAcctErr, setDeleteAcctErr] = useState("");
  const [deleteAcctBusy, setDeleteAcctBusy] = useState(false);
  const [showProfileQr, setShowProfileQr] = useState(false);
  const [profileQrCopied, setProfileQrCopied] = useState(false);
  const [showSplitScan, setShowSplitScan] = useState(false);
  const layout = useShellLayout();
  const { maxShell, w: vw, px, twoCol, comfortable, chart, safeBottom, safeTop, isMobile } = layout;
  const uidRef = useRef(null);
  const catalogRef = useRef(catalog);

  const effectiveCatalog = useMemo(() => {
    const F = FALLBACK_CATALOG;
    const emptyCat = !catalog.categories?.length;
    const emptyPay = !catalog.payments?.length;
    const useFallback =
      fbStatus !== "loading" &&
      (fbStatus === "error" ||
        fbStatus === "auth" ||
        (fbStatus === "ready" && (emptyCat || emptyPay)));
    let base = catalog;
    if (useFallback) {
      base = {
        ...catalog,
        categories: emptyCat ? F.categories : catalog.categories,
        payments: emptyPay ? F.payments : catalog.payments,
        currencyCode: catalog.currencyCode || F.currencyCode,
        locale: catalog.locale || F.locale,
        dateLocale: catalog.dateLocale || F.dateLocale,
        footerLine1: catalog.footerLine1 || F.footerLine1,
        footerLine2: catalog.footerLine2 || F.footerLine2,
      };
    }
    const merged = {
      ...base,
      categories: userCategories && userCategories.length > 0 ? userCategories : base.categories,
      payments: userPayments && userPayments.length > 0 ? userPayments : base.payments,
    };
    if (userCurrency && userCurrency.code) {
      merged.currencyCode = userCurrency.code;
      merged.locale = userCurrency.locale || merged.locale;
    }
    return merged;
  }, [catalog, fbStatus, userCategories, userPayments, userCurrency]);

  useEffect(() => {
    catalogRef.current = effectiveCatalog;
  }, [effectiveCatalog]);

  const { categories, payments, currencyCode, locale, dateLocale, footerLine1, footerLine2 } = effectiveCatalog;

  const externalLlmImagePrompt = useMemo(() => {
    const catNames = (categories || []).map((c) => c.n).filter(Boolean);
    const payNames = (payments || []).filter(Boolean);
    return buildImageToExpenseCsvPrompt({
      categories: catNames,
      payments: payNames,
      today: new Date().toISOString().split("T")[0],
    });
  }, [categories, payments]);

  const copyExternalLlmImagePrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(externalLlmImagePrompt);
      dlg.toast("Copied prompt — open any AI, paste, attach your image, then paste CSV back here", { type: "success" });
      
    } catch {
      dlg.toast("Could not copy — select the gray box text and copy manually", { type: "warn" });
      
    }
  }, [externalLlmImagePrompt]);

  const formatMoney = useCallback(
    (n) => fmt(n, { currency: currencyCode || undefined, locale: locale || undefined }),
    [currencyCode, locale]
  );
  const formatMoneyRef = useRef(formatMoney);
  useEffect(() => { formatMoneyRef.current = formatMoney; }, [formatMoney]);
  const profileTagUuidRef = useRef("");
  useEffect(() => { profileTagUuidRef.current = profileTagUuid || ""; }, [profileTagUuid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthChecked(true);
      if (typeof onReady === "function") onReady();
    });
    return () => unsub();
  }, [onReady]);

  useEffect(() => {
    applyTheme(userTheme);
    setThemeVer((v) => v + 1);
  }, [userTheme]);

  useEffect(() => {
    let active = true;
    let unsubTx;
    let unsubSettings;
    let unsubCatalog;

    if (!firebaseUser) {
      uidRef.current = null;
      setProfileTagUuid("");
      seenTxIdsRef.current = null;
      peerSettlementsRef.current = {};
      mirrorSettlementRef.current = {};
      notifiedMirrorIdsRef.current = new Set();
      mirrorAmountRef.current = {};
      mirrorMetaRef.current = {};
      if (authChecked) {
        setFbStatus("auth");
        setFbErrorDetail("");
        setTxs([]);
        setBudgets({});
        setPeople([]);
        setUserCategories(null);
        setUserPayments(null);
        setCatalog({
          categories: [],
          payments: [],
          currencyCode: "",
          locale: "",
          dateLocale: "",
          footerLine1: "",
          footerLine2: "",
        });
        setProfileName("");
        setProfileEmail("");
      } else {
        setFbStatus("loading");
      }
      return () => {
        active = false;
      };
    }

    function isFirestoreTransient(err) {
      const c = err?.code;
      if (c === "unavailable" || c === "deadline-exceeded") return true;
      const m = typeof err?.message === "string" ? err.message.toLowerCase() : "";
      return m.includes("offline") || m.includes("failed to get document");
    }

    async function readSettingsDoc(settingsRef) {
      const maxAttempts = 4;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 350 * attempt));
          return await getDoc(settingsRef);
        } catch (e) {
          if (!active) throw e;
          if (isFirestoreTransient(e) && attempt < maxAttempts - 1) continue;
          if (isFirestoreTransient(e)) {
            console.warn("Firestore settings read skipped (offline/transient). Listeners will retry.", e);
            return null;
          }
          throw e;
        }
      }
      return null;
    }

    (async () => {
      try {
        setFbErrorDetail("");
        const uid = firebaseUser.uid;
        if (!active) return;
        uidRef.current = uid;

        const txsCol = collection(db, "users", uid, "transactions");
        const settingsRef = doc(db, "users", uid, "settings", "app");
        const catalogRefDoc = doc(db, "config", "app");

        unsubCatalog = onSnapshot(catalogRefDoc, (snap) => {
          if (!active) return;
          if (!snap.exists()) {
            setCatalog({
              categories: [],
              payments: [],
              currencyCode: "",
              locale: "",
              dateLocale: "",
              footerLine1: "",
              footerLine2: "",
            });
            return;
          }
          const d = snap.data();
          setCatalog({
            categories: Array.isArray(d.categories) ? d.categories : [],
            payments: Array.isArray(d.payments) ? d.payments : [],
            currencyCode: typeof d.currencyCode === "string" ? d.currencyCode : "",
            locale: typeof d.locale === "string" ? d.locale : "",
            dateLocale: typeof d.dateLocale === "string" ? d.dateLocale : "",
            footerLine1: typeof d.footerLine1 === "string" ? d.footerLine1 : "",
            footerLine2: typeof d.footerLine2 === "string" ? d.footerLine2 : "",
          });
        });

        const settingsSnap = await readSettingsDoc(settingsRef);
        if (active && settingsSnap && !settingsSnap.exists()) {
          try {
            await setDoc(
              settingsRef,
              { budgets: {}, people: [], profileName: "", profileEmail: "", appProfileUuid: "" },
              { merge: true }
            );
          } catch (e) {
            if (!isFirestoreTransient(e)) throw e;
            console.warn("Initial settings setDoc skipped (offline/transient).", e);
          }
        }

        if (!active) return;

        unsubTx = onSnapshot(txsCol, (snap) => {
          if (!active) return;
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
          const prevSeen = seenTxIdsRef.current;
          if (prevSeen !== null) {
            for (const tx of rows) {
              const isMirror =
                typeof tx.syncedFromUid === "string" &&
                tx.syncedFromUid.trim() &&
                tx.syncedFromUid !== uidRef.current;

              /* Master-side: a peer just updated/cleared their slot in
               * `settlements` on a bill I paid for. Diff against last-known
               * peer settlements for this tx so we surface a single toast per
               * real change (not just every snapshot). */
              if (!isMirror) {
                const curMap = (tx && tx.settlements && typeof tx.settlements === "object") ? tx.settlements : {};
                const prevMap = peerSettlementsRef.current[tx.id] || {};
                const allKeys = new Set([...Object.keys(curMap), ...Object.keys(prevMap)]);
                const merchant = (typeof tx.notes === "string" && tx.notes.trim()) || tx.category || "Expense";
                for (const peerUid of allKeys) {
                  if (peerUid === uidRef.current) continue; // never notify myself
                  const curEntry = curMap[peerUid] || null;
                  const prevEntry = prevMap[peerUid] || null;
                  const curAmt = Number(curEntry?.amount) || 0;
                  const prevAmt = Number(prevEntry?.amount) || 0;
                  if (curAmt === prevAmt && Boolean(curEntry) === Boolean(prevEntry)) continue;

                  const peerName = (curEntry?.byName || prevEntry?.byName || "").trim() || "A friend";
                  if (!prevEntry && curEntry) {
                    const body = `${peerName} paid you ${formatMoneyRef.current(curAmt)} for ${merchant}`;
                    dlg.toast(body, {
                      type: "success",
                      title: curEntry.full ? "Fully settled by peer" : "Settlement received",
                      duration: 6000,
                      actionLabel: "View",
                      onClick: () => { setSelectedTx(tx); setTab("home"); },
                    });
                    try {
                      if ("Notification" in window) {
                        if (Notification.permission === "default") void Notification.requestPermission();
                        if (Notification.permission === "granted") {
                          const n = new Notification("Settlement received 💰", {
                            body, tag: `settle-in-${tx.id}-${peerUid}`, icon: "/favicon.ico",
                          });
                          n.onclick = () => { try { window.focus(); } catch { /* ignore */ } setSelectedTx(tx); setTab("home"); };
                        }
                      }
                      if ("vibrate" in navigator) navigator.vibrate([60, 40, 120]);
                    } catch { /* ignore */ }
                  } else if (prevEntry && !curEntry) {
                    const body = `${peerName} removed their ${formatMoneyRef.current(prevAmt)} settlement on ${merchant}`;
                    dlg.toast(body, {
                      type: "warn",
                      title: "Settlement reversed",
                      duration: 6000,
                    });
                    try {
                      if ("Notification" in window && Notification.permission === "granted") {
                        const n = new Notification("Settlement reversed", { body, tag: `settle-rev-${tx.id}-${peerUid}`, icon: "/favicon.ico" });
                        n.onclick = () => { try { window.focus(); } catch { /* ignore */ } };
                      }
                      if ("vibrate" in navigator) navigator.vibrate([140, 60, 60]);
                    } catch { /* ignore */ }
                  } else if (prevEntry && curEntry && curAmt !== prevAmt) {
                    const body = `${peerName} updated settlement to ${formatMoneyRef.current(curAmt)} on ${merchant}`;
                    dlg.toast(body, {
                      type: "info",
                      title: "Settlement updated",
                      duration: 5000,
                      actionLabel: "View",
                      onClick: () => { setSelectedTx(tx); setTab("home"); },
                    });
                  }
                }
                peerSettlementsRef.current[tx.id] = { ...curMap };
                continue;
              }



              const selfUuid = profileTagUuidRef.current || "";
              const selfEntry = Array.isArray(tx?.split?.people)
                ? tx.split.people.find((p) => p && (
                    (typeof p.fuid === "string" && p.fuid === uidRef.current) ||
                    (typeof p.u === "string" && p.u === selfUuid)
                  ))
                : null;
              const rawShare = selfEntry && typeof selfEntry.a === "number" && Number.isFinite(selfEntry.a)
                ? selfEntry.a : null;
              const amtFmt = rawShare != null
                ? formatMoneyRef.current(rawShare)
                : formatMoneyRef.current(Number(tx.amount) || 0);
              const merchant = (typeof tx.notes === "string" && tx.notes.trim()) || tx.category || "Expense";

              const isNew = !prevSeen.has(tx.id) && !notifiedMirrorIdsRef.current.has(tx.id);
              const prevAmt = mirrorAmountRef.current[tx.id];
              const curAmt = Number(tx.amount) || 0;
              const isUpdated = prevSeen.has(tx.id) && prevAmt !== undefined && prevAmt !== curAmt;

              if (isNew) {
                notifiedMirrorIdsRef.current.add(tx.id);
                const body = `${merchant} · your share ${amtFmt} (bill ${formatMoneyRef.current(curAmt)})`;
                dlg.toast(body, {
                  type: "info",
                  title: "New split received",
                  duration: 7000,
                  actionLabel: "View",
                  onClick: () => { setSelectedTx(tx); setTab("home"); },
                });
                try {
                  if ("Notification" in window) {
                    if (Notification.permission === "default") void Notification.requestPermission();
                    if (Notification.permission === "granted") {
                      const n = new Notification("New split received 💸", {
                        body,
                        tag: `split-${tx.id}`,
                        icon: "/favicon.ico",
                      });
                      n.onclick = () => { window.focus(); setSelectedTx(tx); setTab("home"); };
                    }
                  }
                  if ("vibrate" in navigator) navigator.vibrate([120, 60, 120]);
                } catch { /* ignore */ }
              } else if (isUpdated) {
                const body = `${merchant} updated · your share ${amtFmt} (bill ${formatMoneyRef.current(curAmt)})`;
                dlg.toast(body, {
                  type: "info",
                  title: "Split updated",
                  duration: 5000,
                  actionLabel: "View",
                  onClick: () => { setSelectedTx(tx); setTab("home"); },
                });
                try {
                  if ("Notification" in window && Notification.permission === "granted") {
                    const n = new Notification("Split updated 💸", { body, tag: `split-upd-${tx.id}`, icon: "/favicon.ico" });
                    n.onclick = () => { window.focus(); setSelectedTx(tx); setTab("home"); };
                  }
                } catch { /* ignore */ }
              }
              mirrorAmountRef.current[tx.id] = curAmt;
              mirrorMetaRef.current[tx.id] = {
                category: tx.category || "",
                notes: tx.notes || "",
                amount: curAmt,
              };

              /* Slave-side: detect master-recorded settlement changes on this
               * mirror. We only surface a notification when the change was
               * flagged `recordedByMaster: true` — otherwise the slave just
               * saw their own save round-trip through Firestore. */
              const prevS = mirrorSettlementRef.current[tx.id] || null;
              const curS = (tx && tx.settlement && typeof tx.settlement === "object") ? tx.settlement : null;
              const prevAmtS = Number(prevS?.amount) || 0;
              const curAmtS = Number(curS?.amount) || 0;
              const fromMaster = Boolean(curS?.recordedByMaster) || Boolean(prevS?.recordedByMaster);
              if (fromMaster) {
                if (!prevS && curS) {
                  const body = `${merchant} · ${formatMoneyRef.current(curAmtS)} ${curS.full ? "fully" : "partially"} recorded by the payer`;
                  dlg.toast(body, {
                    type: "info",
                    title: "Payment logged by payer",
                    duration: 6000,
                    actionLabel: "View",
                    onClick: () => { setSelectedTx(tx); setTab("home"); },
                  });
                  try {
                    if ("Notification" in window && Notification.permission === "granted") {
                      const n = new Notification("Payment logged by payer", { body, tag: `mirror-settle-${tx.id}`, icon: "/favicon.ico" });
                      n.onclick = () => { try { window.focus(); } catch { /* ignore */ } setSelectedTx(tx); setTab("home"); };
                    }
                    if ("vibrate" in navigator) navigator.vibrate([60, 40, 120]);
                  } catch { /* ignore */ }
                } else if (prevS && !curS) {
                  const body = `${merchant} · the payer cleared a ${formatMoneyRef.current(prevAmtS)} payment from your side`;
                  dlg.toast(body, { type: "warn", title: "Payment cleared by payer", duration: 6000 });
                  try {
                    if ("Notification" in window && Notification.permission === "granted") {
                      const n = new Notification("Payment cleared by payer", { body, tag: `mirror-settle-clr-${tx.id}`, icon: "/favicon.ico" });
                      n.onclick = () => { try { window.focus(); } catch { /* ignore */ } };
                    }
                    if ("vibrate" in navigator) navigator.vibrate([140, 60, 60]);
                  } catch { /* ignore */ }
                } else if (prevS && curS && prevAmtS !== curAmtS) {
                  const body = `${merchant} · payer updated your settlement to ${formatMoneyRef.current(curAmtS)}`;
                  dlg.toast(body, { type: "info", title: "Settlement updated", duration: 5000 });
                }
              }
              mirrorSettlementRef.current[tx.id] = curS ? { ...curS } : null;
            }

            /* Mirror deletion detection — if a tx id we knew about is gone AND it was a
             * mirror, the master deleted the bill on their side. Surface a toast + native
             * notification so the slave isn't surprised by disappearing rows. */
            const currentIds = new Set(rows.map((r) => r.id));
            for (const oldId of prevSeen) {
              if (currentIds.has(oldId)) continue;
              const meta = mirrorMetaRef.current[oldId];
              if (!meta) continue; // not a mirror we tracked
              const merchant = (meta.notes && meta.notes.trim()) || meta.category || "Expense";
              const body = `${merchant} · ${formatMoneyRef.current(meta.amount || 0)} removed by the payer`;
              dlg.toast(body, {
                type: "warn",
                title: "Split removed",
                duration: 5000,
              });
              try {
                if ("Notification" in window && Notification.permission === "granted") {
                  const n = new Notification("Split removed", { body, tag: `split-del-${oldId}`, icon: "/favicon.ico" });
                  n.onclick = () => { try { window.focus(); } catch { /* ignore */ } };
                }
              } catch { /* ignore */ }
              try {
                if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([80, 40, 80]);
              } catch { /* ignore */ }
              delete mirrorAmountRef.current[oldId];
              delete mirrorMetaRef.current[oldId];
              notifiedMirrorIdsRef.current.delete(oldId);
            }
          }
          // Seed amounts for all mirrors on first load (no notification, just baseline)
          if (prevSeen === null) {
            for (const tx of rows) {
              const isMirror = typeof tx.syncedFromUid === "string" && tx.syncedFromUid.trim() && tx.syncedFromUid !== uidRef.current;
              if (isMirror) {
                mirrorAmountRef.current[tx.id] = Number(tx.amount) || 0;
                mirrorMetaRef.current[tx.id] = {
                  category: tx.category || "",
                  notes: tx.notes || "",
                  amount: Number(tx.amount) || 0,
                };
                if (tx.settlement && typeof tx.settlement === "object") {
                  mirrorSettlementRef.current[tx.id] = { ...tx.settlement };
                }
              } else if (tx.settlements && typeof tx.settlements === "object") {
                /* Seed peer-settlement baseline for our own (master) bills so a
                 * fresh login doesn't replay historical settlements as toasts. */
                peerSettlementsRef.current[tx.id] = { ...tx.settlements };
              }
            }
          }
          seenTxIdsRef.current = new Set(rows.map((r) => r.id));
          setTxs(rows);
        });

        unsubSettings = onSnapshot(settingsRef, (snap) => {
          if (!active) return;
          if (!snap.exists()) {
            void (async () => {
              try {
                await setDoc(
                  settingsRef,
                  { budgets: {}, people: [], profileName: "", profileEmail: "", appProfileUuid: "" },
                  { merge: true }
                );
              } catch (err) {
                console.error("Failed to initialize settings document", err);
              }
            })();
            return;
          }
          const d = snap.data();
          if (d.budgets && typeof d.budgets === "object") setBudgets(d.budgets);
          if (Array.isArray(d.fixedExpenses)) setFixedExpenses(d.fixedExpenses);
          if (typeof d.monthlyBudgetTotal === "number" && Number.isFinite(d.monthlyBudgetTotal) && d.monthlyBudgetTotal > 0) {
            setMonthlyBudgetTotal(d.monthlyBudgetTotal);
          } else {
            setMonthlyBudgetTotal(null);
          }
          if (Array.isArray(d.people)) {
            setPeople(d.people.map((x) => normalizePerson(x)).filter((p) => p.n));
          }
          setProfileName(typeof d.profileName === "string" ? d.profileName : "");
          setProfileEmail(typeof d.profileEmail === "string" ? d.profileEmail : "");
          const uuidFromDoc =
            typeof d.appProfileUuid === "string" && d.appProfileUuid.trim() ? d.appProfileUuid.trim() : "";
          const match = loadProfiles().find((p) => p.email === firebaseUser?.email);
          const uuidFromDevice = match?.uuid && String(match.uuid).trim() ? String(match.uuid).trim() : "";
          setProfileTagUuid(uuidFromDoc || uuidFromDevice || firebaseUser?.uid || "");
          if (Array.isArray(d.userCategories) && d.userCategories.length > 0) setUserCategories(d.userCategories);
          else setUserCategories(null);
          if (Array.isArray(d.userPayments) && d.userPayments.length > 0) setUserPayments(d.userPayments);
          else setUserPayments(null);
          if (d.userCurrency && typeof d.userCurrency === "object" && d.userCurrency.code) setUserCurrency(d.userCurrency);
          else setUserCurrency(null);
          if (typeof d.reportFreq === "string" && ["daily", "weekly", "monthly"].includes(d.reportFreq)) setReportFreq(d.reportFreq);
          if (typeof d.theme === "string" && THEMES[d.theme]) { setUserTheme(d.theme); try { localStorage.setItem("track_theme", d.theme); } catch {} }
          if (d.aiInsights && typeof d.aiInsights === "object" && Array.isArray(d.aiInsights.items)) {
            setTips(d.aiInsights.items);
            setAiInsightsUpdatedAt(
              typeof d.aiInsights.updatedAt === "number" && Number.isFinite(d.aiInsights.updatedAt)
                ? d.aiInsights.updatedAt
                : 0
            );
          }
        });

        try {
          await initAnalytics();
        } catch (e) {
          console.warn(e);
        }
        if (active) setFbStatus("ready");
      } catch (e) {
        console.error(e);
        if (active) {
          const msg = e?.code ? `${e.code}: ${e.message || ""}` : e?.message || String(e);
          setFbErrorDetail(msg);
          setFbStatus("error");
          try {
            const raw = localStorage.getItem(offlineStorageKey(uid));
            if (raw) {
              const o = JSON.parse(raw);
              if (Array.isArray(o.txs)) setTxs(o.txs);
              if (o.budgets && typeof o.budgets === "object") setBudgets(o.budgets);
              if (typeof o.monthlyBudgetTotal === "number" && Number.isFinite(o.monthlyBudgetTotal) && o.monthlyBudgetTotal > 0) {
                setMonthlyBudgetTotal(o.monthlyBudgetTotal);
              } else {
                setMonthlyBudgetTotal(null);
              }
              if (Array.isArray(o.people)) {
                setPeople(o.people.map((x) => normalizePerson(x)).filter((p) => p.n));
              }
              if (Array.isArray(o.userCategories) && o.userCategories.length > 0) setUserCategories(o.userCategories);
              if (Array.isArray(o.userPayments) && o.userPayments.length > 0) setUserPayments(o.userPayments);
              if (o.userCurrency && typeof o.userCurrency === "object" && o.userCurrency.code) setUserCurrency(o.userCurrency);
              if (typeof o.reportFreq === "string") setReportFreq(o.reportFreq);
            } else {
              setTxs([]);
              setBudgets({});
              setMonthlyBudgetTotal(null);
              setPeople([]);
            }
          } catch {
            setTxs([]);
            setBudgets({});
            setMonthlyBudgetTotal(null);
            setPeople([]);
          }
          setCatalog({
            categories: [],
            payments: [],
            currencyCode: "",
            locale: "",
            dateLocale: "",
            footerLine1: "",
            footerLine2: "",
          });
          setProfileName("");
          setProfileEmail("");
        }
      }
    })();

    return () => {
      active = false;
      unsubTx?.();
      unsubSettings?.();
      unsubCatalog?.();
    };
  }, [fbBootKey, firebaseUser, authChecked]);

  useEffect(() => {
    if (fbStatus !== "error" || !firebaseUser?.uid) return;
    try {
      localStorage.setItem(
        offlineStorageKey(firebaseUser.uid),
        JSON.stringify({ txs, budgets, monthlyBudgetTotal, people, userCategories, userPayments })
      );
    } catch {
      /* ignore */
    }
  }, [fbStatus, firebaseUser?.uid, txs, budgets, monthlyBudgetTotal, people, userCategories, userPayments]);

  useEffect(() => {
    if (tab !== "profile") return;
    setDeviceProfiles(loadProfiles());
  }, [tab]);

  useEffect(() => {
    setDeviceProfiles(loadProfiles());
  }, [firebaseUser?.uid]);

  useEffect(() => {
    setTips([]);
    setAiInsightsUpdatedAt(0);
  }, [firebaseUser?.uid]);

  /** So friends can resolve this account when mirroring split expenses (QR-linked profile id). */
  useEffect(() => {
    const u = firebaseUser?.uid;
    const pid = (profileTagUuid && String(profileTagUuid).trim()) || "";
    if (!u || !pid) return;
    void publishPeerProfileIndex(db, u, pid);
  }, [firebaseUser?.uid, profileTagUuid]);

  async function persistPeople(nextList) {
    const norm = nextList.map(normalizePerson).filter((p) => p.n);
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { people: norm }, { merge: true });
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setPeople(norm);
  }

  async function handleSplitContactDecoded(rawText) {
    const parsed = parseSplitSharePayload(rawText);
    if (!parsed?.n) {
      dlg.toast("Invalid code. Ask your friend to open Profile and tap the QR icon.", { type: "error" });
      setShowSplitScan(false);
      return;
    }
    const selfEmail = (firebaseUser?.email || "").trim();
    const selfU = (profileTagUuid || "").trim();
    if (parsed.e && selfEmail && parsed.e === selfEmail && parsed.u && selfU && parsed.u === selfU) {
      dlg.toast("That's your own code.", { type: "warn" });
      setShowSplitScan(false);
      return;
    }
    const entry = normalizePerson({ n: parsed.n, e: parsed.e || undefined, u: parsed.u || undefined, fuid: parsed.fuid || undefined });
    const list = people.map(normalizePerson);
    const existingIdx = list.findIndex((x) => sameSplitPerson(x, entry));
    if (existingIdx !== -1) {
      const existing = list[existingIdx];
      // If the new QR has fuid but the stored contact doesn't, upgrade it silently
      if (entry.fuid && !existing.fuid) {
        const upgraded = list.map((x, i) => i === existingIdx ? { ...x, fuid: entry.fuid } : x);
        await persistPeople(upgraded);
        dlg.toast(`${entry.n}'s profile link updated.`, { type: "success" });
      } else {
        dlg.toast(`${entry.n} is already in your split contacts.`, { type: "warn" });
      }
      setShowSplitScan(false);
      return;
    }
    await persistPeople([...list, entry]);
    setShowSplitScan(false);
  }

  /**
   * Cross-user settlement writes are the one path where Firestore rules can
   * silently reject us (slave pushing to master). To make the propagation
   * look fully automatic to the user we persist every failed push in a tiny
   * queue (localStorage + in-memory) and keep retrying on:
   *   - every subsequent save / clear
   *   - app mount
   *   - `online` event
   *   - window focus
   *   - a 30s interval while the queue is non-empty
   * Once the payer's rules land, everything self-heals without any manual
   * action from either user.
   */
  function pendingQueueKey() {
    return uidRef.current ? `pendingPeerWrites:${uidRef.current}` : null;
  }
  function loadPendingQueue() {
    const k = pendingQueueKey();
    if (!k) return [];
    try {
      const raw = localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function savePendingQueue(q) {
    const k = pendingQueueKey();
    if (!k) return;
    try {
      if (q.length === 0) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(q));
    } catch {
      /* ignore */
    }
  }
  function enqueuePendingPeerWrite(item) {
    /* De-dupe so we don't pile up stale copies for the same target slot —
     * only the most recent intent matters. */
    const filtered = pendingPeerWritesRef.current.filter(
      (p) => !(p.txId === item.txId && p.masterUid === item.masterUid && p.op === item.op)
    );
    const next = [...filtered, { ...item, queuedAt: Date.now() }];
    pendingPeerWritesRef.current = next;
    savePendingQueue(next);
    schedulePendingRetry();
  }
  function schedulePendingRetry() {
    if (pendingRetryTimerRef.current) return;
    if (pendingPeerWritesRef.current.length === 0) return;
    pendingRetryTimerRef.current = setTimeout(() => {
      pendingRetryTimerRef.current = null;
      void flushPendingPeerWrites();
    }, 30_000);
  }
  async function flushPendingPeerWrites() {
    if (!uidRef.current) return;
    if (pendingPeerWritesRef.current.length === 0) {
      pendingPeerWritesRef.current = loadPendingQueue();
      if (pendingPeerWritesRef.current.length === 0) return;
    }
    const queue = [...pendingPeerWritesRef.current];
    const remaining = [];
    let landed = 0;
    for (const item of queue) {
      try {
        if (item.op === "set" && item.masterUid && item.entry) {
          await setDoc(
            doc(db, "users", item.masterUid, "transactions", item.txId),
            { settlements: { [uidRef.current]: sanitizeForFirestore(item.entry) } },
            { merge: true }
          );
          landed += 1;
        } else if (item.op === "clear" && item.masterUid) {
          await updateDoc(
            doc(db, "users", item.masterUid, "transactions", item.txId),
            { [`settlements.${uidRef.current}`]: deleteField() }
          );
          landed += 1;
        } else {
          /* Unknown op — drop so it doesn't clog the queue forever. */
        }
      } catch (err) {
        const msg = String(err?.message || "");
        const permDenied = err?.code === "permission-denied" || msg.includes("insufficient permissions");
        const tooOld = Date.now() - (item.queuedAt || 0) > 14 * 24 * 60 * 60 * 1000; // drop after 14 days
        if (!tooOld) {
          remaining.push(item);
        } else {
          console.warn("Dropping stale pending peer write:", item, err);
        }
        if (!permDenied) {
          /* Network / transient error — keep the rest of the queue for next
           * retry instead of hammering. */
          remaining.push(...queue.slice(queue.indexOf(item) + 1));
          break;
        }
      }
    }
    pendingPeerWritesRef.current = remaining;
    savePendingQueue(remaining);
    if (landed > 0) {
      notifyOp(
        landed === 1 ? "Settlement synced to payer" : `${landed} settlements synced to payer`,
        "They now see your payment reflected on their side.",
        { type: "success", tag: "settle-backfill", duration: 3500 }
      );
    }
    if (remaining.length > 0) {
      schedulePendingRetry();
    }
  }

  /* Retry the queue on mount, whenever the network returns, when the app
   * tab regains focus, and whenever a user signs in. */
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    pendingPeerWritesRef.current = loadPendingQueue();
    void flushPendingPeerWrites();
    const onOnline = () => void flushPendingPeerWrites();
    const onFocus = () => void flushPendingPeerWrites();
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      if (pendingRetryTimerRef.current) {
        clearTimeout(pendingRetryTimerRef.current);
        pendingRetryTimerRef.current = null;
      }
    };
  }, [firebaseUser?.uid]);

  /**
   * Slave records a settlement against their mirror copy AND pushes it to the master's
   * original transaction under `settlements[slaveUid]` so the master's spending drops by
   * the paid-back amount automatically. Both writes go through in parallel — if the
   * master-side write fails (e.g. rules not yet deployed), the slave's local ledger still
   * updates correctly AND the write is queued for automatic retry.
   */
  async function saveSettlement(txId, settlement) {
    if (!txId || !settlement) return;
    setTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, settlement } : t)));
    setSelectedTx((st) => (st && st.id === txId ? { ...st, settlement } : st));
    if (uidRef.current) {
      const tx = txs.find((t) => t.id === txId) || selectedTx;
      const masterUid =
        tx && typeof tx.syncedFromUid === "string" && tx.syncedFromUid.trim() && tx.syncedFromUid !== uidRef.current
          ? tx.syncedFromUid
          : null;
      try {
        await setDoc(
          doc(db, "users", uidRef.current, "transactions", txId),
          sanitizeForFirestore({ settlement }),
          { merge: true }
        );

        if (masterUid) {
          const entry = {
            ...settlement,
            byUid: uidRef.current,
            byName: profileName || "",
          };
          /* Try to flush any older queued writes first so they don't get
           * stuck behind this new one. */
          void flushPendingPeerWrites();
          try {
            await setDoc(
              doc(db, "users", masterUid, "transactions", txId),
              { settlements: { [uidRef.current]: sanitizeForFirestore(entry) } },
              { merge: true }
            );
          } catch (masterErr) {
            console.warn("saveSettlement: master push failed, queueing for auto-retry:", masterErr);
            enqueuePendingPeerWrite({ op: "set", txId, masterUid, entry });
            if (
              masterErr?.code === "permission-denied" ||
              String(masterErr?.message || "").includes("insufficient permissions")
            ) {
              dlg.toast(
                "Saved locally. We'll push it to the payer automatically as soon as their permissions allow.",
                { type: "warn", duration: 6000, title: "Syncing in background" }
              );
            }
          }
        }

        const amt = Number(settlement.amount) || 0;
        notifyOp(
          settlement.full ? "Fully settled" : "Partial settlement saved",
          `${formatMoney(amt)} · ${settlement.method || "payment"}`,
          { type: "success", tag: `settle-${txId}`, duration: 3500 }
        );
      } catch (e) {
        console.error("saveSettlement failed:", e);
        notifyOp("Couldn't save settlement", "Check your connection and try again.", { type: "error", duration: 5000 });
      }
    }
  }

  /**
   * Slave clears (removes) their own settlement. Wipes `settlement` off the
   * slave's mirror and the peer's slot from the master's `settlements` map so
   * both sides revert to "unsettled" and the bill returns to the master's
   * total. Firestore rules permit deleting ONLY the caller's own slot on the
   * master tx (via `isPeerSettlementUpdate` + dotted deleteField).
   */
  async function clearSettlement(txId) {
    if (!txId) return;
    const tx = txs.find((t) => t.id === txId) || selectedTx;
    if (!tx) return;
    const hadSettlement = Boolean(tx.settlement);
    setTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, settlement: null } : t)));
    setSelectedTx((st) => (st && st.id === txId ? { ...st, settlement: null } : st));
    if (!uidRef.current) return;
    const masterUid =
      typeof tx.syncedFromUid === "string" && tx.syncedFromUid.trim() && tx.syncedFromUid !== uidRef.current
        ? tx.syncedFromUid
        : null;
    try {
      try {
        await updateDoc(
          doc(db, "users", uidRef.current, "transactions", txId),
          { settlement: deleteField() }
        );
      } catch (innerErr) {
        console.warn("clearSettlement: slave mirror update failed, retrying as setDoc", innerErr);
        await setDoc(
          doc(db, "users", uidRef.current, "transactions", txId),
          sanitizeForFirestore({ settlement: null }),
          { merge: true }
        );
      }

      if (masterUid) {
        void flushPendingPeerWrites();
        try {
          await updateDoc(
            doc(db, "users", masterUid, "transactions", txId),
            { [`settlements.${uidRef.current}`]: deleteField() }
          );
        } catch (masterErr) {
          console.warn("clearSettlement: master settlement removal failed, queueing for auto-retry:", masterErr);
          enqueuePendingPeerWrite({ op: "clear", txId, masterUid });
          if (
            masterErr?.code === "permission-denied" ||
            String(masterErr?.message || "").includes("insufficient permissions")
          ) {
            dlg.toast(
              "Cleared on your side. We'll sync the removal to the payer automatically in the background.",
              { type: "warn", duration: 6000, title: "Syncing in background" }
            );
          }
        }
      }

      if (hadSettlement) {
        notifyOp("Settlement removed", "This bill is back on your balance.", {
          type: "info",
          tag: `settle-clear-${txId}`,
          duration: 3500,
        });
      }
    } catch (e) {
      console.error("clearSettlement failed:", e);
      notifyOp("Couldn't remove settlement", "Check your connection and try again.", { type: "error", duration: 5000 });
    }
  }

  /**
   * Master records that a peer has paid them back. Writes to the master's own
   * `settlements[peerUid]` AND mirrors the same entry to the slave's copy under
   * `settlement` so both sides stay in sync — useful when the slave can't push
   * directly (e.g. older Firestore rules not yet deployed, or master received
   * the cash in-person and wants to log it themselves).
   */
  async function recordPeerSettlement(txId, peerUid, peerName, settlement) {
    if (!txId || !peerUid || !settlement) return;
    if (!uidRef.current) return;
    const entry = sanitizeForFirestore({
      ...settlement,
      byUid: peerUid,
      byName: String(peerName || "").trim(),
      recordedByMaster: true,
    });
    try {
      await setDoc(
        doc(db, "users", uidRef.current, "transactions", txId),
        { settlements: { [peerUid]: entry } },
        { merge: true }
      );
      try {
        await setDoc(
          doc(db, "users", peerUid, "transactions", txId),
          { settlement: entry },
          { merge: true }
        );
      } catch (slaveErr) {
        console.warn("recordPeerSettlement: slave mirror push failed:", slaveErr);
      }
      const amt = Number(settlement.amount) || 0;
      notifyOp(
        settlement.full ? `Marked fully paid — ${peerName || "peer"}` : `Recorded payment from ${peerName || "peer"}`,
        `${formatMoney(amt)} · ${settlement.method || "payment"}`,
        { type: "success", tag: `settle-peer-${txId}-${peerUid}`, duration: 3500 }
      );
    } catch (e) {
      console.error("recordPeerSettlement failed:", e);
      notifyOp("Couldn't record payment", "Check your connection and try again.", { type: "error", duration: 5000 });
    }
  }

  /**
   * Master clears a peer's settlement slot. Removes `settlements[peerUid]`
   * from the master's own doc and the mirrored `settlement` on the slave's
   * doc. Peer will see a "Settlement reversed" notification via the snapshot
   * diff (same path the slave's own clear uses).
   */
  async function clearPeerSettlement(txId, peerUid, peerName) {
    if (!txId || !peerUid || !uidRef.current) return;
    try {
      await updateDoc(
        doc(db, "users", uidRef.current, "transactions", txId),
        { [`settlements.${peerUid}`]: deleteField() }
      );
      try {
        await updateDoc(
          doc(db, "users", peerUid, "transactions", txId),
          { settlement: deleteField() }
        );
      } catch (slaveErr) {
        console.warn("clearPeerSettlement: slave mirror update failed:", slaveErr);
      }
      notifyOp(
        `Cleared payment${peerName ? ` — ${peerName}` : ""}`,
        "The bill is back on your balance for that peer.",
        { type: "info", tag: `settle-peer-clear-${txId}-${peerUid}`, duration: 3500 }
      );
    } catch (e) {
      console.error("clearPeerSettlement failed:", e);
      notifyOp("Couldn't clear payment", "Check your connection and try again.", { type: "error", duration: 5000 });
    }
  }

  async function editTransaction(txId, updates) {
    if (!txId || !updates || typeof updates !== "object") return;
    const prevTx = txs.find((t) => t.id === txId);

    /* If the amount changed and a split is attached, keep the split in sync:
     *   - equal splits: divide evenly across everyone (owner + people)
     *   - custom splits: scale each person's share by the amount ratio
     * Without this, edits to the total leave stale per-person amounts that no
     * longer add up correctly — and mirrors push those stale numbers to slaves. */
    let finalUpdates = { ...updates };
    if (prevTx?.split?.people?.length && typeof updates.amount === "number" && Number.isFinite(updates.amount)) {
      const prevAmt = Number(prevTx.amount) || 0;
      const newAmt = updates.amount;
      if (newAmt !== prevAmt) {
        const type = prevTx.split.type === "custom" ? "custom" : "equal";
        const ppl = prevTx.split.people;
        let rebuilt;
        if (type === "equal" && newAmt > 0) {
          const each = Math.round((newAmt / (ppl.length + 1)) * 100) / 100;
          rebuilt = ppl.map((p) => ({ ...p, a: each }));
        } else if (type === "custom" && prevAmt > 0) {
          const ratio = newAmt / prevAmt;
          rebuilt = ppl.map((p) => {
            const raw = typeof p.a === "number" ? p.a : parseFloat(String(p.a)) || 0;
            return { ...p, a: Math.round(raw * ratio * 100) / 100 };
          });
        } else {
          rebuilt = ppl.map((p) => ({ ...p, a: 0 }));
        }
        finalUpdates = { ...finalUpdates, split: { ...prevTx.split, type, people: rebuilt } };
      }
    }

    setTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, ...finalUpdates } : t)));
    setSelectedTx((st) => (st && st.id === txId ? { ...st, ...finalUpdates } : st));
    if (uidRef.current) {
      try {
        const ref = doc(db, "users", uidRef.current, "transactions", txId);
        await setDoc(ref, sanitizeForFirestore(finalUpdates), { merge: true });
        // Master: push edits to all mirror copies so slaves see changes in real-time
        const isMaster = !prevTx?.syncedFromUid || prevTx.syncedFromUid === uidRef.current;
        const merged = prevTx ? { ...prevTx, ...finalUpdates } : null;
        if (isMaster && merged?.split?.people?.length) {
          const enrichedSplit = enrichSplitPeopleFromContacts(merged.split, people);
          upsertSplitMirrors(db, uidRef.current, { ...merged, split: enrichedSplit }).catch((e) =>
            console.error("editTransaction: mirror push failed:", e)
          );
        }
        const desc = merged
          ? `${formatMoney(Number(merged.amount) || 0)} · ${merged.category || "Expense"}`
          : "Changes saved";
        notifyOp("Transaction updated", desc, {
          type: "success",
          tag: `tx-edit-${txId}`,
        });
      } catch (e) {
        console.error("Failed to save edit:", e);
        notifyOp("Couldn't save edit", "Check your connection and try again.", { type: "error", duration: 5000 });
      }
    }
  }

  async function updateTransactionSplit(txId, splitPayload) {
    const cleaned =
      splitPayload && splitPayload.people?.length
        ? {
            type: splitPayload.type === "custom" ? "custom" : "equal",
            people: splitPayload.people.map((p) => {
              const out = {
                n: String(p.n || "").trim(),
                a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0,
              };
              if (p.fuid) out.fuid = String(p.fuid).trim();
              if (p.u) out.u = String(p.u).trim();
              if (p.e) out.e = String(p.e).trim();
              return out;
            }),
          }
        : null;

    const enriched = cleaned ? enrichSplitPeopleFromContacts(cleaned, people) : null;
    const prevTx = txs.find((t) => t.id === txId);
    const isMirrorCopy =
      prevTx &&
      typeof prevTx.syncedFromUid === "string" &&
      prevTx.syncedFromUid.trim() &&
      prevTx.syncedFromUid !== uidRef.current;

    if (!uidRef.current) {
      setTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, split: enriched } : t)));
      setSelectedTx((st) => (st && st.id === txId ? { ...st, split: enriched } : st));
      return;
    }
    try {
      if (!isMirrorCopy && prevTx?.split?.people?.length) {
        await deleteMirrorsForOwnerTransaction(db, uidRef.current, prevTx);
      }
      const ref = doc(db, "users", uidRef.current, "transactions", txId);
      if (enriched == null) {
        await updateDoc(ref, { split: deleteField() });
      } else {
        await setDoc(ref, sanitizeForFirestore({ split: enriched }), { merge: true });
      }
      const merged = prevTx ? { ...prevTx, split: enriched } : null;
      setTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, split: enriched } : t)));
      setSelectedTx((st) => (st && st.id === txId ? { ...st, split: enriched } : st));
      if (!isMirrorCopy && merged?.split?.people?.length) {
        try {
          const result = await upsertSplitMirrors(db, uidRef.current, merged);
          if (result && (result.unresolved?.length || result.failed > 0)) {
            const missing = (result.unresolved || []).filter(Boolean);
            if (result.permissionDenied) {
              dlg.toast("Firestore rules not deployed — split saved locally only. Tap to fix.", {
                type: "error", duration: 10000, title: "Rules needed",
                actionLabel: "Open Console",
                onClick: () => window.open("https://console.firebase.google.com/project/sandeep-1fc6b/firestore/rules", "_blank"),
              });
            } else if (missing.length) {
              dlg.toast(
                `${missing.join(", ")} ${missing.length === 1 ? "doesn't have" : "don't have"} a linked profile — they won't see this split until they add you back.`,
                { type: "warn", duration: 7000, title: "Split saved locally" }
              );
            } else if (result.failed > 0) {
              dlg.toast(`Couldn't sync split to ${result.failed} friend${result.failed === 1 ? "" : "s"}. Check your connection.`, { type: "error", duration: 6000 });
            }
          } else if (result && result.succeeded > 0) {
            dlg.toast(`Split sent to ${result.succeeded} friend${result.succeeded === 1 ? "" : "s"}`, { type: "success", duration: 3000 });
          }
        } catch (mirrorErr) {
          console.error("Mirror sync failed (split still saved locally):", mirrorErr);
          dlg.toast("Couldn't sync split to friends. Split saved locally.", { type: "error", duration: 5000 });
        }
      }
    } catch (e) {
      console.error(e);
      dlg.toast("Could not save split. Check your connection.", { type: "error" });
    }
  }

  async function switchToDeviceProfile(p) {
    if (!p?.email) return;
    try {
      await signOut(auth);
      await new Promise((r) => setTimeout(r, 80));
      if (p.pin && isValidPin(p.pin)) {
        await signInWithEmailAndPassword(auth, p.email, pinToPassword(p.pin));
      } else {
        try {
          sessionStorage.setItem(PENDING_LOGIN_EMAIL_KEY, p.email);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (!payments.length) return;
    if (scanMissingFieldKeys.includes("payment")) return;
    setForm((f) => ({
      ...f,
      payment: payments.includes(f.payment) ? f.payment : payments[0],
    }));
  }, [payments, scanMissingFieldKeys]);

  /** After save, success UI is at top — scroll so it is not missed below the fold. */
  useEffect(() => {
    if (step !== "success") return;
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /** Default category on expense form so submit is not blocked with no visible selection. */
  useEffect(() => {
    if (tab !== "add" || step !== "form") return;
    if (form.category) return;
    if (scanMissingFieldKeys.includes("category")) return;
    const first = categories[0]?.n;
    if (first) setForm((p) => ({ ...p, category: first }));
  }, [tab, step, categories, form.category, scanMissingFieldKeys]);

  const selfFbUid = firebaseUser?.uid || "";
  const filtered = useMemo(() => filterTx(txs, df, cS, cE), [txs, df, cS, cE]);
  const fTotal = useMemo(() => tot(filtered, profileTagUuid, selfFbUid), [filtered, profileTagUuid, selfFbUid]);
  const monthTxs = useMemo(() => filterTx(txs, "month"), [txs]);
  const monthTotal = useMemo(() => tot(monthTxs, profileTagUuid, selfFbUid), [monthTxs, profileTagUuid, selfFbUid]);
  const todayTxs = useMemo(() => txs.filter((t) => t.date === tdStr()), [txs]);
  const todayTotal = useMemo(() => tot(todayTxs, profileTagUuid, selfFbUid), [todayTxs, profileTagUuid, selfFbUid]);
  const weekTxs = useMemo(() => filterTx(txs, "week"), [txs]);
  const weekTotal = useMemo(() => tot(weekTxs, profileTagUuid, selfFbUid), [weekTxs, profileTagUuid, selfFbUid]);

  /** Human label for the calendar month used by "This Month" (same rule as `filterTx(..., "month")`). */
  const calendarMonthLabel = useMemo(() => {
    const loc = (locale && String(locale).trim()) || undefined;
    return new Date().toLocaleDateString(loc, { month: "long", year: "numeric" });
  }, [locale]);

  /** Expenses whose `date` is not in the current calendar month (common after CSV import from bank screenshots). */
  const expenseCountOutsideThisCalendarMonth = useMemo(() => {
    const now = new Date();
    let n = 0;
    for (const t of txs) {
      if (!t?.date || typeof t.date !== "string") continue;
      const d = new Date(`${t.date}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) n += 1;
    }
    return n;
  }, [txs]);

  /** Overall monthly cap ring: remaining arc shrinks as `monthTotal` grows. */
  const monthBudgetRing = useMemo(() => {
    const cap = typeof monthlyBudgetTotal === "number" && monthlyBudgetTotal > 0 ? monthlyBudgetTotal : null;
    if (cap == null) return null;
    const spent = monthTotal;
    const remainingFrac = Math.max(0, (cap - spent) / cap);
    const over = spent > cap;
    return { cap, spent, remainingFrac, over };
  }, [monthlyBudgetTotal, monthTotal]);

  const breakdown = useMemo(() => {
    const m = {};
    filtered.forEach((tx) => {
      m[tx.category] = (m[tx.category] || 0) + effectiveAmount(tx, profileTagUuid, selfFbUid);
    });
    return Object.entries(m)
      .map(([n, v]) => ({ name: n, value: v, ...getCat(categories, n) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categories, profileTagUuid, selfFbUid]);

  const PAY_COLORS = ["#60A5FA", "#22C55E", "#F59E0B", "#A78BFA", "#F472B6", "#22D3EE", "#FB923C", "#94A3B8"];
  const paymentBreakdown = useMemo(() => {
    const m = {};
    filtered.forEach((tx) => {
      const p = tx.payment || "Unknown";
      m[p] = (m[p] || 0) + effectiveAmount(tx, profileTagUuid, selfFbUid);
    });
    return Object.entries(m)
      .map(([name, value], i) => ({ name, value, c: PAY_COLORS[i % PAY_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, profileTagUuid, selfFbUid]);

  const dailyData = useMemo(() => {
    const loc = (dateLocale && String(dateLocale).trim()) || (locale && String(locale).trim()) || undefined;
    return Array.from({ length: 14 }, (_, i) => {
      const d = dAgo(13 - i);
      return {
        label: new Date(d + "T00:00:00").toLocaleDateString(loc, { day: "numeric", month: "short" }),
        amount: tot(txs.filter((t) => t.date === d), profileTagUuid, selfFbUid),
      };
    });
  }, [txs, dateLocale, locale, profileTagUuid, selfFbUid]);

  const catSpent = useMemo(() => {
    const m = {};
    monthTxs.forEach((t) => {
      m[t.category] = (m[t.category] || 0) + effectiveAmount(t, profileTagUuid, selfFbUid);
    });
    return m;
  }, [monthTxs, profileTagUuid, selfFbUid]);

  /**
   * Aggregate split-bill activity for the current filter range.
   *
   * Per-peer balances net the owner / mirror relationship:
   *   - `theyOweYou`  — their unsettled share of bills YOU paid up front
   *   - `youOweThem`  — your unsettled share of bills THEY paid up front
   *   - `settledByThem` / `settledByYou` — what has already been paid back
   *
   * We key peers by their Firebase uid where available, falling back to name so
   * manually-added contacts (no fuid) still roll up cleanly. Settlement records
   * live on master's tx (`settlements[fuid]`) and slave's mirror (`settlement`) —
   * we combine both views so the totals are consistent from either side.
   */
  const FRIEND_COLORS = useMemo(
    () => ["#60A5FA", "#22C55E", "#F59E0B", "#A78BFA", "#F472B6", "#22D3EE", "#FB923C", "#EF4444", "#10B981", "#94A3B8"],
    []
  );
  const splitAnalytics = useMemo(() => {
    const peerMap = new Map();
    const catMap = new Map();
    const friendMap = new Map();
    let outstandingToYou = 0;
    let outstandingFromYou = 0;
    let settledToYou = 0;
    let settledFromYou = 0;
    let splitCount = 0;
    let splitTotalValue = 0;

    const splitTxs = filtered.filter((tx) => tx?.split?.people?.length);

    for (const tx of splitTxs) {
      splitCount += 1;
      splitTotalValue += parseFloat(String(tx.amount)) || 0;
      const txMirror =
        typeof tx.syncedFromUid === "string" && tx.syncedFromUid.trim() && tx.syncedFromUid !== selfFbUid;

      if (txMirror) {
        const selfEntry = tx.split.people.find(
          (p) => (p?.fuid && p.fuid === selfFbUid) || (p?.u && p.u === profileTagUuid)
        );
        const share = selfEntry ? (parseFloat(String(selfEntry.a)) || 0) : 0;
        const settledByMe = parseFloat(String(tx.settlement?.amount)) || 0;
        const owed = Math.max(0, share - settledByMe);
        const masterUid = tx.syncedFromUid;
        const masterKey = `uid:${masterUid}`;
        const masterName = (people || []).find((c) => c.fuid === masterUid)?.n || "Payer";

        if (!peerMap.has(masterKey)) {
          peerMap.set(masterKey, {
            key: masterKey, name: masterName,
            theyOweYou: 0, youOweThem: 0, settledByThem: 0, settledByYou: 0, splitCount: 0,
          });
        }
        const entry = peerMap.get(masterKey);
        entry.youOweThem += owed;
        entry.settledByYou += settledByMe;
        entry.splitCount += 1;

        outstandingFromYou += owed;
        settledFromYou += settledByMe;
        catMap.set(tx.category || "Other", (catMap.get(tx.category || "Other") || 0) + share);
        friendMap.set(masterName, (friendMap.get(masterName) || 0) + share);
      } else {
        for (const p of tx.split.people) {
          const peerKey = p?.fuid ? `uid:${p.fuid}` : `name:${String(p?.n || "").trim().toLowerCase()}`;
          const peerShare = parseFloat(String(p?.a)) || 0;
          const settlement = tx.settlements && p?.fuid ? tx.settlements[p.fuid] : null;
          const settledByPeer = parseFloat(String(settlement?.amount)) || 0;
          const owed = Math.max(0, peerShare - settledByPeer);

          if (!peerMap.has(peerKey)) {
            peerMap.set(peerKey, {
              key: peerKey, name: p?.n || "Peer",
              theyOweYou: 0, youOweThem: 0, settledByThem: 0, settledByYou: 0, splitCount: 0,
            });
          }
          const entry = peerMap.get(peerKey);
          entry.theyOweYou += owed;
          entry.settledByThem += settledByPeer;
          entry.splitCount += 1;

          outstandingToYou += owed;
          settledToYou += settledByPeer;
          catMap.set(tx.category || "Other", (catMap.get(tx.category || "Other") || 0) + peerShare);
          friendMap.set(p?.n || "Peer", (friendMap.get(p?.n || "Peer") || 0) + peerShare);
        }
      }
    }

    const byCategory = [...catMap.entries()]
      .map(([name, value]) => {
        const cat = getCat(categories, name);
        return { name, value, c: cat.c };
      })
      .sort((a, b) => b.value - a.value);

    const byFriend = [...friendMap.entries()]
      .map(([name, value], i) => ({ name, value, c: FRIEND_COLORS[i % FRIEND_COLORS.length] }))
      .sort((a, b) => b.value - a.value);

    const peers = [...peerMap.values()]
      .map((p) => ({ ...p, net: p.theyOweYou - p.youOweThem }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    return {
      splitCount,
      splitTotalValue,
      outstandingToYou,
      outstandingFromYou,
      settledToYou,
      settledFromYou,
      netPosition: outstandingToYou - outstandingFromYou,
      byCategory,
      byFriend,
      peers,
    };
  }, [filtered, selfFbUid, profileTagUuid, people, categories, FRIEND_COLORS]);

  /** Budgets tab: over-limit first, then by % used (desc), then name. */
  const budgetEntriesSorted = useMemo(() => {
    return Object.entries(budgets)
      .filter(([ca]) => ca !== MONTH_TOTAL_BUDGET_KEY)
      .sort(([ca, la], [cb, lb]) => {
      const sa = catSpent[ca] || 0;
      const sb = catSpent[cb] || 0;
      const oa = sa > la;
      const ob = sb > lb;
      if (oa !== ob) return oa ? -1 : 1;
      const ra = la > 0 ? sa / la : 0;
      const rb = lb > 0 ? sb / lb : 0;
      if (rb !== ra) return rb - ra;
      return ca.localeCompare(cb);
    });
  }, [budgets, catSpent]);

  /** Home “AI tip” strip hidden until the next generation (localStorage keyed by generation time). */
  const showHomeAiTipBanner = useMemo(() => {
    if (!tips.length || !firebaseUser?.uid || !aiInsightsUpdatedAt) return false;
    try {
      if (localStorage.getItem(`track_ai_insights_home_${firebaseUser.uid}`) === String(aiInsightsUpdatedAt)) return false;
    } catch {
      /* ignore */
    }
    return true;
  }, [tips, firebaseUser?.uid, aiInsightsUpdatedAt, insightHomeDismissRev]);

  function dismissHomeAiTipBanner() {
    if (!firebaseUser?.uid || !aiInsightsUpdatedAt) return;
    try {
      localStorage.setItem(`track_ai_insights_home_${firebaseUser.uid}`, String(aiInsightsUpdatedAt));
    } catch {
      /* ignore */
    }
    setInsightHomeDismissRev((n) => n + 1);
  }

  const loggedToday = todayTxs.length > 0;

  async function delTx(id) {
    if (uidRef.current) {
      try {
        let tx = txs.find((t) => t.id === id);
        if (!tx) {
          const snap = await getDoc(doc(db, "users", uidRef.current, "transactions", id));
          if (snap.exists()) tx = { id, ...snap.data() };
        }
        const fromPeer =
          tx && typeof tx.syncedFromUid === "string" && tx.syncedFromUid.trim() && tx.syncedFromUid !== uidRef.current;
        if (tx && !fromPeer && tx.split?.people?.length) {
          await deleteMirrorsForOwnerTransaction(db, uidRef.current, tx);
        }
        await deleteDoc(doc(db, "users", uidRef.current, "transactions", id));
        const label = tx
          ? `${formatMoney(Number(tx.amount) || 0)} · ${tx.category || "Expense"}`
          : "Removed from your ledger";
        notifyOp("Transaction deleted", label, {
          type: "info",
          tag: `tx-del-${id}`,
          duration: 3500,
        });
      } catch (e) {
        console.error(e);
        notifyOp("Couldn't delete", "Check your connection and try again.", { type: "error", duration: 5000 });
      }
      return;
    }
    setTxs((p) => p.filter((t) => t.id !== id));
    notifyOp("Transaction deleted", "Removed from your ledger", { type: "info", duration: 2500 });
  }

  async function confirmDeleteAllExpenses() {
    setDeleteAllErr("");
    const email = firebaseUser?.email;
    if (!email) {
      setDeleteAllErr("Not signed in.");
      return;
    }
    if (!isValidPin(deleteAllPin)) {
      setDeleteAllErr("Enter your 4-digit PIN.");
      return;
    }
    setDeleteAllBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, pinToPassword(deleteAllPin));
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No user after sign-in.");

      const colRef = collection(db, "users", uid, "transactions");
      const snap = await getDocs(colRef);
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + 450)) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }

      if (!uidRef.current) {
        setTxs([]);
      }

      setDeleteAllModal(false);
      setDeleteAllPin("");
      setDeleteAllErr("");
      dlg.toast("All expenses deleted for this account.", { type: "success" });
      
    } catch (e) {
      const code = e?.code || "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        setDeleteAllErr("Wrong PIN.");
      } else {
        setDeleteAllErr(e?.message || String(e));
      }
    } finally {
      setDeleteAllBusy(false);
    }
  }

  async function confirmDeleteAccount() {
    setDeleteAcctErr("");
    const email = firebaseUser?.email;
    if (!email) { setDeleteAcctErr("Not signed in."); return; }
    if (!isValidPin(deleteAcctPin)) { setDeleteAcctErr("Enter your 4-digit PIN."); return; }
    setDeleteAcctBusy(true);
    try {
      const cred = EmailAuthProvider.credential(email, pinToPassword(deleteAcctPin));
      await reauthenticateWithCredential(auth.currentUser, cred);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No user after re-auth.");

      const txSnap = await getDocs(collection(db, "users", uid, "transactions"));
      for (let i = 0; i < txSnap.docs.length; i += 450) {
        const batch = writeBatch(db);
        for (const d of txSnap.docs.slice(i, i + 450)) batch.delete(d.ref);
        await batch.commit();
      }
      try { await deleteDoc(doc(db, "users", uid, "settings", "config")); } catch {}
      try { await deleteDoc(doc(db, "users", uid)); } catch {}

      await fbDeleteUser(auth.currentUser);
      setDeleteAcctModal(false);
      setDeleteAcctPin("");
      setTxs([]);
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
        setDeleteAcctErr("Wrong PIN.");
      } else if (code === "auth/requires-recent-login") {
        setDeleteAcctErr("Session expired. Sign out and back in, then try again.");
      } else {
        setDeleteAcctErr(e?.message || String(e));
      }
    } finally {
      setDeleteAcctBusy(false);
    }
  }

  function scrollExpenseFormTop() {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearScanHints() {
    setScanMissingFieldKeys([]);
    setScanFillPrompt("");
  }

  /** Success screen, then Home + toast so saving is obvious even if the check view was scrolled away. */
  function schedulePostSaveReset(newTx) {
    setBulkSuccess(null);
    setFErr("");
    setScanErr("");
    clearScanHints();
    setSavingExpense(false);
    setScanPhase(null);
    setStep("success");
    setTimeout(() => {
      setStep("mode");
      const pay = catalogRef.current.payments[0] || "";
      setForm({ amount: "", category: "", date: tdStr(), payment: pay, notes: "", tags: "" });
      setSplitOn(false);
      setSplitPpl([]);
      setPreviewImg(null);
      setScanLineItems(null);
      setTab("home");
      notifyOp("Expense saved", `${formatMoney(newTx.amount)} · ${newTx.category}`, {
        type: "success",
        tag: `tx-saved-${newTx.id}`,
        onClick: () => { setSelectedTx(newTx); setTab("home"); },
      });
    }, 2000);
  }

  async function submitForm() {
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) {
      setFErr("Enter a valid amount");
      scrollExpenseFormTop();
      return;
    }
    if (!form.category) {
      setFErr("⚠️  Category is required — this field cannot be skipped");
      scrollExpenseFormTop();
      return;
    }
    if (!form.payment) {
      setFErr("Select a payment method");
      scrollExpenseFormTop();
      return;
    }
    if (!categories.length) {
      setFErr("No categories available. Check your connection or Firestore config/app.");
      scrollExpenseFormTop();
      return;
    }
    if (!payments.length) {
      setFErr("No payment methods available.");
      scrollExpenseFormTop();
      return;
    }
    setFErr("");
    setScanErr("");
    clearScanHints();
    let splitNormalized =
      splitOn && splitPpl.length > 0
        ? {
            type: splitType,
            people: splitPpl.map((p) => ({
              n: p.n,
              a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0,
            })),
          }
        : null;
    if (splitNormalized) {
      splitNormalized = enrichSplitPeopleFromContacts(splitNormalized, people);
    }
    const tagUuid = (profileTagUuid && String(profileTagUuid).trim()) || uidRef.current || "";
    const newTx = {
      id: uid(),
      amount: parseFloat(form.amount),
      category: form.category,
      date: form.date,
      payment: form.payment,
      notes: form.notes,
      tags: form.tags ? form.tags.split(",").map((s) => s.trim()) : [],
      split: splitNormalized,
      appProfileUuid: tagUuid,
      lineItems: Array.isArray(scanLineItems) && scanLineItems.length ? scanLineItems : [],
    };
    if (!uidRef.current) {
      if (fbStatus !== "error") {
        setFErr("Cloud sync not ready yet — wait a moment and try again.");
        scrollExpenseFormTop();
        return;
      }
      setTxs((p) => [newTx, ...p]);
      schedulePostSaveReset(newTx);
      return;
    }
    setSavingExpense(true);
    try {
      let receiptUrl = "";
      if (previewImg) {
        try {
          // Race against a 12-second timeout so a hung Storage upload never blocks saving
          receiptUrl = await Promise.race([
            uploadReceiptImage(previewImg, uidRef.current, newTx.id),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timed out")), 12000)),
          ]);
        } catch (e) {
          console.error(e);
          // Non-fatal — continue saving the expense without the photo
        }
      }
      if (receiptUrl) newTx.receiptUrl = receiptUrl;
      await setDoc(doc(db, "users", uidRef.current, "transactions", newTx.id), sanitizeForFirestore(newTx));
      if (newTx?.split?.people?.length) {
        try {
          const result = await upsertSplitMirrors(db, uidRef.current, newTx);
          if (result && (result.unresolved?.length || result.failed > 0)) {
            const missing = (result.unresolved || []).filter(Boolean);
            if (result.permissionDenied) {
              dlg.toast("Firestore rules not deployed — split saved locally only. Tap to fix.", {
                type: "error", duration: 10000, title: "Rules needed",
                actionLabel: "Open Console",
                onClick: () => window.open("https://console.firebase.google.com/project/sandeep-1fc6b/firestore/rules", "_blank"),
              });
            } else if (missing.length) {
              dlg.toast(
                `${missing.join(", ")} ${missing.length === 1 ? "doesn't have" : "don't have"} a linked profile — they won't see this split until they link back via QR.`,
                { type: "warn", duration: 7000, title: "Split saved locally" }
              );
            } else if (result.failed > 0) {
              dlg.toast(`Couldn't sync split to ${result.failed} friend${result.failed === 1 ? "" : "s"}. Check your connection.`, { type: "error", duration: 5000 });
            }
          } else if (result && result.succeeded > 0) {
            dlg.toast(`Split sent to ${result.succeeded} friend${result.succeeded === 1 ? "" : "s"}`, { type: "success", duration: 3000 });
          }
        } catch (mirrorErr) {
          console.error("upsertSplitMirrors (addExpense):", mirrorErr);
        }
      }
    } catch (e) {
      console.error(e);
      setFErr("Could not save expense. Check your connection.");
      scrollExpenseFormTop();
      setSavingExpense(false);
      return;
    }
    setSavingExpense(false);
    schedulePostSaveReset(newTx);
  }

  function notifyScanReadyIfBackground() {
    try {
      if (typeof document === "undefined" || !document.hidden) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      new Notification("Receipt ready", {
        body: "Open the app to review, edit, and save your expense.",
        tag: "track-receipt-scan",
      });
    } catch {
      /* ignore */
    }
  }

  /**
   * Unified notifier for every user-triggered operation.
   *
   * Always shows an in-app toast (even when the tab is focused) and additionally
   * raises a native browser notification + haptic vibration so the user is made
   * aware even when the app is backgrounded. Silently degrades when the
   * Notification / Vibration APIs are unavailable or denied — we never block a
   * save on a missing permission.
   */
  function notifyOp(title, body, opts = {}) {
    const { type = "success", duration = 3000, tag, onClick } = opts;
    try {
      dlg.toast(body || title, {
        type,
        title,
        duration,
        actionLabel: onClick ? "View" : undefined,
        onClick,
      });
    } catch {
      /* ignore */
    }
    try {
      if ("Notification" in window) {
        if (Notification.permission === "default") {
          void Notification.requestPermission();
        } else if (Notification.permission === "granted") {
          const n = new Notification(title, {
            body: body || "",
            tag: tag || title,
            icon: "/favicon.ico",
          });
          if (onClick) n.onclick = () => { try { window.focus(); } catch { /* ignore */ } onClick(); };
        }
      }
    } catch {
      /* ignore */
    }
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(40);
    } catch {
      /* ignore */
    }
  }

  function cancelActiveScan() {
    scanCancelledRef.current = true;
    try {
      scanFetchAbortRef.current?.abort();
    } catch {
      /* ignore */
    }
    scanFetchAbortRef.current = null;
    setScanPhase(null);
    setStep("mode");
    setPreviewImg(null);
    setScanLineItems(null);
    setScanErr("");
    clearScanHints();
    try {
      if (scanCameraRef.current) scanCameraRef.current.value = "";
      if (scanGalleryRef.current) scanGalleryRef.current.value = "";
      if (stmtRef.current) stmtRef.current.value = "";
    } catch {
      /* ignore */
    }
  }

  /** If async scan stops early (cancel/abort), avoid leaving the UI stuck on "processing". */
  function recoverFromStuckScan() {
    setScanPhase(null);
    setStep((s) => (s === "processing" ? "mode" : s));
  }

  async function processFile(e, isStatement = false) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;

    const openAiKey = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();
    if (!openAiKey) {
      setScanErr("OpenAI key not configured. Add VITE_OPENAI_API_KEY to GitHub secrets and redeploy.");
      return;
    }

    const lowerName = f.name?.toLowerCase() || "";
    const mt = f.type && f.type.length > 0 ? f.type : lowerName.endsWith(".pdf") ? "application/pdf" : "image/jpeg";
    const isImageFile = mt.startsWith("image/") || (!mt.includes("pdf") && !mt.includes("spreadsheet") && !mt.includes("excel") && !lowerName.match(/\.(xlsx?|ods|csv)$/));

    scanCancelledRef.current = false;
    scanFetchAbortRef.current?.abort();
    scanFetchAbortRef.current = new AbortController();
    const fetchSignal = scanFetchAbortRef.current.signal;
    if ("Notification" in window && Notification.permission === "default") {
      try { void Notification.requestPermission(); } catch { /* ignore */ }
    }

    setScanErr("");
    clearScanHints();
    setScanPhase("read");
    setStep("processing");
    // Let the browser paint the loading state before heavy FileReader / OCR work (avoids a "frozen blank" stretch on mobile).
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
    });

    try {
      const cats = catalogRef.current.categories || [];
      const catNames = cats.map((c) => c.n).filter(Boolean);
      const payNames = (catalogRef.current.payments || []).filter(Boolean);
      const catList = catNames.length ? catNames.join(", ") : "Food, Travel, Shopping, Bills";
      const payList = payNames.length ? payNames.join(", ") : "Cash, Card, UPI";

      // ── Statements (PDF / Excel): extract text → OpenAI → CSV import ──────
      if (isStatement) {
        scanPhaseOrderRef.current = ["read", "ocr", "ai", "parse"];
        setScanPhase("ocr");
        let text;
        try {
          text = await extractTextFromFile(f);
        } catch (extractErr) {
          if (scanCancelledRef.current) {
            recoverFromStuckScan();
            return;
          }
          setScanErr(extractErr instanceof Error ? extractErr.message : "Could not read this file. Try exporting as CSV from your bank app.");
          setScanPhase(null);
          setStep("mode");
          return;
        }
        if (scanCancelledRef.current) {
          recoverFromStuckScan();
          return;
        }

        setScanPhase("ai");
        let csv;
        try {
          csv = await convertOcrToCsv(text, { categories: catNames, payments: payNames });
        } catch (aiErr) {
          if (scanCancelledRef.current) {
            recoverFromStuckScan();
            return;
          }
          setScanErr(aiErr instanceof Error ? aiErr.message : "AI conversion failed. Try again.");
          setScanPhase(null);
          setStep("mode");
          return;
        }
        if (scanCancelledRef.current) {
          recoverFromStuckScan();
          return;
        }

        setScanPhase("parse");
        const { rows, fatal } = parseExpenseCsv(csv, { categories: catNames, payments: payNames });
        if (fatal || rows.filter((r) => r.ok).length === 0) {
          setScanErr("Could not find valid transactions in this file. Try 'OCR → CSV' for manual review.");
          setScanPhase(null);
          setStep("mode");
          return;
        }
        setImportBundle({ fileName: f.name, rows });
        setAddMode("import");
        setScanPhase(null);
        setStep("importPreview");
        return;
      }

      // ── Receipt scan: image → OpenAI Vision; PDF → text → OpenAI ──────────
      let userContent;

      if (isImageFile) {
        // Read as data URL for vision API
        const raw = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(/** @type {string} */ (reader.result));
          reader.onerror = () => reject(new Error("Could not read file from device."));
          reader.readAsDataURL(f);
        });
        setPreviewImg(raw);

        // Tesseract OCR in parallel — helps with low-res images
        let ocrText = "";
        if (canRunBrowserOcr(mt, false)) {
          scanPhaseOrderRef.current = ["read", "ocr", "ai", "parse"];
          setScanPhase("ocr");
          try { ocrText = await extractReceiptTextWithOcr(raw); } catch { /* ignore */ }
        } else {
          scanPhaseOrderRef.current = ["read", "ai", "parse"];
        }
        if (scanCancelledRef.current) {
          recoverFromStuckScan();
          return;
        }

        userContent = [
          { type: "image_url", image_url: { url: raw, detail: "auto" } },
          {
            type: "text",
            text: `${ocrText ? `OCR text (use as hint only): ${ocrText}\n\n` : ""}STEP 1 — Classify the image:\n- "single_receipt": one paper/store receipt or one clear bill with ONE total to log.\n- "transaction_list": banking app screenshot, account history, or any screen showing MULTIPLE dated rows (each with merchant + amount), even if cropped.\n\nSTEP 2 — Return ONLY valid JSON:\n\nA) If "image_kind":"single_receipt", use this shape:\n{"image_kind":"single_receipt","total":number|null,"category":string|null,"date":"YYYY-MM-DD"|null,"notes":string|null,"payment":string|null,"line_items":null|[],"missing_fields":[]}\n\nB) If "image_kind":"transaction_list", use:\n{"image_kind":"transaction_list","transactions":[{"date":"YYYY-MM-DD","amount":number,"notes":"merchant or label","category_hint":string|null,"payment_hint":string|null,"is_credit_or_income":boolean}]}\nRules for transaction_list:\n- Emit ONE object per visible spending row (purchases, Zelle sent, transfers out, debits).\n- Set "is_credit_or_income": true for deposits, incoming transfers, green + amounts, salary credits — OMIT those from expenses (still set the flag; do not list pure income rows as expenses).\n- Use positive "amount" for money leaving the account.\n- Read EVERY row you can see (not only the first).\n- "category_hint" / "payment_hint": guess from merchant + type (e.g. Food, Card) using: Categories: ${catList} | Payments: ${payList}\n\nFor single_receipt only: "missing_fields" lists unreadable keys among: "total","date","category","payment","notes","line_items".\nUse plain numbers, no currency symbols.`,
          },
        ];
      } else {
        // PDF receipt: extract text first, then send as text to OpenAI
        scanPhaseOrderRef.current = ["read", "ocr", "ai", "parse"];
        setScanPhase("ocr");
        const text = await extractTextFromFile(f);
        if (scanCancelledRef.current) {
          recoverFromStuckScan();
          return;
        }

        userContent = `Classify the text as either one receipt (single_receipt) or a bank/statement listing (transaction_list) with multiple lines.\n\nSame JSON rules as for receipt images: use image_kind "single_receipt" with total/category/date OR "transaction_list" with a "transactions" array (one row per expense line in the text). Mark credits/income with is_credit_or_income: true and skip them as expenses.\n\nCategories: ${catList}\nPayments: ${payList}\n\nReceipt or statement text:\n${text}`;
      }

      setScanPhase("ai");
      if (scanCancelledRef.current) {
        recoverFromStuckScan();
        return;
      }

      const r = await fetch(OPENAI_API, {
        signal: fetchSignal,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 4096,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "You are an expert expense extractor with merchant intelligence. You read receipt photos AND banking app screenshots. Return ONLY valid JSON, no markdown, no extra text.\n\n" +
                "STEP 1 — Decide image_kind:\n" +
                '- "single_receipt": one paper/store receipt, one invoice, one bill with ONE total.\n' +
                '- "transaction_list": banking app screenshot, account history, Zelle/Venmo list, or ANY screen showing MULTIPLE dated rows with merchant + amount.\n\n' +
                "MERCHANT → CATEGORY INTELLIGENCE (use to assign category_hint):\n" +
                "Food/Dining: restaurants, SQ*, Uber Eats, DoorDash, Starbucks, pizza, cafe, diner, fast food.\n" +
                "Groceries: Walmart (grocery), Costco, Kroger, Safeway, Target (grocery), Trader Joe's, Whole Foods.\n" +
                "Transport/Gas: Shell, Chevron, BP, Uber, Lyft, parking, toll, gas station.\n" +
                "Shopping: Amazon, Target (non-food), Best Buy, Home Depot, clothing stores.\n" +
                "Bills/Utilities: electric, water, internet, phone bill, AT&T, Verizon, Comcast.\n" +
                "Subscriptions: Netflix, Spotify, Disney+, Adobe, gym membership.\n" +
                "Medical: pharmacy, CVS, Walgreens, doctor, hospital.\n" +
                "Transfer: Zelle sent, Venmo sent, PayPal sent, bank transfer, credit card payment (DISCOVER, CAPITAL ONE payment).\n" +
                "INCOME (SKIP as expense): salary, deposit, interest, refund, Zelle received, incoming transfer, green + amounts.\n\n" +
                "PAYMENT METHOD DETECTION for payment_hint — READ EVERY LINE of text for card/bank clues:\n" +
                "- Card brands: Visa, Mastercard, MC, Amex, American Express, Discover, RuPay, JCB anywhere in text → Credit Card.\n" +
                "- Card number endings: ****1234, x1234, XXXX1234, 'ending in', 'last 4 digits' → card payment.\n" +
                "- Bank names with card hint: 'HDFC Credit', 'SBI Card', 'ICICI Platinum', 'Chase Sapphire', 'Axis CC' → Credit Card.\n" +
                "- 'Debit', 'DB', 'POS', 'ATM', 'Savings A/C', 'check card' → Debit Card.\n" +
                "- 'Cash', 'Cash Tendered', 'Change due' → Cash. 'UPI', 'GPay', 'PhonePe', 'Paytm', '@upi', '@ybl' → UPI.\n" +
                "- 'Apple Pay', 'Google Pay', 'Samsung Pay', 'Tap to Pay' → mobile payment.\n" +
                "- 'NEFT', 'RTGS', 'IMPS', 'ACH', 'Wire', 'Net Banking' → Bank Transfer.\n" +
                "- If card brand found (e.g. Visa) but credit vs debit is unclear from a BANK STATEMENT → set payment_hint to null so app asks user.\n" +
                "- If source is a RECEIPT and card brand visible → default to Credit Card.\n\n" +
                "For transaction_list: output EVERY visible expense row in \"transactions\"; never stop at the first row. " +
                "Read the transaction amount column, NOT the running balance column. " +
                'Mark is_credit_or_income: true for deposits, incoming transfers, green + amounts, salary — do not list those as expenses.\n\n' +
                "For single_receipt: use GRAND TOTAL (includes tax+tip). Include \"missing_fields\" when fields are unreadable.\n\n" +
                "CLEAN MERCHANT NAMES in notes: remove \"SQ *\", \"TST*\", store numbers, \"#1234\", \"Purchase\" prefix. Just the merchant name.\n\n" +
                `DATE YEAR RULE: Today is ${new Date().toISOString().split("T")[0]}. ` +
                `For any date that lacks a year, use ${new Date().getFullYear()} as the year. ` +
                `If the month is > ${new Date().getMonth() + 1} (current month), use ${new Date().getFullYear() - 1} instead (those months haven't happened yet). ` +
                "NEVER output future dates. NEVER guess years like 2023 or 2024.",
            },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (scanCancelledRef.current) {
        recoverFromStuckScan();
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = d?.error?.message || `OpenAI error (${r.status})`;
        clearScanHints();
        setScanErr(r.status === 401 ? "Invalid OpenAI API key. Check VITE_OPENAI_API_KEY." : r.status === 429 ? "OpenAI rate limit hit — wait a moment and retry." : msg);
        setScanPhase(null);
        setStep("form");
        return;
      }

      setScanPhase("parse");
      const txt = String(d?.choices?.[0]?.message?.content || "{}");
      const rawJson = extractExpenseJson(txt);

      if (isVisionTransactionList(/** @type {Record<string, unknown>} */ (rawJson))) {
        const txArr = Array.isArray(rawJson.transactions) ? rawJson.transactions : [];
        const importRows = buildImportRowsFromVisionTransactions(txArr, {
          categories: catNames,
          payments: payNames,
        });
        if (importRows.length > 0) {
          clearScanHints();
          setScanErr("");
          setImportBundle({ fileName: f.name || "from-screenshot.csv", rows: importRows });
          setAddMode("import");
          notifyScanReadyIfBackground();
          setScanPhase(null);
          setStep("importPreview");
          return;
        }
        clearScanHints();
        setScanErr(
          "This looks like a transaction list, but no expense rows could be read (or only credits were visible). Try a clearer screenshot or use Import CSV."
        );
        setScanPhase(null);
        setStep("form");
        return;
      }

      const normalized = normalizeScanResult(rawJson, {
        categoryNames: catNames,
        payments: payNames,
        defaultPayment: payNames[0] || "",
        defaultDate: tdStr(),
      });

      const items = Array.isArray(normalized.lineItems) ? normalized.lineItems.slice(0, 50) : [];
      setScanLineItems(items.length ? items : null);
      const mf = normalized.missingFields || [];
      setScanMissingFieldKeys(mf);
      setForm((p) => ({
        ...p,
        amount: normalized.amount,
        category: mf.includes("category") ? "" : normalized.category,
        date: normalized.date,
        payment: mf.includes("payment") ? "" : normalized.payment || p.payment || payNames[0] || "",
        notes: mf.includes("notes") ? "" : normalized.notes || p.notes,
      }));
      let fill = formatMissingScanFieldsMessage(mf);
      if (!fill && (!normalized.amount || parseFloat(normalized.amount) <= 0)) {
        fill = "We couldn’t detect a total on this bill. Enter the amount below before saving.";
      }
      setScanFillPrompt(fill);
      setScanErr("");
      notifyScanReadyIfBackground();
      setScanPhase(null);
      setStep("form");
    } catch (err) {
      if (err?.name === "AbortError" || scanCancelledRef.current) {
        recoverFromStuckScan();
        return;
      }
      console.error(err);
      clearScanHints();
      setScanErr(err instanceof Error ? err.message : "Scan failed. Check your connection and try again.");
      setScanPhase(null);
      setStep("form");
    } finally {
      try { input.value = ""; } catch { /* ignore */ }
      scanFetchAbortRef.current = null;
    }
  }

  function processCsvFile(e) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    setScanErr("");
    const reader = new FileReader();
    reader.onerror = () => {
      setScanErr("Could not read this file from your device.");
      input.value = "";
    };
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const catNames = (catalogRef.current.categories || []).map((c) => c.n).filter(Boolean);
      const payNames = (catalogRef.current.payments || []).filter(Boolean);
      const { rows, fatal } = parseExpenseCsv(text, { categories: catNames, payments: payNames });
      input.value = "";
      if (fatal) {
        setScanErr(fatal);
        return;
      }
      const okCount = rows.filter((r) => r.ok).length;
      if (okCount === 0) {
        setScanErr("No valid rows. Fix category names or amounts and try again.");
        return;
      }
      setImportBundle({ fileName: f.name, rows });
      setAddMode("import");
      setStep("importPreview");
    };
    reader.readAsText(f);
  }

  async function convertOcrTextToCsv() {
    setOcrCsvErr("");
    setOcrCsvFollowUp([]);
    if (!ocrCsvText.trim()) {
      setOcrCsvErr("Paste OCR text or run OCR on an image first.");
      return;
    }
    setOcrCsvBusy(true);
    try {
      const catNames = (catalogRef.current.categories || []).map((c) => c.n).filter(Boolean);
      const payNames = (catalogRef.current.payments || []).filter(Boolean);
      const y = ocrDateYear.trim();
      const yearOk = /^\d{4}$/.test(y) && Number(y) >= 1990 && Number(y) <= 2100;
      const m = ocrDateMonth.trim();
      const dateContext = {
        year: yearOk ? y : String(new Date().getFullYear()),
        ...(m ? { month: m.padStart(2, "0") } : {}),
      };
      const { csv, followUpQuestions } = await convertBillToCsvRobust(ocrCsvText, ocrCsvImageDataUrlRef.current, {
        categories: catNames,
        payments: payNames,
        dateContext,
      });
      setOcrCsvOut(csv);
      setOcrCsvFollowUp(followUpQuestions);
    } catch (e) {
      console.error(e);
      setOcrCsvErr(e instanceof Error ? e.message : "Conversion failed. Try again.");
    } finally {
      setOcrCsvBusy(false);
    }
  }

  const appendOcrFromVoice = useCallback((spoken) => {
    setOcrCsvText((p) => {
      const s = spoken.trim();
      if (!s) return p;
      return p.trim() ? `${p.trim()}\n\n${s}` : s;
    });
  }, []);

  async function fillOcrFromImageFile(e) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    setOcrCsvErr("");
    setOcrCsvFollowUp([]);
    setOcrCsvTessBusy(true);
    try {
      const text = await extractTextFromFile(f, () => {});
      if (f.type.startsWith("image/")) {
        ocrCsvImageDataUrlRef.current = await fileToDataUrl(f);
      } else {
        ocrCsvImageDataUrlRef.current = null;
      }
      setOcrCsvText((prev) => {
        const p = prev.trim();
        return p ? `${p}\n\n${text}` : text;
      });
    } catch (err) {
      console.error(err);
      setOcrCsvErr(
        err instanceof Error ? err.message : "Could not extract text from this file."
      );
    } finally {
      try {
        input.value = "";
      } catch {
        /* ignore */
      }
      setOcrCsvTessBusy(false);
    }
  }

  function downloadOcrCsvResult() {
    if (!ocrCsvOut.trim()) return;
    const blob = new Blob([ocrCsvOut], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "expense-from-ocr.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function applyOcrCsvToImportPreview() {
    setOcrCsvErr("");
    const catNames = (catalogRef.current.categories || []).map((c) => c.n).filter(Boolean);
    const payNames = (catalogRef.current.payments || []).filter(Boolean);
    const { rows, fatal } = parseExpenseCsv(ocrCsvOut, { categories: catNames, payments: payNames });
    if (fatal) {
      setOcrCsvErr(fatal);
      return;
    }
    const okCount = rows.filter((r) => r.ok).length;
    if (okCount === 0) {
      setOcrCsvErr("No valid rows in CSV — fix categories or amounts.");
      return;
    }
    setImportBundle({ fileName: "from-ocr.csv", rows });
    setAddMode("import");
    setStep("importPreview");
  }

  function finishBulkImportSuccess(count, totalAmount) {
    setBulkSuccess({ count, total: totalAmount });
    setStep("success");
    setImportBundle(null);
    setTimeout(() => {
      setStep("mode");
      setBulkSuccess(null);
      const pay = catalogRef.current.payments[0] || "";
      setForm({ amount: "", category: "", date: tdStr(), payment: pay, notes: "", tags: "" });
      setTab("home");
      dlg.toast(`Imported ${count} · ${formatMoney(totalAmount)}`, { type: "success" });
      
    }, 2400);
  }

  async function saveImportedRows() {
    if (!importBundle) return;
    const valid = importBundle.rows.filter((r) => r.ok);
    if (!valid.length) return;
    const tagUuid = (profileTagUuid && String(profileTagUuid).trim()) || uidRef.current || "";
    const totalAmount = valid.reduce((s, r) => s + r.amount, 0);

    if (!uidRef.current) {
      if (fbStatus !== "error") {
        setScanErr("Cloud sync not ready yet — wait a moment and try again.");
        return;
      }
      const additions = valid.map((r) => ({
        id: uid(),
        amount: r.amount,
        category: r.category,
        date: r.date,
        payment: r.payment,
        notes: r.notes,
        tags: r.tags,
        split: null,
        appProfileUuid: tagUuid,
      }));
      setTxs((p) => [...additions, ...p]);
      finishBulkImportSuccess(additions.length, totalAmount);
      return;
    }

    setImportSaving(true);
    setScanErr("");
    try {
      const chunkSize = 450;
      for (let i = 0; i < valid.length; i += chunkSize) {
        const part = valid.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const r of part) {
          const id = uid();
          const newTx = {
            id,
            amount: r.amount,
            category: r.category,
            date: r.date,
            payment: r.payment,
            notes: r.notes,
            tags: r.tags,
            split: null,
            appProfileUuid: tagUuid,
          };
          batch.set(doc(db, "users", uidRef.current, "transactions", id), sanitizeForFirestore(newTx));
        }
        await batch.commit();
      }
      finishBulkImportSuccess(valid.length, totalAmount);
    } catch (e) {
      console.error(e);
      setScanErr("Could not import. Check your connection.");
    } finally {
      setImportSaving(false);
    }
  }

  function startEditImportRow(idx) {
    const r = importBundle?.rows?.[idx];
    if (!r) return;
    setEditingImportIdx(idx);
    setEditImportDraft({
      amount: r.amount > 0 ? String(r.amount) : "",
      date: r.date || "",
      category: r.category || "",
      payment: r.payment || "",
      notes: r.notes || "",
    });
  }

  function saveEditImportRow() {
    if (editingImportIdx == null || !editImportDraft || !importBundle) return;
    const cats = (catalogRef.current.categories || []).map((c) => c.n).filter(Boolean);
    const pays = (catalogRef.current.payments || []).filter(Boolean);
    const amt = parseFloat(editImportDraft.amount);
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(editImportDraft.date);
    const catMatch = cats.find((c) => c === editImportDraft.category) || "";
    const payMatch = pays.find((p) => p === editImportDraft.payment) || pays[0] || "";
    let error = "";
    if (!Number.isFinite(amt) || amt <= 0) error = "Invalid amount";
    else if (!dateOk) error = "Invalid date (YYYY-MM-DD)";
    else if (!catMatch) error = `Unknown category "${editImportDraft.category}"`;

    const updated = [...importBundle.rows];
    updated[editingImportIdx] = {
      ...updated[editingImportIdx],
      amount: Number.isFinite(amt) ? amt : 0,
      date: editImportDraft.date,
      category: catMatch,
      payment: payMatch,
      notes: editImportDraft.notes,
      ok: !error,
      error: error || undefined,
    };
    setImportBundle({ ...importBundle, rows: updated });
    setEditingImportIdx(null);
    setEditImportDraft(null);
  }

  function cancelEditImportRow() {
    setEditingImportIdx(null);
    setEditImportDraft(null);
  }

  async function genTips() {
    const openAiKey = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();
    if (!openAiKey) {
      console.error("VITE_OPENAI_API_KEY not set");
      return;
    }
    setLdTips(true);

    // Payment method breakdown for this month
    const payBreakdown = {};
    monthTxs.forEach((t) => {
      payBreakdown[t.payment] = (payBreakdown[t.payment] || 0) + effectiveAmount(t, profileTagUuid, selfFbUid);
    });

    // Last 7 days total
    const last7 = txs
      .filter((t) => {
        const d = new Date(t.date + "T00:00:00");
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        return d >= cutoff;
      })
      .reduce((s, t) => s + effectiveAmount(t, profileTagUuid, selfFbUid), 0);

    // Budget status per category
    const budgetStatus = Object.entries(budgets).map(([cat, limit]) => ({
      cat,
      limit,
      spent: catSpent[cat] || 0,
      pct: Math.round(((catSpent[cat] || 0) / limit) * 100),
    }));

    // Top 10 individual transactions this month (use the slave's own share for mirrors so
    // AI insights don't over-count split bills that the user didn't actually pay in full).
    const topTx = [...monthTxs]
      .map((t) => ({ ...t, _eff: effectiveAmount(t, profileTagUuid, selfFbUid) }))
      .sort((a, b) => b._eff - a._eff)
      .slice(0, 10)
      .map((t) => ({ amount: t._eff, cat: t.category, notes: t.notes, date: t.date }));

    const currency = currencyCode || "INR";

    /* Condensed split snapshot — gives the model enough signal to reason about
     * friend balances, recoverability risk and category skew without flooding
     * the prompt with full tx dumps. */
    const splitSnapshot = splitAnalytics.splitCount > 0 ? {
      billCount: splitAnalytics.splitCount,
      totalBillValue: Math.round(splitAnalytics.splitTotalValue),
      outstandingTheyOweYou: Math.round(splitAnalytics.outstandingToYou),
      outstandingYouOweThem: Math.round(splitAnalytics.outstandingFromYou),
      alreadyRecovered: Math.round(splitAnalytics.settledToYou),
      alreadyPaidBack: Math.round(splitAnalytics.settledFromYou),
      netPosition: Math.round(splitAnalytics.netPosition),
      topPeers: splitAnalytics.peers.slice(0, 5).map((p) => ({
        name: p.name,
        net: Math.round(p.net),
        bills: p.splitCount,
        theyOweYou: Math.round(p.theyOweYou),
        youOweThem: Math.round(p.youOweThem),
      })),
      topFriendsByVolume: splitAnalytics.byFriend.slice(0, 5).map((f) => ({ name: f.name, value: Math.round(f.value) })),
      topCategoriesByVolume: splitAnalytics.byCategory.slice(0, 5).map((c) => ({ name: c.name, value: Math.round(c.value) })),
    } : null;

    const summary = {
      currency,
      period: "current month",
      monthTotal,
      overallMonthlyBudgetCap: typeof monthlyBudgetTotal === "number" && monthlyBudgetTotal > 0 ? monthlyBudgetTotal : null,
      weekTotal,
      last7DaysTotal: last7,
      totalTransactions: monthTxs.length,
      categorySpending: Object.fromEntries(
        Object.entries(catSpent).sort(([, a], [, b]) => b - a)
      ),
      paymentMethods: payBreakdown,
      budgetStatus,
      overBudgetCategories: budgetStatus.filter((b) => b.pct > 100).map((b) => b.cat),
      nearLimitCategories: budgetStatus.filter((b) => b.pct >= 80 && b.pct <= 100).map((b) => b.cat),
      top10Transactions: topTx,
      splits: splitSnapshot,
    };

    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content:
                `You are a personal finance advisor. Analyse the user's REAL spending data and return ONLY a JSON array of exactly 5 personalised insights. ` +
                `Each insight must reference actual numbers from the data. ` +
                `If \`splits\` is present, at least one insight MUST address shared-bill dynamics (outstanding balances, recovery from friends, or repeated split categories). ` +
                `Format: [{icon:string(single emoji),title:string(max 8 words),desc:string(1-2 sentences, mention real amounts in ${currency}),saving:string(estimated saving e.g. "${currency} 500/month"),priority:"high"|"medium"|"low"}]` +
                `. Return ONLY the JSON array — no markdown, no explanation.`,
            },
            {
              role: "user",
              content: `My expense data:\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        }),
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("genTips error", d?.error?.message || r.status);
        setTips([]);
        return;
      }
      const raw = String(d?.choices?.[0]?.message?.content || "[]").trim();
      let parsed = [];
      try {
        parsed = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim());
      } catch {
        /* ignore */
      }
      const nextTips = Array.isArray(parsed) ? parsed : [];
      const ts = Date.now();
      setTips(nextTips);
      setAiInsightsUpdatedAt(ts);
      if (uidRef.current) {
        try {
          await setDoc(
            doc(db, "users", uidRef.current, "settings", "app"),
            { aiInsights: { items: nextTips, updatedAt: ts } },
            { merge: true }
          );
        } catch (persistErr) {
          console.error("Could not save AI insights", persistErr);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLdTips(false);
    }
  }

  async function saveBudget() {
    if (!bmAmt || isNaN(+bmAmt)) return;
    const next = parseFloat(bmAmt);
    if (next <= 0) return;

    if (bmCat === MONTH_TOTAL_BUDGET_KEY) {
      if (uidRef.current) {
        try {
          await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { monthlyBudgetTotal: next }, { merge: true });
        } catch (e) {
          console.error(e);
          return;
        }
      } else {
        setMonthlyBudgetTotal(next);
      }
      setShowBM(false);
      setBmCat("");
      setBmAmt("");
      return;
    }

    if (!bmCat) return;
    if (uidRef.current) {
      try {
        await setDoc(
          doc(db, "users", uidRef.current, "settings", "app"),
          { budgets: { ...budgets, [bmCat]: next } },
          { merge: true }
        );
      } catch (e) {
        console.error(e);
        return;
      }
    } else {
      setBudgets((p) => ({ ...p, [bmCat]: next }));
    }
    setShowBM(false);
    setBmCat("");
    setBmAmt("");
  }

  async function removeMonthlyBudgetTotal() {
    if (!await dlg.confirm("Remove your overall monthly spending cap? The ring on Home will be hidden until you set a new cap.", { title: "Remove Cap", danger: true, confirmLabel: "Remove" })) return;
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { monthlyBudgetTotal: deleteField() }, { merge: true });
      } catch (e) {
        console.error(e);
        return;
      }
    } else {
      setMonthlyBudgetTotal(null);
    }
  }

  async function removeBudgetCategory(cat) {
    if (!cat || !(cat in budgets)) return;
    if (!await dlg.confirm(`Remove the budget for "${cat}"?`, { title: "Remove Budget", danger: true, confirmLabel: "Remove" })) return;
    const next = { ...budgets };
    delete next[cat];
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { budgets: next }, { merge: true });
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setBudgets(next);
  }

  async function clearAllBudgets() {
    const keys = Object.keys(budgets);
    if (keys.length === 0) return;
    if (!await dlg.confirm(`Remove all ${keys.length} category budget${keys.length === 1 ? "" : "s"}? Monthly limits will be cleared.`, { title: "Clear Budgets", danger: true, confirmLabel: "Clear All" })) return;
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { budgets: {} }, { merge: true });
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setBudgets({});
  }

  async function saveFixedExpense() {
    const { name, amount, category, dueDay } = fixedDraft;
    if (!name.trim() || !amount || isNaN(+amount) || +amount <= 0) return;
    const entry = { name: name.trim(), amount: parseFloat(amount), category: category || "Bills", dueDay: parseInt(dueDay) || 1 };
    const exists = fixedExpenses.findIndex((f) => f.name === entry.name);
    const next = exists >= 0 ? fixedExpenses.map((f, i) => (i === exists ? entry : f)) : [...fixedExpenses, entry];
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { fixedExpenses: next }, { merge: true });
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setFixedExpenses(next);
    setShowFixedModal(false);
    setFixedDraft({ name: "", amount: "", category: "", dueDay: "1" });
  }

  async function removeFixedExpense(name) {
    if (!await dlg.confirm(`Remove "${name}" from fixed expenses?`, { title: "Remove Expense", danger: true, confirmLabel: "Remove" })) return;
    const next = fixedExpenses.filter((f) => f.name !== name);
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { fixedExpenses: next }, { merge: true });
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setFixedExpenses(next);
  }

  const fixedTotal = fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0);

  async function saveTheme(themeId) {
    setUserTheme(themeId);
    try { localStorage.setItem("track_theme", themeId); } catch {}
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { theme: themeId }, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }
  }

  /**
   * Persist the user's display name from any caller (header card or profile
   * tab). Returns true on success so the caller can close its own UI.
   */
  async function persistProfileName(name) {
    const clean = String(name || "").trim();
    if (!clean) return false;
    setProfileName(clean);
    if (uidRef.current) {
      try {
        await setDoc(
          doc(db, "users", uidRef.current, "settings", "app"),
          { profileName: clean },
          { merge: true }
        );
      } catch (e) {
        console.error(e);
        return false;
      }
    }
    return true;
  }

  function openNameEditor() {
    setNameDraft(profileName || "");
    setShowNameEdit(true);
  }
  async function saveNameFromHeader() {
    if (savingName) return;
    const ok = await (async () => {
      setSavingName(true);
      try {
        return await persistProfileName(nameDraft);
      } finally {
        setSavingName(false);
      }
    })();
    if (ok) {
      setShowNameEdit(false);
      notifyOp("Name updated", nameDraft.trim(), { type: "success" });
    } else {
      dlg.toast("Enter a name before saving", { type: "warn" });
    }
  }

  async function saveReportFreq(freq) {
    setReportFreq(freq);
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { reportFreq: freq }, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function saveUserCurrency(cur) {
    setUserCurrency(cur);
    setShowCurrencyPicker(false);
    if (uidRef.current) {
      try {
        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { userCurrency: cur }, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }
  }

  function toggleSplitPerson(name) {
    setSplitPpl((prev) => {
      const ex = prev.find((p) => p.n === name);
      const nl = ex ? prev.filter((p) => p.n !== name) : (() => {
        // Carry fuid/u/e from the contact so mirror writes work without name-match lookup
        const contact = people.map(normalizePerson).find((p) => p.n === name);
        const base = contact ? { n: contact.n, a: 0, ...(contact.fuid ? { fuid: contact.fuid } : {}), ...(contact.u ? { u: contact.u } : {}), ...(contact.e ? { e: contact.e } : {}) } : { n: name, a: 0 };
        return [...prev, base];
      })();
      if (splitType === "equal" && form.amount && nl.length > 0) {
        const each = parseFloat(form.amount) / (nl.length + 1);
        const rounded = Math.round(each * 100) / 100;
        return nl.map((p) => ({ ...p, a: rounded }));
      }
      return nl;
    });
  }

  if (!authChecked) {
    return (
      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth: maxShell,
          alignSelf: "center",
          minHeight: 0,
          height: "100%",
          boxSizing: "border-box",
          background: T.bg,
          color: T.txt,
          overflowY: "auto",
          fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        }}
      >
        <HomeSkeleton px={px} />
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthGate />;
  }

  const mainBottomPad = "calc(96px + env(safe-area-inset-bottom, 0px))";

  return (
    <>
    <div
      style={{
        background: T.bg,
        color: T.txt,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        width: "100%",
        maxWidth: maxShell,
        alignSelf: "center",
        paddingLeft: 0,
        paddingRight: 0,
        boxSizing: "border-box",
        fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(${T.id === "light" ? "0" : "0.5"});}
        select option{background:${T.card};color:${T.txt};}
        @keyframes spin{to{transform:rotate(360deg);}}
        .spin{animation:spin 1s linear infinite;}
        @keyframes pop{0%{transform:scale(0.8);opacity:0}100%{transform:scale(1);opacity:1}}
        .pop{animation:pop .3s ease-out;}
        .tab-content{animation:tab-enter .25s ease-out;}
        button:active{transform:scale(0.97);transition:transform .08s;}
      `}</style>

      {/* Skeleton screens handle the loading state — no banner needed */}
      {fbStatus === "error" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            width: "100%",
            maxWidth: maxShell,
            marginLeft: "auto",
            marginRight: "auto",
            zIndex: 200,
            padding: `12px ${px}px`,
            paddingTop: `max(12px, ${safeTop})`,
            background: T.wdim,
            borderBottom: "1px solid " + T.warn + "59",
            fontSize: 11,
            color: T.warn,
            textAlign: "left",
            lineHeight: 1.45,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontWeight: 700 }}>Cloud unavailable</div>
          <div style={{ marginTop: 4 }}>
            Expenses save in this browser only until Firebase works. In Console: enable <strong>Anonymous</strong> sign-in, create a <strong>Firestore</strong> database (same project), deploy rules, then use{" "}
            <strong>Retry</strong> below.
          </div>
          {fbErrorDetail ? (
            <div style={{ marginTop: 8, fontSize: 10, opacity: 0.85, wordBreak: "break-word", fontFamily: "ui-monospace, monospace" }}>
              {fbErrorDetail.length > 160 ? `${fbErrorDetail.slice(0, 160)}…` : fbErrorDetail}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setFbErrorDetail("");
              setFbStatus("loading");
              setFbBootKey((k) => k + 1);
            }}
            style={{
              marginTop: 10,
              padding: "8px 14px",
              borderRadius: T.r,
              border: `1px solid ${T.warn}73`,
              background: T.id === "light" ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.2)",
              color: T.warn,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry connection
          </button>
        </div>
      )}

      <PullToRefresh scrollRef={mainScrollRef} onRefresh={handlePullRefresh} />
      <div
        ref={mainScrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          paddingBottom: mainBottomPad,
          overflowY: "auto",
          overflowX: "hidden",
          paddingTop: safeTop,
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {tab === "home" && fbStatus === "loading" && txs.length === 0 && (
          <HomeSkeleton px={px} />
        )}
        {tab === "home" && !(fbStatus === "loading" && txs.length === 0) && (
          <div className="tab-content">
            <div style={{ padding: `${px + 8}px ${px}px ${px}px`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: T.sub }}>{new Date().getHours() < 12 ? "Good Morning" : "Good Evening"} 👋</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: comfortable ? 26 : 22,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                    title={profileName || "Add your name"}
                  >
                    {profileName.trim() || "Add your name"}
                  </div>
                  <button
                    type="button"
                    onClick={openNameEditor}
                    aria-label="Edit display name"
                    title="Edit display name"
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border: `1px solid ${T.bdr}`,
                      background: T.card2,
                      color: T.sub,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab("profile")}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: T.card,
                  border: `1px solid ${T.bdr}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <User size={17} color={T.sub} />
              </button>
            </div>

            <div
              style={{
                margin: `0 ${px}px 14px`,
                background: T.heroGrad,
                borderRadius: T.rLg,
                padding: 22,
                border: `1px solid ${T.bdr}`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -20,
                  top: -20,
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  background: T.adim,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 20,
                  bottom: -30,
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: T.bdim,
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.sub, marginBottom: 3 }}>This Month</div>
                  <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.1 }}>{formatMoney(monthTotal)}</div>
                  <div style={{ fontSize: 11, color: T.mut, marginTop: 4, lineHeight: 1.35 }}>
                    Only spending dated in {calendarMonthLabel}. Imports keep the date from the bank or receipt.
                  </div>
                </div>
                {monthBudgetRing ? (
                  <button
                    type="button"
                    onClick={() => setTab("budgets")}
                    title="Monthly spending cap — tap to edit in Budgets"
                    aria-label="Monthly budget progress, open Budgets"
                    style={{
                      flexShrink: 0,
                      position: "relative",
                      width: 92,
                      height: 92,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <svg width={92} height={92} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden>
                      <circle cx="50" cy="50" r="38" fill="none" stroke={T.id === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"} strokeWidth="6" />
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke={monthBudgetRing.over ? T.dng : monthBudgetRing.remainingFrac <= 0.2 ? T.warn : T.acc}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${monthBudgetRing.remainingFrac * (2 * Math.PI * 38)} ${2 * Math.PI * 38}`}
                        style={{ transition: "stroke-dasharray 0.45s ease, stroke 0.25s ease" }}
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      {monthBudgetRing.over ? (
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.dng }}>Over</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px" }}>{Math.round(monthBudgetRing.remainingFrac * 100)}%</div>
                          <div style={{ fontSize: 9, color: T.sub, marginTop: 1 }}>left</div>
                        </>
                      )}
                    </div>
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: T.id === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: T.sub, marginBottom: 3 }}>Today</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{formatMoney(todayTotal)}</div>
                </div>
                <div style={{ flex: 1, background: T.id === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: T.sub, marginBottom: 3 }}>This Week</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{formatMoney(weekTotal)}</div>
                </div>
              </div>
            </div>

            {expenseCountOutsideThisCalendarMonth > 0 && monthTotal === 0 && txs.length > 0 ? (
              <div
                style={{
                  margin: `0 ${px}px 12px`,
                  padding: "10px 14px",
                  borderRadius: T.r,
                  border: `1px solid ${T.bdr}`,
                  background: T.card2,
                  fontSize: 12,
                  color: T.sub,
                  lineHeight: 1.45,
                }}
              >
                <span style={{ fontWeight: 700, color: T.txt }}>{expenseCountOutsideThisCalendarMonth}</span>{" "}
                {expenseCountOutsideThisCalendarMonth === 1 ? "expense is" : "expenses are"} dated outside {calendarMonthLabel}, so
                this month’s total stays at {formatMoney(0)}. They still appear in{" "}
                <strong style={{ color: T.txt }}>Recent</strong> below. Open one to change the date, or go to{" "}
                <button
                  type="button"
                  onClick={() => {
                    setTab("analytics");
                    setDf("custom");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: T.acc,
                    fontWeight: 700,
                    cursor: "pointer",
                    font: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  Analytics → Custom
                </button>{" "}
                and set From / To to cover your import.
              </div>
            ) : null}

            {!loggedToday && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setTab("add");
                  setStep("mode");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setTab("add");
                    setStep("mode");
                  }
                }}
                style={{
                  margin: `0 ${px}px 14px`,
                  background: T.wdim,
                  border: `1px solid ${T.warn}4D`,
                  borderRadius: T.r,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={26} color={T.warn} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.warn }}>Daily Expense Log Pending</div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 1 }}>No entries today — tap to log now</div>
                </div>
                <span style={{ color: T.warn, fontSize: 20, fontWeight: 300 }}>›</span>
              </div>
            )}

            {showHomeAiTipBanner && tips[0] && (
              <div
                style={{
                  margin: `0 ${px}px 14px`,
                  background: T.adim,
                  border: "1px solid rgba(34,197,94,0.22)",
                  borderRadius: T.r,
                  padding: "12px 16px",
                  position: "relative",
                  paddingRight: 40,
                }}
              >
                <button
                  type="button"
                  aria-label="Dismiss insight"
                  onClick={() => dismissHomeAiTipBanner()}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 30,
                    height: 30,
                    border: "none",
                    borderRadius: T.r,
                    background: T.id === "light" ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.2)",
                    color: T.sub,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
                <div style={{ fontSize: 11, color: T.acc, fontWeight: 700, marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={11} /> AI INSIGHT
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{tips[0].title}</div>
                <div style={{ fontSize: 12, color: T.sub }}>{tips[0].desc}</div>
              </div>
            )}

            <div
              style={{
                margin: `0 ${px}px 14px`,
                display: "grid",
                gridTemplateColumns: comfortable ? "repeat(2, minmax(0, 1fr))" : "1fr 1fr",
                gap: comfortable ? 14 : 10,
              }}
            >
              {[
                {
                  Icon: Camera,
                  title: "Scan Bill",
                  sub: "AI reads receipt",
                  color: T.acc,
                  cdim: T.adim,
                  action: () => {
                    setAddMode("image");
                    setTab("add");
                    setStep("mode");
                  },
                },
                {
                  Icon: BarChart2,
                  title: "Analytics",
                  sub: "Charts & insights",
                  color: T.blue,
                  cdim: T.bdim,
                  action: () => setTab("analytics"),
                },
              ].map((a) => (
                <div key={a.title} onClick={a.action} style={{ ...card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: a.cdim,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <a.Icon size={18} color={a.color} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: T.sub }}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {Object.entries(budgets)
              .filter(([c, l]) => c !== MONTH_TOTAL_BUDGET_KEY && (catSpent[c] || 0) >= l * 0.8)
              .slice(0, 2)
              .map(([c, l]) => {
                const sp = catSpent[c] || 0;
                const over = sp > l;
                const cat = getCat(categories, c);
                return (
                  <div
                    key={c}
                    style={{
                      margin: `0 ${px}px 10px`,
                      background: over ? T.ddim : T.wdim,
                      border: `1px solid ${over ? `${T.dng}4D` : `${T.warn}4D`}`,
                      borderRadius: T.r,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <CategoryIcon name={c} size={20} color={over ? T.dng : T.warn} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: over ? T.dng : T.warn }}>
                        {c} budget {over ? "exceeded!" : "at 80%"}
                      </div>
                      <div style={{ fontSize: 12, color: T.sub }}>
                        Spent {formatMoney(sp)} of {formatMoney(l)}
                      </div>
                    </div>
                  </div>
                );
              })}

            <div style={{ padding: `0 ${px}px` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Recent</div>
                <button type="button" onClick={() => setTab("analytics")} style={{ background: "none", border: "none", color: T.acc, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  See all
                </button>
              </div>
              {txs.slice(0, 100).map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  onDelete={delTx}
                  onSelect={setSelectedTx}
                  categories={categories}
                  formatMoney={formatMoney}
                  dateLocale={dateLocale || locale}
                  selfProfileUuid={profileTagUuid || ""}
                  selfFbUid={selfFbUid}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "add" && (
          <div style={{ position: "relative" }}>
            <input
              ref={scanCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple={false}
              style={{ display: "none" }}
              onChange={(e) => void processFile(e, false)}
            />
            <input
              ref={scanGalleryRef}
              type="file"
              accept="image/*"
              multiple={false}
              style={{ display: "none" }}
              onChange={(e) => void processFile(e, false)}
            />
            {step !== "processing" && (
            <div style={{ padding: `${px + 8}px ${px}px`, display: "flex", alignItems: "center", gap: 12 }}>
              {(step === "form" ||
                step === "importPreview" ||
                step === "ocrCsv" ||
                step === "scanSource") && (
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => {
                    if (step === "scanSource") {
                      setStep("mode");
                      try {
                        if (scanCameraRef.current) scanCameraRef.current.value = "";
                        if (scanGalleryRef.current) scanGalleryRef.current.value = "";
                      } catch {
                        /* ignore */
                      }
                      return;
                    }
                    setStep("mode");
                    setScanErr("");
                    clearScanHints();
                    setImportBundle(null);
                    setPreviewImg(null);
                    setScanLineItems(null);
                    setScanPhase(null);
                    setOcrCsvText("");
                    setOcrCsvOut("");
                    setOcrCsvErr("");
                  }}
                  style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 4, minWidth: 44, minHeight: 44 }}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {step === "mode"
                  ? "Add Expense"
                  : step === "form"
                    ? "Expense Details"
                    : step === "importPreview"
                      ? "Review import"
                      : step === "ocrCsv"
                        ? "OCR → CSV"
                        : step === "scanSource"
                          ? "Scan receipt"
                          : step === "success"
                            ? "Saved!"
                            : "Add Expense"}
              </div>
            </div>
            )}

            {step === "processing" && (
              <div
                role="dialog"
                aria-modal="true"
                aria-busy="true"
                aria-label="Scanning receipt"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 160,
                  maxWidth: maxShell,
                  marginLeft: "auto",
                  marginRight: "auto",
                  background: T.id === "light" ? "rgba(240,240,245,0.98)" : "rgba(10,10,22,0.96)",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  flexDirection: "column",
                  paddingTop: safeTop,
                  paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
                  paddingLeft: px,
                  paddingRight: px,
                  boxSizing: "border-box",
                }}
              >
                <button
                  type="button"
                  onClick={() => cancelActiveScan()}
                  style={{
                    alignSelf: "flex-start",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "none",
                    border: "none",
                    color: T.sub,
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 600,
                    padding: "8px 4px",
                    marginBottom: 8,
                  }}
                >
                  <ArrowLeft size={20} /> Cancel scan
                </button>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 0 }}>
                  <div
                    className="spin"
                    style={{
                      width: 48,
                      height: 48,
                      border: `3px solid ${T.bdr}`,
                      borderTopColor: T.acc,
                      borderRadius: "50%",
                      marginBottom: 20,
                    }}
                  />
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Scanning receipt…</div>
                  <div style={{ fontSize: 13, color: T.sub, marginBottom: 24, lineHeight: 1.45, maxWidth: 300 }}>
                    Large photos or a slow connection can take 30–60 seconds. Keep this screen open.
                  </div>
                  <div style={{ textAlign: "left", width: "100%", maxWidth: 320, fontSize: 13 }}>
                    {(scanPhaseOrderRef.current.length ? scanPhaseOrderRef.current : ["read", "ai", "parse"]).map((id, i, order) => {
                      const labels = {
                        read: "Reading file from your device",
                        ocr: "Extracting text from file",
                        ai: "Sending to OpenAI for analysis",
                        parse: "Parsing total, category & lines",
                      };
                      const phase = order.includes(scanPhase) ? scanPhase : order[0];
                      const idx = order.indexOf(phase);
                      const done = idx > i;
                      const active = phase === id;
                      return (
                        <div
                          key={id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 0",
                            borderBottom: i < order.length - 1 ? `1px solid ${T.bdr}` : "none",
                            color: done || active ? T.txt : T.mut,
                            fontWeight: active ? 700 : 500,
                          }}
                        >
                          <span style={{ width: 22, textAlign: "center" }}>{done ? "✓" : active ? "…" : "○"}</span>
                          {labels[id] || id}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

              {step === "mode" && (
              <div style={{ padding: `0 ${px}px` }}>
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 18 }}>Choose how to add your expense</div>
                {[
                  { mode: "manual", Icon: Pencil, title: "Manual Entry", sub: "Type in amount & details", col: T.acc },
                  {
                    mode: "import",
                    Icon: ClipboardList,
                    title: "Import CSV",
                    sub: "One .csv file — category names must match your app",
                    col: T.warn,
                  },
                  {
                    mode: "ocrCsv",
                    Icon: ScanLine,
                    title: "OCR → CSV",
                    sub: "Paste bill text or OCR an image; OpenAI builds import CSV (dev server)",
                    col: T.purp,
                  },
                  {
                    mode: "image",
                    Icon: QrCode,
                    title: "Scan Receipt / Bill",
                    sub: "Take a photo or choose one image from your library",
                    col: T.blue,
                  },
                  {
                    mode: "statement",
                    Icon: Wallet,
                    title: "Upload Statement",
                    sub: "Bank or credit card PDF",
                    col: T.purp,
                    comingSoon: true,
                  },
                ].map((opt) => (
                  <div
                    key={opt.mode}
                    role={opt.comingSoon ? undefined : "button"}
                    tabIndex={opt.comingSoon ? -1 : 0}
                    onClick={() => {
                      if (opt.comingSoon) return;
                      setAddMode(opt.mode);
                      if (opt.mode === "manual") setStep("form");
                      else if (opt.mode === "import") csvRef.current?.click();
                      else if (opt.mode === "ocrCsv") {
                        setOcrCsvErr("");
                        setStep("ocrCsv");
                      } else if (opt.mode === "image") {
                        setScanErr("");
                        setStep("scanSource");
                      }
                      else stmtRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (opt.comingSoon) return;
                      if (e.key === "Enter" || e.key === " ") {
                        setAddMode(opt.mode);
                        if (opt.mode === "manual") setStep("form");
                        else if (opt.mode === "import") csvRef.current?.click();
                        else if (opt.mode === "ocrCsv") {
                          setOcrCsvErr("");
                          setStep("ocrCsv");
                        } else if (opt.mode === "image") {
                        setScanErr("");
                        setStep("scanSource");
                      }
                        else stmtRef.current?.click();
                      }
                    }}
                    style={{
                      ...card,
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      cursor: opt.comingSoon ? "not-allowed" : "pointer",
                      opacity: opt.comingSoon ? 0.55 : 1,
                      borderColor: opt.comingSoon ? T.bdr : addMode === opt.mode ? opt.col : T.bdr,
                      transition: "border-color .15s, opacity .15s",
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${opt.col}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <opt.Icon size={22} color={opt.col} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {opt.title}
                        {opt.comingSoon ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              color: T.mut,
                              border: `1px solid ${T.bdr}`,
                              borderRadius: 6,
                              padding: "2px 7px",
                              background: T.card2,
                            }}
                          >
                            Coming soon
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                        {opt.comingSoon ? "PDF / Excel statement import — in development" : opt.sub}
                      </div>
                    </div>
                    <span style={{ color: T.mut, fontSize: 18 }}>{opt.comingSoon ? "—" : "›"}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Hidden file inputs — always mounted while tab=add so refs work in any step */}
            <input ref={stmtRef} type="file" accept="image/*,.pdf,image/heic,image/heif" style={{ display: "none" }} onChange={(e) => void processFile(e, true)} />
            <input ref={csvRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: "none" }} onChange={(e) => processCsvFile(e)} />
            <input ref={ocrCsvImgRef} type="file" accept="image/*,application/pdf,.pdf,.xlsx,.xls,.ods" style={{ display: "none" }} onChange={(e) => void fillOcrFromImageFile(e)} />

            {step === "scanSource" && (
              <div style={{ padding: `0 ${px}px`, paddingBottom: `max(28px, calc(16px + env(safe-area-inset-bottom, 0px)))` }}>
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 18, lineHeight: 1.45 }}>
                  Use the camera for a new shot, or pick a single photo from your library. Only one image is scanned at a time.
                </div>
                {scanErr ? (
                  <div
                    style={{
                      background: T.ddim,
                      border: "1px solid ${T.dng}59",
                      borderRadius: T.r,
                      padding: "10px 14px",
                      marginBottom: 16,
                      fontSize: 13,
                      color: T.dng,
                      lineHeight: 1.45,
                    }}
                  >
                    {scanErr}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => scanCameraRef.current?.click()}
                  style={{
                    ...card,
                    width: "100%",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: "pointer",
                    borderColor: T.blue,
                    textAlign: "left",
                    font: "inherit",
                    color: "inherit",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${T.blue}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Camera size={22} color={T.blue} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Take photo</div>
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>Opens your camera</div>
                  </div>
                  <ChevronRight size={16} color={T.mut} />
                </button>
                <button
                  type="button"
                  onClick={() => scanGalleryRef.current?.click()}
                  style={{
                    ...card,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: "pointer",
                    borderColor: T.bdr,
                    textAlign: "left",
                    font: "inherit",
                    color: "inherit",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${T.acc}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ImageIcon size={22} color={T.acc} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Choose one photo</div>
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>From gallery — one image only</div>
                  </div>
                  <ChevronRight size={16} color={T.mut} />
                </button>
              </div>
            )}

            {step === "ocrCsv" && (
              <div
                style={{
                  padding: `0 ${px}px`,
                  paddingBottom: `max(28px, calc(16px + env(safe-area-inset-bottom, 0px)))`,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <button
                    type="button"
                    disabled={ocrCsvTessBusy}
                    onClick={() => ocrCsvImgRef.current?.click()}
                    style={{
                      ...inp,
                      flex: 1,
                      minWidth: 120,
                      minHeight: 44,
                      cursor: ocrCsvTessBusy ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      background: T.card2,
                    }}
                  >
                    {ocrCsvTessBusy ? "Extracting…" : "Upload image / file"}
                  </button>
                  <OcrCsvVoiceControls
                    active={step === "ocrCsv"}
                    disabled={ocrCsvBusy || ocrCsvTessBusy}
                    onAppend={appendOcrFromVoice}
                  />
                </div>
                <textarea
                  value={ocrCsvText}
                  onChange={(e) => setOcrCsvText(e.target.value)}
                  placeholder="Paste receipt / bank text here, or use the buttons above…"
                  rows={6}
                  style={{
                    ...inp,
                    width: "100%",
                    resize: "vertical",
                    minHeight: 120,
                    fontFamily: "ui-monospace, monospace",
                    lineHeight: 1.4,
                    marginBottom: 12,
                  }}
                />
                <button
                  type="button"
                  disabled={ocrCsvBusy || ocrCsvTessBusy}
                  onClick={() => void convertOcrTextToCsv()}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: T.rLg,
                    background: ocrCsvBusy ? T.mut : T.acc,
                    border: "none",
                    color: T.btnTxt,
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: ocrCsvBusy ? "not-allowed" : "pointer",
                    marginBottom: 12,
                    minHeight: 52,
                  }}
                >
                  {ocrCsvBusy ? "Converting…" : "Convert to CSV"}
                </button>
                <details style={{ ...card2, marginBottom: 14, fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, color: T.txt }}>Settings & tools</summary>
                  <div style={{ marginTop: 12 }}>
                    <label style={lbl}>Date context</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>Year (defaults to {new Date().getFullYear()})</div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={ocrDateYear}
                          onChange={(e) => setOcrDateYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder={String(new Date().getFullYear())}
                          style={{ ...inp, width: "100%", minHeight: 40 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>Month (01–12)</div>
                        <select
                          value={ocrDateMonth}
                          onChange={(e) => setOcrDateMonth(e.target.value)}
                          style={{ ...inp, width: "100%", minHeight: 40 }}
                        >
                          <option value="">Auto</option>
                          {Array.from({ length: 12 }, (_, i) => {
                            const mm = String(i + 1).padStart(2, "0");
                            return <option key={mm} value={mm}>{mm}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                    {ocrTextLooksMissingFourDigitYear(ocrCsvText) && (
                      <div style={{ fontSize: 11, color: T.warn, marginBottom: 10 }}>
                        No year found in text — current year will be used.
                      </div>
                    )}
                    <ExternalLlmCsvPromptPanel
                      prompt={externalLlmImagePrompt}
                      onCopy={copyExternalLlmImagePrompt}
                      disabled={ocrCsvBusy || ocrCsvTessBusy}
                      blurb="Copy this prompt into ChatGPT, Claude, Gemini, or any vision model. Attach your screenshot, then paste the CSV result above."
                    />
                  </div>
                </details>
                {ocrCsvErr && (
                  <div
                    style={{
                      background: T.ddim,
                      border: "1px solid ${T.dng}59",
                      borderRadius: T.r,
                      padding: "10px 14px",
                      marginBottom: 12,
                      fontSize: 13,
                      color: T.dng,
                      lineHeight: 1.45,
                    }}
                  >
                    {ocrCsvErr}
                  </div>
                )}
                {ocrCsvFollowUp.length > 0 && (
                  <div
                    style={{
                      background: T.card2,
                      border: `1px solid ${T.bdr}`,
                      borderRadius: T.r,
                      padding: "12px 14px",
                      marginBottom: 12,
                      fontSize: 13,
                      color: T.txt,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8, color: T.sub }}>Please add or confirm</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {ocrCsvFollowUp.map((q, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {q}
                        </li>
                      ))}
                    </ul>
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 10 }}>
                      Type answers or fixes in the text box above, then tap <strong>Convert to CSV</strong> again.
                    </div>
                  </div>
                )}
                {ocrCsvOut ? (
                  <>
                    <label style={{ ...lbl, marginTop: 8 }}>Result CSV</label>
                    <textarea
                      readOnly
                      value={ocrCsvOut}
                      rows={10}
                      style={{
                        ...inp,
                        width: "100%",
                        fontFamily: "ui-monospace, monospace",
                        lineHeight: 1.4,
                        marginBottom: 12,
                      }}
                    />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => downloadOcrCsvResult()}
                        style={{
                          flex: 1,
                          minWidth: 120,
                          padding: "12px 14px",
                          borderRadius: T.r,
                          border: `1px solid ${T.bdr}`,
                          background: T.card2,
                          color: T.txt,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Download .csv
                      </button>
                      <button
                        type="button"
                        onClick={() => applyOcrCsvToImportPreview()}
                        style={{
                          flex: 1,
                          minWidth: 120,
                          padding: "12px 14px",
                          borderRadius: T.r,
                          border: "none",
                          background: T.acc,
                          color: T.btnTxt,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Preview import
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {step === "importPreview" && importBundle && (
              <div
                style={{
                  padding: `0 ${px}px`,
                  paddingBottom: `max(28px, calc(16px + env(safe-area-inset-bottom, 0px)))`,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: T.txt }}>{importBundle.fileName}</span>
                  <span style={{ marginLeft: 8 }}>
                    {importBundle.rows.filter((r) => r.ok).length} ready
                    {importBundle.rows.some((r) => !r.ok) ? ` · ${importBundle.rows.filter((r) => !r.ok).length} skipped` : ""}
                  </span>
                </div>

                <details style={{ ...card2, marginBottom: 14, fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, color: T.txt }}>CSV format (required columns)</summary>
                  <div style={{ marginTop: 10 }}>
                    Header row + columns: <code style={{ color: T.acc }}>amount</code>, <code style={{ color: T.acc }}>date</code>,{" "}
                    <code style={{ color: T.acc }}>category</code> (must match your app categories). Optional:{" "}
                    <code>payment</code>, <code>notes</code>, <code>tags</code>. Parser:{" "}
                    <a href="https://www.papaparse.com/" target="_blank" rel="noopener noreferrer" style={{ color: T.blue }}>
                      Papa Parse
                    </a>
                    . Full spec: <code style={{ fontSize: 11 }}>docs/IMPORT_CSV.md</code> in the repo.
                  </div>
                </details>

                {scanErr && (
                  <div
                    style={{
                      background: T.ddim,
                      border: "1px solid ${T.dng}59",
                      borderRadius: T.r,
                      padding: "10px 14px",
                      marginBottom: 14,
                      fontSize: 13,
                      color: T.dng,
                      lineHeight: 1.45,
                    }}
                  >
                    {scanErr}
                  </div>
                )}

                <div
                  style={{
                    maxHeight: isMobile ? 280 : 360,
                    overflow: "auto",
                    borderRadius: T.r,
                    border: `1px solid ${T.bdr}`,
                    marginBottom: 16,
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: T.card2, position: "sticky", top: 0 }}>
                        <th style={{ textAlign: "left", padding: "8px 10px", color: T.sub }}>#</th>
                        <th style={{ textAlign: "left", padding: "8px 6px", color: T.sub }}>Status</th>
                        <th style={{ textAlign: "right", padding: "8px 6px", color: T.sub }}>Amount</th>
                        <th style={{ textAlign: "left", padding: "8px 6px", color: T.sub }}>Date</th>
                        <th style={{ textAlign: "left", padding: "8px 6px", color: T.sub }}>Category</th>
                        <th style={{ textAlign: "center", padding: "8px 10px", color: T.sub }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {importBundle.rows.map((r, idx) => {
                        const isEditing = editingImportIdx === idx;
                        if (isEditing && editImportDraft) {
                          const cats = (catalogRef.current.categories || []).map((c) => c.n).filter(Boolean);
                          const pays = (catalogRef.current.payments || []).filter(Boolean);
                          const cellInput = { background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 4, color: T.txt, padding: "4px 6px", fontSize: 16, width: "100%" };
                          return (
                            <tr key={r.line} style={{ borderTop: `1px solid ${T.acc}`, background: T.adim }}>
                              <td style={{ padding: "8px 10px", color: T.mut }}>{r.line}</td>
                              <td style={{ padding: "6px" }} colSpan={1}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editImportDraft.amount}
                                  onChange={(e) => setEditImportDraft((d) => ({ ...d, amount: e.target.value }))}
                                  style={{ ...cellInput, width: 70, textAlign: "right" }}
                                  placeholder="0.00"
                                />
                              </td>
                              <td style={{ padding: "6px" }}>
                                <input
                                  type="date"
                                  value={editImportDraft.date}
                                  onChange={(e) => setEditImportDraft((d) => ({ ...d, date: e.target.value }))}
                                  style={{ ...cellInput, width: 120 }}
                                />
                              </td>
                              <td style={{ padding: "6px" }}>
                                <select
                                  value={editImportDraft.category}
                                  onChange={(e) => setEditImportDraft((d) => ({ ...d, category: e.target.value }))}
                                  style={{ ...cellInput, width: 100 }}
                                >
                                  <option value="">—</option>
                                  {cats.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: "6px" }}>
                                <select
                                  value={editImportDraft.payment}
                                  onChange={(e) => setEditImportDraft((d) => ({ ...d, payment: e.target.value }))}
                                  style={{ ...cellInput, width: 80 }}
                                >
                                  {pays.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: "6px", whiteSpace: "nowrap", textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={saveEditImportRow}
                                  style={{ background: T.acc, color: T.btnTxt, border: "none", borderRadius: 4, padding: "4px 8px", fontWeight: 700, fontSize: 11, cursor: "pointer", marginRight: 4 }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditImportRow}
                                  style={{ background: "transparent", color: T.sub, border: `1px solid ${T.bdr}`, borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={r.line} style={{ borderTop: `1px solid ${T.bdr}` }}>
                            <td style={{ padding: "8px 10px", color: T.mut }}>{r.line}</td>
                            <td
                              title={!r.ok && r.error ? r.error : undefined}
                              style={{
                                padding: "8px 6px",
                                color: r.ok ? T.acc : T.dng,
                                maxWidth: 130,
                                fontSize: r.ok ? 12 : 11,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r.ok ? "✓" : r.error}
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>{r.ok ? formatMoney(r.amount) : "—"}</td>
                            <td style={{ padding: "8px 6px", color: T.sub }}>{r.date}</td>
                            <td style={{ padding: "8px 6px" }}>{r.category || "—"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => startEditImportRow(idx)}
                                style={{ background: "transparent", color: T.blue, border: "none", cursor: "pointer", fontSize: 12, padding: "2px 6px", textDecoration: "underline" }}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  disabled={importSaving || importBundle.rows.every((r) => !r.ok)}
                  onClick={() => void saveImportedRows()}
                  style={{
                    width: "100%",
                    padding: "16px 18px",
                    borderRadius: T.rLg,
                    background: importSaving || importBundle.rows.every((r) => !r.ok) ? T.mut : T.acc,
                    border: "none",
                    color: T.btnTxt,
                    fontSize: 17,
                    fontWeight: 800,
                    cursor: importSaving ? "not-allowed" : "pointer",
                    minHeight: 52,
                  }}
                >
                  {importSaving ? "Saving…" : `Add ${importBundle.rows.filter((r) => r.ok).length} expenses`}
                </button>
                <ExternalLlmCsvPromptPanel
                  prompt={externalLlmImagePrompt}
                  onCopy={copyExternalLlmImagePrompt}
                  disabled={importSaving}
                  blurb="For your next receipt or screenshot: use any external AI with this same prompt, then paste the CSV into Add → OCR → CSV or save as a file for import. Works across vendors because it asks for raw CSV (or one JSON object) with your catalog names baked in."
                />
              </div>
            )}

            {step === "success" && (
              <div style={{ padding: `70px ${px}px`, textAlign: "center" }}>
                <div
                  className="pop"
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: "50%",
                    background: T.adim,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 18px",
                    border: `2px solid ${T.acc}`,
                  }}
                >
                  <Check size={38} color={T.acc} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
                  {bulkSuccess ? `Imported ${bulkSuccess.count} expenses!` : "Expense Added!"}
                </div>
                <div style={{ fontSize: 13, color: T.sub }}>Redirecting to home…</div>
              </div>
            )}

            {step === "form" && (
              <div
                style={{
                  padding: `0 ${px}px`,
                  paddingBottom: `max(28px, calc(16px + env(safe-area-inset-bottom, 0px)))`,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                {previewImg && (
                  <div style={{ marginBottom: 14, borderRadius: T.r, overflow: "hidden", position: "relative" }}>
                    <img src={previewImg} alt="receipt" style={{ width: "100%", maxHeight: 150, objectFit: "cover" }} />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "8px 12px",
                        background: T.id === "light" ? "linear-gradient(transparent,rgba(0,0,0,0.45))" : "linear-gradient(transparent,rgba(0,0,0,0.75))",
                        fontSize: 12,
                        color: T.acc,
                      }}
                    >
                      {scanFillPrompt || scanMissingFieldKeys.length
                        ? "AI prefilled what it could — complete the missing fields below, then save."
                        : "✓ AI filled the form — edit anything, then confirm below"}
                    </div>
                  </div>
                )}

                {scanFillPrompt ? (
                  <div
                    style={{
                      background: T.wdim,
                      border: "1px solid " + T.warn + "59",
                      borderRadius: T.r,
                      padding: "10px 14px",
                      marginBottom: 14,
                      fontSize: 13,
                      color: T.warn,
                      lineHeight: 1.45,
                    }}
                  >
                    {scanFillPrompt}
                  </div>
                ) : null}

                {scanLineItems && scanLineItems.length > 0 && (
                  <details
                    style={{
                      ...card2,
                      marginBottom: 14,
                      fontSize: 12,
                      color: T.sub,
                    }}
                  >
                    <summary style={{ cursor: "pointer", fontWeight: 600, color: T.txt }}>
                      Detected line items ({scanLineItems.length})
                    </summary>
                    <ul style={{ margin: "10px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
                      {scanLineItems.map((row, i) => {
                        const name =
                          (row && typeof row === "object" && (row.name ?? row.item ?? row.description)) || "Item";
                        const raw = row && typeof row === "object" ? row.amount ?? row.price ?? row.total : "";
                        const a = raw !== "" && raw != null ? parseFloat(String(raw).replace(/[^\d.-]/g, "")) : NaN;
                        return (
                          <li key={i}>
                            {String(name)}
                            {Number.isFinite(a) ? ` — ${formatMoney(a)}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}

                {scanErr && (
                  <div
                    style={{
                      background: T.ddim,
                      border: "1px solid ${T.dng}59",
                      borderRadius: T.r,
                      padding: "10px 14px",
                      marginBottom: 14,
                      fontSize: 13,
                      color: T.dng,
                      lineHeight: 1.45,
                    }}
                  >
                    {scanErr}
                  </div>
                )}

                <div style={{ marginBottom: 18 }}>
                  <label style={lbl}>
                    Amount <span style={{ color: T.dng }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.sub, fontWeight: 700, fontSize: 18 }}>₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      enterKeyHint="next"
                      placeholder="0"
                      value={form.amount}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      style={{ ...inp, paddingLeft: 34, fontSize: 22, fontWeight: 800, minHeight: 52 }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={lbl}>
                    Category <span style={{ color: T.dng }}>*</span>
                  </label>
                  <div style={{ fontSize: 11, color: T.sub, marginBottom: 10, lineHeight: 1.35 }}>Tap a chip to choose (required before save).</div>
                  {fbStatus === "loading" && categories.length === 0 && (
                    <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Loading catalog…</div>
                  )}
                  {catalog.categories.length === 0 && categories.length > 0 && fbStatus === "ready" && (
                    <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>
                      Optional: add document <code style={{ color: T.sub }}>config/app</code> in Firestore to customize categories and payments.
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 10 }}>
                    {categories.map((c) => (
                      <button
                        type="button"
                        key={c.n}
                        onClick={() => setForm((p) => ({ ...p, category: c.n }))}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: isMobile ? "8px 12px" : "6px 11px",
                          borderRadius: 999,
                          border: form.category === c.n ? `2px solid ${c.c}` : `1px solid ${T.bdr}`,
                          background: form.category === c.n ? c.bg : "transparent",
                          color: form.category === c.n ? c.c : T.sub,
                          fontSize: 13,
                          fontWeight: form.category === c.n ? 700 : 500,
                          cursor: "pointer",
                          transition: "all .15s",
                          minHeight: 40,
                        }}
                      >
                        <CategoryIcon name={c.n} size={14} color={c.c} /> {c.n}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: twoCol ? "grid" : "flex",
                    gridTemplateColumns: twoCol ? "1fr 1fr" : undefined,
                    flexDirection: twoCol ? undefined : "column",
                    gap: twoCol ? 12 : 16,
                    marginBottom: 18,
                    width: "100%",
                  }}
                >
                  <div style={{ minWidth: 0, width: "100%" }}>
                    <label style={lbl}>
                      Date <span style={{ color: T.dng }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                      style={{
                        ...inp,
                        width: "100%",
                        minWidth: 0,
                        minHeight: 48,
                        fontSize: 16,
                        WebkitAppearance: "none",
                        appearance: "none",
                      }}
                    />
                  </div>
                  <div style={{ minWidth: 0, width: "100%" }}>
                    <label style={lbl}>
                      Payment <span style={{ color: T.dng }}>*</span>
                    </label>
                    <select
                      value={form.payment}
                      onChange={(e) => setForm((p) => ({ ...p, payment: e.target.value }))}
                      style={{
                        ...inp,
                        width: "100%",
                        minWidth: 0,
                        minHeight: 48,
                        fontSize: 16,
                      }}
                    >
                      {payments.map((pay) => (
                        <option key={pay}>{pay}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={lbl}>Notes</label>
                  <textarea
                    placeholder="What was this for?"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    style={{
                      ...inp,
                      resize: "vertical",
                      minHeight: 88,
                      lineHeight: 1.45,
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={lbl}>Tags (comma separated)</label>
                  <input
                    placeholder="work, personal, urgent"
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    style={{ ...inp, minHeight: 48, fontSize: 16 }}
                  />
                </div>

                <div style={{ ...card, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: splitOn ? 14 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Users size={15} color={splitOn ? T.acc : T.sub} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Split Expense</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSplitOn((p) => !p)}
                      style={{
                        width: 46,
                        height: 26,
                        borderRadius: 999,
                        border: "none",
                        cursor: "pointer",
                        background: splitOn ? T.acc : T.mut,
                        position: "relative",
                        transition: "background .2s",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: 3,
                          left: splitOn ? 23 : 3,
                          transition: "left .2s",
                        }}
                      />
                    </button>
                  </div>
                  {splitOn && (
                    <>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        {["equal", "custom"].map((t) => (
                          <button type="button" key={t} onClick={() => setSplitType(t)} style={{ ...pill(splitType === t), flex: 1 }}>
                            {t === "equal" ? "Equal Split" : "Custom Amount"}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Select people to split with:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {people.map((p) => {
                          const pn = normalizePerson(p);
                          const label = pn.n;
                          const sel = splitPpl.find((sp) => sp.n === label);
                          return (
                            <button
                              type="button"
                              key={personStableKey(pn)}
                              onClick={() => toggleSplitPerson(label)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 999,
                                border: sel ? `2px solid ${T.acc}` : `1px solid ${T.bdr}`,
                                background: sel ? T.adim : "transparent",
                                color: sel ? T.acc : T.sub,
                                fontSize: 12,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              👤 {label}
                              {sel && splitType === "equal" && <span style={{ fontWeight: 700 }}> {formatMoney(sel.a)}</span>}
                            </button>
                          );
                        })}
                      </div>
                      {splitType === "custom" && splitPpl.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          {splitPpl.map((p, i) => (
                            <div key={p.n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <span style={{ fontSize: 12, color: T.sub, width: 60 }}>👤 {p.n}</span>
                              <input
                                type="number"
                                placeholder="₹ amount"
                                value={p.a}
                                onChange={(e) => setSplitPpl((prev) => prev.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                                style={{ ...inp, flex: 1, padding: "8px 10px" }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {fErr && (
                  <div style={{ background: T.ddim, border: "1px solid ${T.dng}59", borderRadius: T.r, padding: "12px 14px", marginBottom: 18, fontSize: 13, color: T.dng, lineHeight: 1.45 }}>
                    {fErr}
                  </div>
                )}

                <button
                  type="button"
                  disabled={savingExpense}
                  onClick={() => void submitForm()}
                  style={{
                    width: "100%",
                    padding: "16px 18px",
                    borderRadius: T.rLg,
                    background: savingExpense ? T.mut : T.acc,
                    border: "none",
                    color: T.btnTxt,
                    fontSize: 17,
                    fontWeight: 800,
                    cursor: savingExpense ? "not-allowed" : "pointer",
                    marginBottom: 8,
                    opacity: savingExpense ? 0.85 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    minHeight: 52,
                  }}
                >
                  {savingExpense ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      Saving…
                    </>
                  ) : previewImg ? (
                    "Confirm & save expense"
                  ) : (
                    "Add Expense"
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "analytics" && fbStatus === "loading" && txs.length === 0 && (
          <AnalyticsSkeleton px={px} />
        )}
        {tab === "analytics" && !(fbStatus === "loading" && txs.length === 0) && (
          <div className="tab-content">
            <div style={{ padding: `${px + 8}px ${px}px ${px}px` }}>
              <div style={{ fontSize: comfortable ? 24 : 20, fontWeight: 800, marginBottom: 14 }}>Analytics</div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {[
                  ["today", "Today"],
                  ["week", "Week"],
                  ["month", "Month"],
                  ["custom", "Custom"],
                ].map(([f, l]) => (
                  <button type="button" key={f} onClick={() => setDf(f)} style={{ ...pill(df === f), flexShrink: 0 }}>
                    {l}
                  </button>
                ))}
              </div>
              {df === "custom" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: T.r,
                    border: `1px solid ${T.bdr}`,
                    background: T.card2,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.sub, marginBottom: 12 }}>Date range</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      alignItems: "stretch",
                    }}
                  >
                    {[
                      { label: "From", value: cS, set: setCS },
                      { label: "To", value: cE, set: setCE },
                    ].map(({ label, value, set }) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                        <label style={{ ...lbl, marginBottom: 0 }}>{label}</label>
                        <input
                          type="date"
                          value={value}
                          onChange={(e) => set(e.target.value)}
                          style={{
                            ...inp,
                            width: "100%",
                            minWidth: 0,
                            minHeight: 48,
                            height: 48,
                            fontSize: 16,
                            lineHeight: 1.25,
                            display: "block",
                            flexShrink: 0,
                            WebkitAppearance: "none",
                            appearance: "none",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ margin: `0 ${px}px 14px`, ...card }}>
              <div style={{ fontSize: 12, color: T.sub, marginBottom: 4 }}>Total Spent</div>
              <div style={{ fontSize: 34, fontWeight: 800 }}>{formatMoney(fTotal)}</div>
              <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>{filtered.length} transactions</div>
            </div>

            {twoCol && breakdown.length > 0 ? (
              <div
                style={{
                  margin: `0 ${px}px 14px`,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  alignItems: "stretch",
                }}
              >
                <div style={{ ...card, margin: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Category Breakdown</div>
                  <ResponsiveContainer width="100%" height={chart.pie}>
                    <PieChart>
                      <Pie
                        data={breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={twoCol ? 40 : 52}
                        outerRadius={twoCol ? 68 : 82}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {breakdown.map((e, i) => (
                          <Cell key={i} fill={e.c} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [formatMoney(v)]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, maxHeight: 140, overflowY: "auto" }}>
                    {breakdown.slice(0, 7).map((b, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: b.c, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                            <CategoryIcon name={b.name} size={12} color={b.c} /> {b.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: T.sub }}>{Math.round((b.value / fTotal) * 100)}%</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(b.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ ...card, margin: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Daily Spending (14 days)</div>
                  <ResponsiveContainer width="100%" height={chart.area}>
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={T.acc} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={T.acc} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: T.sub }} tickLine={false} axisLine={false} interval={3} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => [formatMoney(v), "Spent"]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }} />
                      <Area type="monotone" dataKey="amount" stroke={T.acc} strokeWidth={2} fill="url(#ag)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <>
                {breakdown.length > 0 && (
                  <div style={{ margin: `0 ${px}px 14px`, ...card }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Category Breakdown</div>
                    <ResponsiveContainer width="100%" height={chart.pie}>
                      <PieChart>
                        <Pie data={breakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                          {breakdown.map((e, i) => (
                            <Cell key={i} fill={e.c} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [formatMoney(v)]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                      {breakdown.slice(0, 7).map((b, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: b.c, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                              <CategoryIcon name={b.name} size={13} color={b.c} /> {b.name}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: T.sub }}>{Math.round((b.value / fTotal) * 100)}%</span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(b.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ margin: `0 ${px}px 14px`, ...card }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Daily Spending (14 days)</div>
                  <ResponsiveContainer width="100%" height={chart.area}>
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={T.acc} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={T.acc} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.sub }} tickLine={false} axisLine={false} interval={3} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => [formatMoney(v), "Spent"]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }} />
                      <Area type="monotone" dataKey="amount" stroke={T.acc} strokeWidth={2} fill="url(#ag2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {breakdown.length > 0 && (
              <div style={{ margin: `0 ${px}px 14px`, ...card }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Top Spending Categories</div>
                <ResponsiveContainer width="100%" height={chart.bar}>
                  <BarChart data={breakdown.slice(0, 6)} layout="vertical" margin={{ left: 4, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: T.sub }} tickLine={false} axisLine={false} width={95} />
                    <Tooltip formatter={(v) => [formatMoney(v)]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {breakdown.slice(0, 6).map((e, i) => (
                        <Cell key={i} fill={e.c} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {paymentBreakdown.length > 0 && (
              <div style={{ margin: `0 ${px}px 14px`, ...card }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Payment Methods</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3} dataKey="value" stroke="none">
                        {paymentBreakdown.map((e, i) => (
                          <Cell key={i} fill={e.c} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {paymentBreakdown.map((b, i) => (
                      <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: b.c, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{formatMoney(b.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════ SPLITS ANALYTICS ═══════════════════ */}
            {splitAnalytics.splitCount > 0 && (
              <>
                <div style={{ margin: `20px ${px}px 10px`, display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={16} color={T.acc} />
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Splits</div>
                  <div style={{ fontSize: 11, color: T.sub }}>
                    {splitAnalytics.splitCount} {splitAnalytics.splitCount === 1 ? "bill" : "bills"} · {formatMoney(splitAnalytics.splitTotalValue)} total
                  </div>
                </div>

                {/* Stat row: who owes whom + net position */}
                <div style={{
                  margin: `0 ${px}px 14px`,
                  display: "grid",
                  gridTemplateColumns: twoCol ? "repeat(4, 1fr)" : "1fr 1fr",
                  gap: 10,
                }}>
                  <div style={{ ...card, margin: 0, borderLeft: `3px solid ${T.grn || "#22c55e"}` }}>
                    <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>Owed to you</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.grn || "#22c55e" }}>
                      {formatMoney(splitAnalytics.outstandingToYou)}
                    </div>
                    {splitAnalytics.settledToYou > 0 ? (
                      <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>
                        Recovered {formatMoney(splitAnalytics.settledToYou)}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ ...card, margin: 0, borderLeft: `3px solid ${T.dng}` }}>
                    <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>You owe</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.dng }}>
                      {formatMoney(splitAnalytics.outstandingFromYou)}
                    </div>
                    {splitAnalytics.settledFromYou > 0 ? (
                      <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>
                        Paid back {formatMoney(splitAnalytics.settledFromYou)}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ ...card, margin: 0, borderLeft: `3px solid ${splitAnalytics.netPosition >= 0 ? T.grn || "#22c55e" : T.warn}` }}>
                    <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>Net position</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: splitAnalytics.netPosition >= 0 ? T.grn || "#22c55e" : T.warn }}>
                      {splitAnalytics.netPosition >= 0 ? "+" : ""}{formatMoney(splitAnalytics.netPosition)}
                    </div>
                    <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>
                      {splitAnalytics.netPosition >= 0 ? "In your favour" : "You're behind"}
                    </div>
                  </div>
                  <div style={{ ...card, margin: 0, borderLeft: `3px solid ${T.acc}` }}>
                    <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>Active peers</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.acc }}>
                      {splitAnalytics.peers.length}
                    </div>
                    <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>
                      {splitAnalytics.peers.filter((p) => Math.abs(p.net) > 0.005).length} with balance
                    </div>
                  </div>
                </div>

                {/* Two-up: split by friend + split by category */}
                {(splitAnalytics.byFriend.length > 0 || splitAnalytics.byCategory.length > 0) && (
                  <div style={{
                    margin: `0 ${px}px 14px`,
                    display: "grid",
                    gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr",
                    gap: 14,
                  }}>
                    {splitAnalytics.byFriend.length > 0 && (
                      <div style={{ ...card, margin: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Split by Friend</div>
                        <ResponsiveContainer width="100%" height={chart.pie}>
                          <PieChart>
                            <Pie
                              data={splitAnalytics.byFriend}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {splitAnalytics.byFriend.map((e, i) => (
                                <Cell key={i} fill={e.c} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => [formatMoney(v)]}
                              contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, maxHeight: 140, overflowY: "auto" }}>
                          {splitAnalytics.byFriend.slice(0, 8).map((b, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: b.c, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{formatMoney(b.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {splitAnalytics.byCategory.length > 0 && (
                      <div style={{ ...card, margin: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Split by Category</div>
                        <ResponsiveContainer width="100%" height={chart.pie}>
                          <PieChart>
                            <Pie
                              data={splitAnalytics.byCategory}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {splitAnalytics.byCategory.map((e, i) => (
                                <Cell key={i} fill={e.c} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => [formatMoney(v)]}
                              contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, maxHeight: 140, overflowY: "auto" }}>
                          {splitAnalytics.byCategory.slice(0, 8).map((b, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: b.c, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  <CategoryIcon name={b.name} size={12} color={b.c} /> {b.name}
                                </span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{formatMoney(b.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-peer balances */}
                {splitAnalytics.peers.length > 0 && (
                  <div style={{ margin: `0 ${px}px 14px`, ...card }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Balances by Peer</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {splitAnalytics.peers.slice(0, 10).map((p) => {
                        const net = p.net;
                        const color = Math.abs(net) < 0.005 ? T.sub : net > 0 ? (T.grn || "#22c55e") : T.dng;
                        const label = Math.abs(net) < 0.005 ? "settled" : net > 0 ? "owes you" : "you owe";
                        return (
                          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.bdr}` }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Users size={15} color={T.sub} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>
                                {p.splitCount} {p.splitCount === 1 ? "bill" : "bills"}
                                {p.settledByThem > 0 ? <> · received {formatMoney(p.settledByThem)}</> : null}
                                {p.settledByYou > 0 ? <> · paid {formatMoney(p.settledByYou)}</> : null}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color }}>
                                {net > 0 ? "+" : net < 0 ? "-" : ""}{formatMoney(Math.abs(net))}
                              </div>
                              <div style={{ fontSize: 10, color: T.sub, marginTop: 1 }}>{label}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("reports")}
                      style={{
                        marginTop: 10, width: "100%", padding: 10, borderRadius: 10,
                        border: `1px solid ${T.purp}`, background: T.pdim, color: T.purp,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      <Sparkles size={13} /> Use in AI Report
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        )}

        {/* ═══════════════════ REPORTS TAB ═══════════════════ */}
        {tab === "reports" && (
          <div className="tab-content">
            <div style={{ padding: `${px + 8}px ${px}px 0` }}>
              <div style={{ fontSize: comfortable ? 24 : 20, fontWeight: 800, marginBottom: 12 }}>AI Reports</div>
              <div style={{ display: "flex", gap: 4, background: T.card2, borderRadius: 12, padding: 4, marginBottom: 14 }}>
                {[
                  { id: "spending", label: "Spending Report", Icon: BarChart2 },
                  { id: "insights", label: "AI Insights", Icon: Sparkles },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setReportSubTab(st.id)}
                    style={{
                      flex: 1,
                      padding: "10px 8px",
                      borderRadius: 10,
                      border: "none",
                      background: reportSubTab === st.id ? T.card : "transparent",
                      color: reportSubTab === st.id ? T.txt : T.sub,
                      fontSize: 13,
                      fontWeight: reportSubTab === st.id ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all .15s",
                    }}
                  >
                    <st.Icon size={14} color={reportSubTab === st.id ? (st.id === "insights" ? T.purp : T.acc) : T.sub} />
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {reportSubTab === "spending" && (
              <SpendingReport
                txs={txs}
                categories={categories}
                formatMoney={formatMoney}
                currencyCode={currencyCode}
                budgets={budgets}
                catSpent={catSpent}
                fixedTotal={fixedTotal}
                monthlyBudgetTotal={monthlyBudgetTotal}
                uid={uidRef.current}
                reportFreq={reportFreq}
                px={px}
                splitAnalytics={splitAnalytics}
              />
            )}

            {reportSubTab === "insights" && (
              <div style={{ padding: `0 ${px}px 16px` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: T.sub }}>
                    {tips.length > 0 ? <><strong style={{ color: T.txt }}>{tips.length}</strong> personalised tips</> : "Get AI-powered spending advice"}
                  </div>
                  <button
                    type="button"
                    onClick={genTips}
                    disabled={ldTips}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: `1px solid ${T.purp}`,
                      background: T.pdim,
                      color: T.purp,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {ldTips ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                    {ldTips ? "Analyzing…" : "Generate Tips"}
                  </button>
                </div>

                {tips.length > 0 ? (
                  tips.map((tip, i) => (
                    <div key={i} style={{ ...card, marginBottom: 10, borderLeft: `3px solid ${tip.priority === "high" ? T.dng : tip.priority === "medium" ? T.warn : T.acc}` }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 26 }}>{tip.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{tip.title}</div>
                          <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>{tip.desc}</div>
                          <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, background: T.adim, color: T.acc, borderRadius: 6, padding: "2px 8px" }}>Save {tip.saving}</span>
                            <span
                              style={{
                                fontSize: 11,
                                borderRadius: 6,
                                padding: "2px 8px",
                                background: tip.priority === "high" ? T.ddim : tip.priority === "medium" ? T.wdim : T.adim,
                                color: tip.priority === "high" ? T.dng : tip.priority === "medium" ? T.warn : T.acc,
                              }}
                            >
                              {tip.priority} priority
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ ...card, textAlign: "center", padding: 32 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: T.pdim, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                      <BrainCircuit size={24} color={T.purp} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>AI-Powered Expense Advisor</div>
                    <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
                      {`Tap "Generate Tips" to get personalised tips based on your actual spending patterns`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "budgets" && fbStatus === "loading" && txs.length === 0 && (
          <BudgetsSkeleton px={px} />
        )}
        {tab === "budgets" && !(fbStatus === "loading" && txs.length === 0) && (
          <div className="tab-content">
            {/* ─── Header + Sub-tabs ─── */}
            <div style={{ padding: `${px + 8}px ${px}px 0` }}>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Budgets</div>
              <div style={{ display: "flex", gap: 0, marginBottom: 14, background: T.card2, borderRadius: 12, padding: 3 }}>
                {[
                  { id: "budgets", label: "Category Budgets", Icon: Target },
                  { id: "fixed", label: "Fixed Expenses", Icon: Lock },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setBudgetSubTab(st.id)}
                    style={{
                      flex: 1,
                      padding: "10px 8px",
                      borderRadius: 10,
                      border: "none",
                      background: budgetSubTab === st.id ? T.card : "transparent",
                      color: budgetSubTab === st.id ? T.txt : T.sub,
                      fontSize: 13,
                      fontWeight: budgetSubTab === st.id ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all .15s",
                    }}
                  >
                    <st.Icon size={14} color={budgetSubTab === st.id ? (st.id === "fixed" ? T.purp : T.acc) : T.sub} />
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Unified summary card ─── */}
            <div
              style={{
                margin: `0 ${px}px 14px`,
                background: T.heroGrad,
                borderRadius: T.rLg,
                padding: 20,
                border: `1px solid ${T.bdr}`,
              }}
            >
              {monthlyBudgetTotal != null && monthlyBudgetTotal > 0 ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: T.sub, marginBottom: 2 }}>Monthly cap</div>
                      <div style={{ fontSize: 26, fontWeight: 800 }}>{formatMoney(monthlyBudgetTotal)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => { setBmCat(MONTH_TOTAL_BUDGET_KEY); setBmAmt(String(monthlyBudgetTotal)); setShowBM(true); }} style={{ background: T.card2, border: `1px solid ${T.bdr}`, color: T.txt, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                      <button type="button" onClick={() => void removeMonthlyBudgetTotal()} style={{ background: "none", border: "none", color: T.dng, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "6px 2px" }}>Remove</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 70 }}>
                      <div style={{ fontSize: 11, color: T.sub }}>Spent</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: monthTotal > monthlyBudgetTotal ? T.dng : T.txt }}>{formatMoney(monthTotal)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 70 }}>
                      <div style={{ fontSize: 11, color: T.sub }}>Fixed</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.purp }}>{formatMoney(fixedTotal)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 70 }}>
                      <div style={{ fontSize: 11, color: T.sub }}>Flexible</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: monthlyBudgetTotal - fixedTotal > 0 ? T.acc : T.dng }}>{formatMoney(Math.max(0, monthlyBudgetTotal - fixedTotal))}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 70 }}>
                      <div style={{ fontSize: 11, color: T.sub }}>Left</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: monthlyBudgetTotal - monthTotal > 0 ? T.acc : T.dng }}>{formatMoney(Math.max(0, monthlyBudgetTotal - monthTotal))}</div>
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { setBmCat(MONTH_TOTAL_BUDGET_KEY); setBmAmt(""); setShowBM(true); }}
                  style={{ width: "100%", textAlign: "left", padding: 0, background: "none", border: "none", color: T.txt, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                >
                  <Target size={20} color={T.acc} />
                  <span>+ Set overall monthly cap</span>
                  <span style={{ fontSize: 12, color: T.sub, marginLeft: "auto" }}>Appears on Home</span>
                </button>
              )}
            </div>

            {/* ─── BUDGETS sub-tab ─── */}
            {budgetSubTab === "budgets" && (
              <div style={{ padding: `0 ${px}px` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: T.sub }}>
                    {Object.keys(budgets).length > 0 ? (
                      <><strong style={{ color: T.txt }}>{Object.keys(budgets).length}</strong> category limits set</>
                    ) : "No per-category limits yet"}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {Object.keys(budgets).length > 0 && (
                      <button type="button" onClick={() => void clearAllBudgets()} disabled={fbStatus !== "ready"} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.dng}66`, background: T.ddim, color: T.dng, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        <Trash2 size={12} /> Clear
                      </button>
                    )}
                    <button type="button" onClick={() => { setBmCat(""); setBmAmt(""); setShowBM(true); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, background: T.acc, border: "none", color: T.btnTxt, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      + Add
                    </button>
                  </div>
                </div>

                {budgetEntriesSorted.map(([cat, limit]) => (
                  <div key={cat} style={{ ...card, marginBottom: 10 }}>
                    <BudgetBar cat={cat} limit={limit} spent={catSpent[cat] || 0} categories={categories} formatMoney={formatMoney} />
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 4 }}>
                      <button type="button" onClick={() => { setBmCat(cat); setBmAmt(String(limit)); setShowBM(true); }} style={{ background: "none", border: "none", color: T.sub, fontSize: 12, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                        <Pencil size={11} /> Edit
                      </button>
                      <button type="button" onClick={() => void removeBudgetCategory(cat)} style={{ background: "none", border: "none", color: T.dng, fontSize: 12, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                        <Trash2 size={12} strokeWidth={2} /> Remove
                      </button>
                    </div>
                  </div>
                ))}

                {categories.filter((c) => !budgets[c.n]).length > 0 && (
                  <>
                    <div style={{ marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: 600, color: T.sub }}>No budget set</div>
                    {categories.filter((c) => !budgets[c.n]).map((c) => (
                      <div key={c.n} role="button" tabIndex={0} onClick={() => { setBmCat(c.n); setBmAmt(""); setShowBM(true); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setBmCat(c.n); setBmAmt(""); setShowBM(true); } }} style={{ ...card, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", opacity: 0.55 }}>
                        <CategoryIcon name={c.n} size={20} color={c.c} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{c.n}</span>
                        <div style={{ marginLeft: "auto", fontSize: 12, color: T.acc, border: `1px solid ${T.acc}`, borderRadius: 8, padding: "4px 10px" }}>+ Add</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ─── FIXED EXPENSES sub-tab ─── */}
            {budgetSubTab === "fixed" && (
              <div style={{ padding: `0 ${px}px` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: T.sub }}>
                    {fixedExpenses.length > 0 ? <><strong style={{ color: T.txt }}>{fixedExpenses.length}</strong> fixed expense{fixedExpenses.length !== 1 ? "s" : ""}</> : "No fixed expenses yet"}
                  </div>
                  <button type="button" onClick={() => { setFixedDraft({ name: "", amount: "", category: categories[0]?.n || "Bills", dueDay: "1" }); setShowFixedModal(true); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, background: T.purp, border: "none", color: T.btnTxt, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    + Add
                  </button>
                </div>

                {fixedExpenses.length > 0 && monthlyBudgetTotal > 0 && (
                  <div style={{ ...card, marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
                    <ResponsiveContainer width={100} height={100}>
                      <PieChart>
                        <Pie data={[{ name: "Fixed", value: fixedTotal }, { name: "Flexible", value: Math.max(0, monthlyBudgetTotal - fixedTotal) }]} cx="50%" cy="50%" innerRadius={28} outerRadius={44} paddingAngle={4} dataKey="value" stroke="none">
                          <Cell fill={T.purp} />
                          <Cell fill={T.acc} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: T.purp }} />
                        <span style={{ fontSize: 13 }}>Fixed: <strong>{formatMoney(fixedTotal)}</strong></span>
                        <span style={{ fontSize: 11, color: T.sub }}>{Math.round((fixedTotal / monthlyBudgetTotal) * 100)}%</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: T.acc }} />
                        <span style={{ fontSize: 13 }}>Flexible: <strong>{formatMoney(Math.max(0, monthlyBudgetTotal - fixedTotal))}</strong></span>
                        <span style={{ fontSize: 11, color: T.sub }}>{Math.round(((monthlyBudgetTotal - fixedTotal) / monthlyBudgetTotal) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {fixedExpenses.map((fe) => (
                  <div key={fe.name} style={{ ...card, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                    <CategoryIcon name={fe.category} size={20} color={T.purp} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fe.name}</div>
                      <div style={{ fontSize: 11, color: T.sub }}>Due day {fe.dueDay || 1} · {fe.category}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{formatMoney(fe.amount)}</div>
                    <button type="button" onClick={() => { setFixedDraft({ name: fe.name, amount: String(fe.amount), category: fe.category, dueDay: String(fe.dueDay || 1) }); setShowFixedModal(true); }} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 4 }}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => void removeFixedExpense(fe.name)} style={{ background: "none", border: "none", color: T.dng, cursor: "pointer", padding: 4, opacity: 0.7 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {fixedExpenses.length === 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: T.sub, marginBottom: 10 }}>Quick-add common expenses:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {FIXED_EXPENSE_TEMPLATES.slice(0, 8).map((t) => (
                        <button key={t.name} type="button" onClick={() => { setFixedDraft({ name: t.name, amount: "", category: t.category, dueDay: "1" }); setShowFixedModal(true); }} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.bdr}`, background: T.card2, color: T.txt, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                          <CategoryIcon name={t.category} size={12} color={T.purp} /> {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {tab === "profile" && (
          <div className="tab-content" style={{ padding: `${px + 8}px ${px}px 120px` }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>Profile & Settings</div>
            {/* Silently request notification permission when user opens Profile — needed for split alerts */}
            {typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && (() => { void Notification.requestPermission(); return null; })()}

            {/* ─── Profile Card ─── */}
            <div style={{ ...card, marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: `linear-gradient(135deg,${T.acc},${T.blue})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 800, color: T.btnTxt, flexShrink: 0,
                }}
              >
                {(profileName && profileName.trim()[0]) || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{profileName.trim() || "—"}</div>
                {profileEmail.trim() ? <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{profileEmail.trim()}</div> : null}
                {firebaseUser?.email ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: T.mut, marginBottom: 4 }}>Sign-in ID</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <code style={{ flex: 1, fontSize: 11, color: T.sub, wordBreak: "break-all", lineHeight: 1.3 }}>{firebaseUser.email}</code>
                      <button type="button" onClick={() => { void navigator.clipboard.writeText(firebaseUser.email || "").then(() => { setSignInIdCopied(true); setTimeout(() => setSignInIdCopied(false), 2000); }); }} style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 8, border: `1px solid ${T.bdrH}`, background: T.surf, color: signInIdCopied ? T.acc : T.sub, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        <Copy size={12} /> {signInIdCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              {firebaseUser?.email ? (
                <button type="button" title="Show QR code" onClick={() => setShowProfileQr(true)} style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, border: `1px solid ${T.bdrH}`, background: T.card2, color: T.acc, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QrCode size={20} strokeWidth={2} />
                </button>
              ) : null}
            </div>

            {/* ─── Display Name ─── */}
            {firebaseUser?.email ? (
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: T.sub, marginBottom: 6, fontWeight: 600 }}>Display name</div>
                <div style={{ fontSize: 11, color: T.mut, lineHeight: 1.45, marginBottom: 10 }}>
                  The name friends see when you split expenses with them.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="e.g. Alex Johnson"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    style={{ ...inp, flex: 1 }}
                  />
                  <button
                    type="button"
                    disabled={!profileName.trim()}
                    onClick={async () => {
                      const name = profileName.trim();
                      if (!name) { dlg.toast("Name cannot be empty", { type: "warn" }); return; }
                      if (!uidRef.current) return;
                      try {
                        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { profileName: name }, { merge: true });
                        dlg.toast("Display name updated", { type: "success" });
                      } catch (err) {
                        console.error("Failed to save profile name", err);
                        dlg.toast("Couldn't save — check your connection", { type: "error" });
                      }
                    }}
                    style={{
                      padding: "0 16px", borderRadius: 10, border: "none",
                      background: profileName.trim() ? T.acc : T.card2,
                      color: profileName.trim() ? T.btnTxt : T.mut,
                      fontSize: 13, fontWeight: 700,
                      cursor: profileName.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : null}

            {/* ─── Stats Row ─── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { l: "Transactions", v: txs.length },
                { l: "Categories", v: new Set(txs.map((t) => t.category)).size },
                { l: "Budgets", v: Object.keys(budgets).length },
              ].map((s) => (
                <div key={s.l} style={{ background: T.card2, borderRadius: T.r, border: `1px solid ${T.bdr}`, textAlign: "center", padding: "12px 6px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* ─── Theme Picker ─── */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Palette size={16} color={T.purp} /> Theme
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                {Object.values(THEMES).map((theme) => {
                  const active = userTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => void saveTheme(theme.id)}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: active ? `2px solid ${T.acc}` : `1px solid ${T.bdr}`,
                        background: active ? T.adim : T.card2,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 6 }}>
                        {theme.preview.map((c, i) => (
                          <div key={i} style={{ width: 18, height: 18, borderRadius: 6, background: c, border: `1px solid ${c === "#FFFFFF" || c === "#F5F5F7" ? "#D4D6DD" : "transparent"}` }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? T.acc : T.txt }}>{theme.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Preferences ─── */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Preferences</div>
              {(() => {
                const activeCur = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
                const freqLabel = { daily: "Daily", weekly: "Weekly (Mon)", monthly: "Monthly (1st)" }[reportFreq] || "Weekly";
                const rows = [
                  {
                    Icon: RefreshCw, label: "Currency", sub: `${activeCur.name} · ${activeCur.symbol}`,
                    color: T.acc, onClick: () => setShowCurrencyPicker(true),
                    right: (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CurrencyFlag country={activeCur.country} code={activeCur.code} size={18} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>{activeCur.code}</span>
                        <ChevronRight size={16} color={T.mut} />
                      </div>
                    ),
                  },
                  {
                    Icon: FileText, label: "Report Frequency", sub: `Auto-generate: ${freqLabel}`, color: T.purp, onClick: null,
                    right: (
                      <select value={reportFreq} onChange={(e) => void saveReportFreq(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ background: T.card2, border: `1px solid ${T.bdr}`, color: T.txt, borderRadius: 8, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    ),
                  },
                  { Icon: Bell, label: "Notifications", sub: "Daily reminders & alerts", color: T.warn, onClick: null, right: null },
                ];
                return rows.map((item, i) => (
                  <div key={i} role={item.onClick ? "button" : undefined} tabIndex={item.onClick ? 0 : undefined} onClick={item.onClick || undefined} onKeyDown={item.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") item.onClick(); } : undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < rows.length - 1 ? `1px solid ${T.bdr}` : "none", cursor: item.onClick ? "pointer" : "default" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <item.Icon size={16} color={item.color} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: T.sub }}>{item.sub}</div>
                    </div>
                    {item.right || (item.onClick ? <ChevronRight size={16} color={T.mut} /> : null)}
                  </div>
                ));
              })()}
            </div>

            {/* ─── Split Contacts ─── */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
                <Users size={15} color={T.blue} /> Split Contacts
              </div>
              <div style={{ fontSize: 11, color: T.sub, lineHeight: 1.4, marginBottom: 10 }}>
                Add people you split bills with. Scan their QR to link accounts.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {people.map((p) => {
                  const pn = normalizePerson(p);
                  const looksLikeUuid = /^(u_[a-f0-9]{8,}|id-\d+)/i.test(pn.n);
                  return (
                    <div key={personStableKey(pn)} style={{ display: "flex", alignItems: "center", gap: 5, background: looksLikeUuid ? T.wdim : T.card2, borderRadius: 999, padding: "5px 10px", border: `1px solid ${looksLikeUuid ? T.warn + "44" : T.bdr}` }}>
                      <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Users size={10} color={T.sub} />
                        {looksLikeUuid ? "Unnamed friend" : pn.n}
                        {pn.u || pn.e ? <span style={{ fontSize: 9, color: T.acc, marginLeft: 3 }}>●</span> : null}
                      </span>
                      <button
                        type="button"
                        aria-label="Rename"
                        title="Rename contact"
                        onClick={async () => {
                          const ok = await dlg.confirm(
                            looksLikeUuid
                              ? "This contact has no real name — ask your friend to set their display name in Profile, then re-scan. Or enter a nickname to use locally."
                              : `Rename "${pn.n}" to a new nickname?`,
                            { title: "Rename contact", confirmLabel: "Rename", cancelLabel: "Cancel" }
                          );
                          if (!ok) return;
                          const next = window.prompt("New name", looksLikeUuid ? "" : pn.n);
                          const newName = (next || "").trim();
                          if (!newName) return;
                          const updated = people.map(normalizePerson).map((x) => sameSplitPerson(x, pn) ? { ...x, n: newName } : x);
                          void persistPeople(updated);
                          dlg.toast("Contact renamed", { type: "success" });
                        }}
                        style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}
                      >
                        <Pencil size={11} />
                      </button>
                      <button type="button" aria-label="Remove" onClick={() => void persistPeople(people.map(normalizePerson).filter((x) => !sameSplitPerson(x, pn)))} style={{ background: "none", border: "none", color: T.mut, cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}>
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  placeholder="Add person…"
                  value={newP}
                  onChange={(e) => setNewP(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newP.trim()) { void persistPeople([...people.map(normalizePerson), { n: newP.trim() }]); setNewP(""); } }}
                  style={{ ...inp, flex: 1, minWidth: 100, padding: "10px 12px", fontSize: 13 }}
                />
                <button type="button" onClick={() => { if (!newP.trim()) return; void persistPeople([...people.map(normalizePerson), { n: newP.trim() }]); setNewP(""); }} style={{ padding: "0 14px", borderRadius: T.r, background: T.acc, border: "none", color: T.btnTxt, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Add
                </button>
                <button type="button" onClick={() => setShowSplitScan(true)} style={{ padding: "0 10px", borderRadius: T.r, border: `1px solid ${T.acc}`, background: T.adim, color: T.acc, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <ScanLine size={14} /> Scan
                </button>
              </div>
            </div>

            {/* ─── Users on this device ─── */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Users on this device</div>
              <div style={{ fontSize: 11, color: T.sub, marginBottom: 10, lineHeight: 1.4 }}>
                Switch between saved accounts. Use Sign-in ID to log in on another device.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deviceProfiles.map((p) => {
                  const isCurrent = p.email === firebaseUser?.email;
                  const pinLabel = p.pin && isValidPin(p.pin) ? "••••" : "No PIN";
                  return (
                    <div key={p.email} style={{ padding: 10, borderRadius: T.r, border: `1px solid ${isCurrent ? T.acc : T.bdr}`, background: isCurrent ? T.adim : T.card2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{profileDisplayName(p)}</div>
                        <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>PIN: {pinLabel} {isCurrent ? "· Active" : ""}</div>
                      </div>
                      {!isCurrent && (
                        <button type="button" onClick={() => void switchToDeviceProfile(p)} style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.bdrH}`, background: T.surf, color: T.acc, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Switch
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Account Actions ─── */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Account</div>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                style={{ width: "100%", marginBottom: 10, padding: "12px 12px", borderRadius: T.r, border: `1px solid ${T.dng}`, background: T.ddim, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
              >
                <LogOut size={18} color={T.dng} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.dng }}>Log out</div>
                  <div style={{ fontSize: 11, color: T.sub }}>Return to PIN screen</div>
                </div>
              </button>
              <button
                type="button"
                disabled={!firebaseUser?.email || fbStatus !== "ready"}
                onClick={() => { setDeleteAllErr(""); setDeleteAllPin(""); setDeleteAllModal(true); }}
                style={{ width: "100%", marginBottom: 10, padding: "12px 12px", borderRadius: T.r, border: `1px solid ${T.dng}66`, background: T.ddim, cursor: !firebaseUser?.email || fbStatus !== "ready" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", opacity: !firebaseUser?.email || fbStatus !== "ready" ? 0.5 : 1 }}
              >
                <Trash2 size={18} color={T.dng} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.dng }}>Delete all expenses</div>
                  <div style={{ fontSize: 11, color: T.sub }}>{txs.length} transactions · requires PIN</div>
                </div>
              </button>
              <button
                type="button"
                disabled={!firebaseUser?.email || fbStatus !== "ready"}
                onClick={() => { setDeleteAcctErr(""); setDeleteAcctPin(""); setDeleteAcctModal(true); }}
                style={{ width: "100%", padding: "12px 12px", borderRadius: T.r, border: `1px solid ${T.dng}`, background: T.dng, cursor: !firebaseUser?.email || fbStatus !== "ready" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", opacity: !firebaseUser?.email || fbStatus !== "ready" ? 0.5 : 1 }}
              >
                <Trash2 size={18} color="#fff" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Delete account</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Permanently remove all data & account</div>
                </div>
              </button>
            </div>

            {(footerLine1 || footerLine2) && (
              <div style={{ textAlign: "center", padding: "6px 0 0" }}>
                {footerLine1 ? <div style={{ fontSize: 12, color: T.mut }}>{footerLine1}</div> : null}
                {footerLine2 ? <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>{footerLine2}</div> : null}
              </div>
            )}
          </div>
        )}
      </div>

      {showNameEdit ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="name-edit-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 600,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNameEdit(false);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: maxShell,
              background: T.card,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              paddingBottom: "max(28px, calc(20px + env(safe-area-inset-bottom, 0px)))",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div id="name-edit-title" style={{ fontSize: 17, fontWeight: 800 }}>
                Edit display name
              </div>
              <button
                type="button"
                onClick={() => setShowNameEdit(false)}
                aria-label="Close"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  border: `1px solid ${T.bdr}`,
                  background: T.card2,
                  color: T.sub,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>
              Shown in the app header and on split bills your friends receive.
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Your name</label>
              <input
                autoFocus
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameDraft.trim() && !savingName) {
                    e.preventDefault();
                    void saveNameFromHeader();
                  }
                  if (e.key === "Escape") {
                    setShowNameEdit(false);
                  }
                }}
                placeholder="e.g. Sandeep"
                maxLength={60}
                style={{ ...inp, fontSize: 18, fontWeight: 600 }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowNameEdit(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: T.r,
                  border: `1px solid ${T.bdr}`,
                  background: "transparent",
                  color: T.sub,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!nameDraft.trim() || savingName}
                onClick={() => void saveNameFromHeader()}
                style={{
                  flex: 2,
                  padding: 14,
                  borderRadius: T.r,
                  background: nameDraft.trim() ? T.acc : T.card2,
                  border: "none",
                  color: nameDraft.trim() ? T.btnTxt : T.mut,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !nameDraft.trim() || savingName ? "not-allowed" : "pointer",
                  opacity: !nameDraft.trim() ? 0.55 : savingName ? 0.8 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {savingName ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                {savingName ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBM ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-sheet-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 500,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBM(false);
              setBmCat("");
              setBmAmt("");
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: maxShell,
              maxHeight: "90dvh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: T.card,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              paddingBottom: "max(28px, calc(20px + env(safe-area-inset-bottom, 0px)))",
              boxSizing: "border-box",
            }}
          >
            <div id="budget-sheet-title" style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>
              {bmCat === MONTH_TOTAL_BUDGET_KEY
                ? "Monthly spending cap"
                : bmCat
                  ? `Set Budget — ${bmCat}`
                  : "Set Budget"}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{bmCat === MONTH_TOTAL_BUDGET_KEY ? "Applies to" : "Category"}</label>
              <select value={bmCat} onChange={(e) => setBmCat(e.target.value)} style={{ ...inp, appearance: "none" }}>
                <option value="">Choose…</option>
                <option value={MONTH_TOTAL_BUDGET_KEY}>All spending this month (overall cap)</option>
                {categories.map((c) => (
                  <option key={c.n} value={c.n}>
                    {c.n}
                  </option>
                ))}
              </select>
              {bmCat === MONTH_TOTAL_BUDGET_KEY ? (
                <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.45 }}>
                  One limit for your total spending this month — no category needed. Progress appears on Home as a ring next to “This Month”.
                </div>
              ) : null}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Monthly limit</label>
              <input type="number" inputMode="decimal" placeholder="Enter amount" value={bmAmt} onChange={(e) => setBmAmt(e.target.value)} style={{ ...inp, fontSize: 20, fontWeight: 700 }} />
            </div>
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setShowBM(false);
                  setBmCat("");
                  setBmAmt("");
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: T.r,
                  border: `1px solid ${T.bdr}`,
                  background: "transparent",
                  color: T.sub,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bmAmt || isNaN(+bmAmt) || +bmAmt <= 0 || !bmCat}
                onClick={() => void saveBudget()}
                style={{
                  flex: 2,
                  padding: 14,
                  borderRadius: T.r,
                  background: T.acc,
                  border: "none",
                  color: T.btnTxt,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !bmAmt || isNaN(+bmAmt) || +bmAmt <= 0 || !bmCat ? "not-allowed" : "pointer",
                  opacity: !bmAmt || isNaN(+bmAmt) || +bmAmt <= 0 || !bmCat ? 0.45 : 1,
                }}
              >
                Save Budget
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showFixedModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 500,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            animation: "fade-in .2s ease",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowFixedModal(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: maxShell,
              maxHeight: "90dvh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: T.card,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              paddingBottom: "max(28px, calc(20px + env(safe-area-inset-bottom, 0px)))",
              boxSizing: "border-box",
              animation: "sheet-up .3s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <Lock size={18} color={T.purp} /> {fixedDraft.name ? "Edit Fixed Expense" : "Add Fixed Expense"}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Expense name</label>
              <input
                type="text"
                placeholder="e.g. House Rent"
                value={fixedDraft.name}
                onChange={(e) => setFixedDraft((d) => ({ ...d, name: e.target.value }))}
                style={inp}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Monthly amount</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Enter amount"
                value={fixedDraft.amount}
                onChange={(e) => setFixedDraft((d) => ({ ...d, amount: e.target.value }))}
                style={{ ...inp, fontSize: 20, fontWeight: 700 }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Category</label>
                <select
                  value={fixedDraft.category}
                  onChange={(e) => setFixedDraft((d) => ({ ...d, category: e.target.value }))}
                  style={inp}
                >
                  {categories.map((c) => (
                    <option key={c.n} value={c.n}>{c.n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Due day of month</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={fixedDraft.dueDay}
                  onChange={(e) => setFixedDraft((d) => ({ ...d, dueDay: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>
            {fixedExpenses.length === 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Or pick from templates:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {FIXED_EXPENSE_TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setFixedDraft((d) => ({ ...d, name: t.name, category: t.category }))}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: fixedDraft.name === t.name ? `1px solid ${T.purp}` : `1px solid ${T.bdr}`,
                        background: fixedDraft.name === t.name ? `${T.purp}22` : T.card2,
                        color: T.txt,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowFixedModal(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: T.r,
                  border: `1px solid ${T.bdr}`,
                  background: "transparent",
                  color: T.sub,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!fixedDraft.name.trim() || !fixedDraft.amount || isNaN(+fixedDraft.amount) || +fixedDraft.amount <= 0}
                onClick={() => void saveFixedExpense()}
                style={{
                  flex: 2,
                  padding: 14,
                  borderRadius: T.r,
                  background: T.purp,
                  border: "none",
                  color: T.btnTxt,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !fixedDraft.name.trim() || !fixedDraft.amount ? "not-allowed" : "pointer",
                  opacity: !fixedDraft.name.trim() || !fixedDraft.amount ? 0.45 : 1,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCurrencyPicker && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 500, animation: "fade-in .2s ease", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCurrencyPicker(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: maxShell,
              maxHeight: "80dvh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: T.card,
              borderRadius: "20px 20px 0 0",
              padding: "20px 0 0",
              paddingBottom: "max(20px, calc(12px + env(safe-area-inset-bottom, 0px)))",
              boxSizing: "border-box",
              animation: "sheet-up .3s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <div style={{ padding: "0 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Select Currency</div>
              <button type="button" onClick={() => setShowCurrencyPicker(false)} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "0 8px" }}>
              {CURRENCIES.map((cur) => {
                const active = cur.code === currencyCode;
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => void saveUserCurrency({ code: cur.code, locale: cur.locale })}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: active ? T.adim : "transparent",
                      color: T.txt,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <CurrencyFlag country={cur.country} code={cur.code} size={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: active ? 700 : 500 }}>{cur.name}</div>
                      <div style={{ fontSize: 12, color: T.sub }}>{cur.code}</div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: active ? T.acc : T.sub, minWidth: 40, textAlign: "right" }}>{cur.symbol}</span>
                    {active && <div style={{ width: 8, height: 8, borderRadius: 4, background: T.acc, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SplitQrScanModal open={showSplitScan} onClose={() => setShowSplitScan(false)} onDecoded={(t) => void handleSplitContactDecoded(t)} />

      {showProfileQr && firebaseUser?.email ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-qr-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 535,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            animation: "fade-in .2s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProfileQr(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              background: T.card,
              borderRadius: T.rLg,
              padding: 22,
              border: `1px solid ${T.bdr}`,
              boxSizing: "border-box",
              animation: "fade-in .2s ease, sheet-up .3s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div id="profile-qr-title" style={{ fontSize: 17, fontWeight: 800 }}>
                Split contact QR
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowProfileQr(false)}
                style={{
                  border: "none",
                  background: T.card2,
                  borderRadius: 8,
                  padding: 8,
                  cursor: "pointer",
                  color: T.sub,
                  display: "flex",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.45, marginBottom: 16 }}>
              Friends tap <strong style={{ color: T.txt }}>Scan</strong> under Split Contacts and point at this code. They’ll get your name and linked ID so you can pick each other when splitting expenses.
            </p>
            {profileName.trim() ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 16px", background: "#fff", borderRadius: 12 }}>
                <QRCodeSVG
                  value={buildSplitSharePayload({
                    email: firebaseUser.email,
                    uuid: profileTagUuid || "",
                    name: profileName.trim(),
                    fuid: firebaseUser?.uid || "",
                  })}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            ) : (
              <div style={{ padding: "16px 14px", background: T.wdim, border: `1px solid ${T.warn}44`, borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.warn, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={14} /> Set your display name first
                </div>
                <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.4, marginBottom: 10 }}>
                  Friends need a real name to recognise you in splits. Enter one here, then we'll generate your QR code.
                </div>
                <input
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  style={{ ...inp, marginBottom: 8 }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const name = profileName.trim();
                    if (!name) { dlg.toast("Name cannot be empty", { type: "warn" }); return; }
                    if (uidRef.current) {
                      try {
                        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { profileName: name }, { merge: true });
                        dlg.toast("Name saved", { type: "success" });
                      } catch (err) {
                        console.error("Failed to save profile name", err);
                        dlg.toast("Couldn't save name", { type: "error" });
                      }
                    }
                  }}
                  disabled={!profileName.trim()}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10, border: "none",
                    background: profileName.trim() ? T.acc : T.card2,
                    color: profileName.trim() ? T.btnTxt : T.mut,
                    fontWeight: 700, fontSize: 13, cursor: profileName.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Save name
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={!profileName.trim()}
              onClick={() => {
                if (!profileName.trim()) { dlg.toast("Set a display name first", { type: "warn" }); return; }
                const t = buildSplitSharePayload({
                  email: firebaseUser.email,
                  uuid: profileTagUuid || "",
                  name: profileName.trim(),
                  fuid: firebaseUser?.uid || "",
                });
                void navigator.clipboard.writeText(t).then(() => {
                  setProfileQrCopied(true);
                  setTimeout(() => setProfileQrCopied(false), 2000);
                });
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: T.r,
                border: `1px solid ${T.bdrH}`,
                background: T.surf,
                color: profileQrCopied ? T.acc : T.txt,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Copy size={16} />
              {profileQrCopied ? "Copied text code" : "Copy text code"}
            </button>
            <div style={{ fontSize: 11, color: T.mut, lineHeight: 1.4 }}>
              Includes your Sign-in ID and profile id — only share with people you trust.
            </div>
          </div>
        </div>
      ) : null}

      {deleteAllModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-all-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 520,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteAllBusy) {
              setDeleteAllModal(false);
              setDeleteAllPin("");
              setDeleteAllErr("");
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 400,
              background: T.card,
              borderRadius: T.rLg,
              padding: 22,
              border: `1px solid ${T.dng}59`,
              boxSizing: "border-box",
            }}
          >
            <div id="delete-all-title" style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, color: T.txt }}>
              Delete all expenses?
            </div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.45, marginBottom: 16 }}>
              This cannot be undone. Enter the 4-digit PIN for <strong style={{ color: T.txt }}>{profileName.trim() || "this profile"}</strong> to
              remove all {txs.length} expense{txs.length === 1 ? "" : "s"} from this account.
            </div>
            <label style={lbl}>PIN</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={deleteAllPin}
              onChange={(e) => {
                setDeleteAllPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setDeleteAllErr("");
              }}
              placeholder="••••"
              style={{ ...inp, marginBottom: deleteAllErr ? 8 : 16, letterSpacing: 6, fontSize: 18 }}
            />
            {deleteAllErr ? (
              <div style={{ fontSize: 13, color: T.dng, marginBottom: 12 }}>{deleteAllErr}</div>
            ) : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                disabled={deleteAllBusy}
                onClick={() => {
                  if (!deleteAllBusy) {
                    setDeleteAllModal(false);
                    setDeleteAllPin("");
                    setDeleteAllErr("");
                  }
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: T.r,
                  border: `1px solid ${T.bdr}`,
                  background: "transparent",
                  color: T.sub,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: deleteAllBusy ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteAllBusy || deleteAllPin.length !== 4}
                onClick={() => void confirmDeleteAllExpenses()}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: T.r,
                  border: "none",
                  background: T.dng,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: deleteAllBusy || deleteAllPin.length !== 4 ? "not-allowed" : "pointer",
                  opacity: deleteAllPin.length === 4 ? 1 : 0.65,
                }}
              >
                {deleteAllBusy ? "Deleting…" : "Delete all"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteAcctModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-acct-title"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 520, animation: "fade-in .2s ease", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleteAcctBusy) { setDeleteAcctModal(false); setDeleteAcctPin(""); setDeleteAcctErr(""); } }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: T.card, borderRadius: T.rLg, padding: 22, border: `1px solid ${T.dng}`, boxSizing: "border-box", animation: "fade-in .2s ease, sheet-up .3s cubic-bezier(.22,1,.36,1)" }}>
            <div id="delete-acct-title" style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, color: T.dng }}>
              Delete your account?
            </div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.45, marginBottom: 6 }}>
              This will <strong style={{ color: T.dng }}>permanently</strong> delete:
            </div>
            <ul style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, margin: "0 0 14px 18px", padding: 0 }}>
              <li>All {txs.length} transaction{txs.length === 1 ? "" : "s"}</li>
              <li>Budgets, settings & preferences</li>
              <li>Your login account</li>
            </ul>
            <div style={{ fontSize: 12, color: T.warn, background: T.wdim, borderRadius: 8, padding: "8px 10px", marginBottom: 14, lineHeight: 1.4 }}>
              This cannot be undone. You will need to create a new account to use the app again.
            </div>
            <label style={lbl}>Enter PIN to confirm</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={deleteAcctPin}
              onChange={(e) => { setDeleteAcctPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setDeleteAcctErr(""); }}
              placeholder="••••"
              style={{ ...inp, marginBottom: deleteAcctErr ? 8 : 16, letterSpacing: 6, fontSize: 18 }}
            />
            {deleteAcctErr ? <div style={{ fontSize: 13, color: T.dng, marginBottom: 12 }}>{deleteAcctErr}</div> : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                disabled={deleteAcctBusy}
                onClick={() => { if (!deleteAcctBusy) { setDeleteAcctModal(false); setDeleteAcctPin(""); setDeleteAcctErr(""); } }}
                style={{ flex: 1, padding: 14, borderRadius: T.r, border: `1px solid ${T.bdr}`, background: "transparent", color: T.sub, fontSize: 14, fontWeight: 600, cursor: deleteAcctBusy ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteAcctBusy || deleteAcctPin.length !== 4}
                onClick={() => void confirmDeleteAccount()}
                style={{ flex: 1, padding: 14, borderRadius: T.r, border: "none", background: T.dng, color: "#fff", fontSize: 14, fontWeight: 800, cursor: deleteAcctBusy || deleteAcctPin.length !== 4 ? "not-allowed" : "pointer", opacity: deleteAcctPin.length === 4 ? 1 : 0.65 }}
              >
                {deleteAcctBusy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          maxWidth: maxShell,
          marginLeft: "auto",
          marginRight: "auto",
          background: `${T.surf}F0`,
          backdropFilter: "blur(24px)",
          borderTop: `1px solid ${T.bdr}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: `8px 4px ${safeBottom}`,
          zIndex: 99,
          boxSizing: "border-box",
        }}
      >
        {[
          { id: "home", icon: <Home size={20} />, label: "Home" },
          { id: "analytics", icon: <BarChart2 size={20} />, label: "Analytics" },
          { id: "ADD", icon: null, label: "" },
          { id: "reports", icon: <BrainCircuit size={20} />, label: "Reports" },
          { id: "budgets", icon: <Wallet size={20} />, label: "Budgets" },
        ].map((item) => {
          if (item.id === "ADD")
            return (
              <button
                type="button"
                key="add"
                onClick={() => {
                  setTab("add");
                  setStep("mode");
                }}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: T.acc,
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: `0 4px 22px ${T.acc}73`,
                  transform: "translateY(-12px)",
                }}
              >
                <Plus size={28} color={T.btnTxt} strokeWidth={3} />
              </button>
            );
          const active = tab === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                background: "none",
                border: "none",
                color: active ? T.acc : T.mut,
                cursor: "pointer",
                padding: "4px 0",
                transition: "color .15s",
              }}
            >
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>

    {/* Transaction detail overlay */}
    {selectedTx && (
      <TxDetail
        tx={txs.find((t) => t.id === selectedTx.id) ?? selectedTx}
        categories={categories}
        payments={catalogRef.current.payments || []}
        formatMoney={formatMoney}
        dateLocale={dateLocale || locale}
        splitContacts={people}
        selfProfileUuid={profileTagUuid || ""}
        selfFbUid={selfFbUid}
        selfName={profileName || ""}
        onSaveSplit={(txId, split) => void updateTransactionSplit(txId, split)}
        onEdit={(txId, updates) => void editTransaction(txId, updates)}
        onSettle={(txId, settlement) => void saveSettlement(txId, settlement)}
        onClearSettlement={(txId) => void clearSettlement(txId)}
        onRecordPeerSettlement={(txId, peerUid, peerName, settlement) => void recordPeerSettlement(txId, peerUid, peerName, settlement)}
        onClearPeerSettlement={(txId, peerUid, peerName) => void clearPeerSettlement(txId, peerUid, peerName)}
        onClose={() => setSelectedTx(null)}
        onDelete={(id) => {
          delTx(id);
          setSelectedTx(null);
        }}
      />
    )}
    </>
  );
}

