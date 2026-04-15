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
  Layers,
  CreditCard,
  LogOut,
  Copy,
} from "lucide-react";
import { T, card, card2, inp, lbl, pill } from "./config.js";
import { uid, tdStr, dAgo, getCat, fmt, filterTx, tot } from "./utils.js";
import { TxRow } from "./TxRow.jsx";
import { BudgetBar } from "./BudgetBar.jsx";
import { collection, doc, getDoc, onSnapshot, setDoc, deleteDoc, deleteField } from "firebase/firestore";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { db, auth, initAnalytics } from "./firebase.js";
import { FALLBACK_CATALOG, offlineStorageKey } from "./fallbackCatalog.js";
import AuthGate from "./AuthGate.jsx";
import { useShellLayout } from "./useShellLayout.js";
import {
  loadProfiles,
  profileDisplayName,
  pinToPassword,
  isValidPin,
  PENDING_LOGIN_EMAIL_KEY,
} from "./auth/pinProfiles.js";

const API = `${import.meta.env.BASE_URL}anthropic/v1/messages`;

function sanitizeForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [txs, setTxs] = useState([]);
  const [budgets, setBudgets] = useState({});
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
  const [saveToast, setSaveToast] = useState(null);
  const [splitOn, setSplitOn] = useState(false);
  const [splitType, setSplitType] = useState("equal");
  const [splitPpl, setSplitPpl] = useState([]);
  const [previewImg, setPreviewImg] = useState(null);
  const [scanErr, setScanErr] = useState("");
  const fileRef = useRef();
  const stmtRef = useRef();
  const mainScrollRef = useRef(null);

  const [tips, setTips] = useState([]);
  const [ldTips, setLdTips] = useState(false);

  const [showBM, setShowBM] = useState(false);
  const [bmCat, setBmCat] = useState("");
  const [bmAmt, setBmAmt] = useState("");

  const [newP, setNewP] = useState("");

  /** When set, overrides global `config/app` for this user only (stored in settings/app). */
  const [userCategories, setUserCategories] = useState(null);
  const [userPayments, setUserPayments] = useState(null);

  const [catDraft, setCatDraft] = useState([]);
  const [payDraft, setPayDraft] = useState("");
  const [catSaveMsg, setCatSaveMsg] = useState("");

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
  const layout = useShellLayout();
  const { shellMax, px, twoCol, comfortable, chart, safeBottom, safeTop } = layout;
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
    return {
      ...base,
      categories: userCategories && userCategories.length > 0 ? userCategories : base.categories,
      payments: userPayments && userPayments.length > 0 ? userPayments : base.payments,
    };
  }, [catalog, fbStatus, userCategories, userPayments]);

  useEffect(() => {
    catalogRef.current = effectiveCatalog;
  }, [effectiveCatalog]);

  const { categories, payments, currencyCode, locale, dateLocale, footerLine1, footerLine2 } = effectiveCatalog;

  const formatMoney = useCallback(
    (n) => fmt(n, { currency: currencyCode || undefined, locale: locale || undefined }),
    [currencyCode, locale]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;
    let unsubTx;
    let unsubSettings;
    let unsubCatalog;

    if (!firebaseUser) {
      uidRef.current = null;
      setProfileTagUuid("");
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
          if (Array.isArray(d.people)) setPeople(d.people);
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
              if (Array.isArray(o.people)) setPeople(o.people);
              if (Array.isArray(o.userCategories) && o.userCategories.length > 0) setUserCategories(o.userCategories);
              if (Array.isArray(o.userPayments) && o.userPayments.length > 0) setUserPayments(o.userPayments);
            } else {
              setTxs([]);
              setBudgets({});
              setPeople([]);
            }
          } catch {
            setTxs([]);
            setBudgets({});
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
        JSON.stringify({ txs, budgets, people, userCategories, userPayments })
      );
    } catch {
      /* ignore */
    }
  }, [fbStatus, firebaseUser?.uid, txs, budgets, people, userCategories, userPayments]);

  useEffect(() => {
    if (tab !== "profile") return;
    setCatDraft(categories.map((c) => ({ ...c })));
    setPayDraft(payments.join("\n"));
    setDeviceProfiles(loadProfiles());
  }, [tab, categories, payments]);

  useEffect(() => {
    setDeviceProfiles(loadProfiles());
  }, [firebaseUser?.uid]);

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
    setForm((f) => ({
      ...f,
      payment: payments.includes(f.payment) ? f.payment : payments[0],
    }));
  }, [payments]);

  /** After save, success UI is at top — scroll so it is not missed below the fold. */
  useEffect(() => {
    if (step !== "success") return;
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /** Default category on expense form so submit is not blocked with no visible selection. */
  useEffect(() => {
    if (tab !== "add" || step !== "form") return;
    if (form.category) return;
    const first = categories[0]?.n;
    if (first) setForm((p) => ({ ...p, category: first }));
  }, [tab, step, categories, form.category]);

  const filtered = useMemo(() => filterTx(txs, df, cS, cE), [txs, df, cS, cE]);
  const fTotal = useMemo(() => tot(filtered), [filtered]);
  const monthTxs = useMemo(() => filterTx(txs, "month"), [txs]);
  const monthTotal = useMemo(() => tot(monthTxs), [monthTxs]);
  const todayTxs = useMemo(() => txs.filter((t) => t.date === tdStr()), [txs]);
  const todayTotal = useMemo(() => tot(todayTxs), [todayTxs]);
  const weekTxs = useMemo(() => filterTx(txs, "week"), [txs]);
  const weekTotal = useMemo(() => tot(weekTxs), [weekTxs]);

  const breakdown = useMemo(() => {
    const m = {};
    filtered.forEach((tx) => {
      m[tx.category] = (m[tx.category] || 0) + tx.amount;
    });
    return Object.entries(m)
      .map(([n, v]) => ({ name: n, value: v, ...getCat(categories, n) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categories]);

  const dailyData = useMemo(() => {
    const loc = (dateLocale && String(dateLocale).trim()) || (locale && String(locale).trim()) || undefined;
    return Array.from({ length: 14 }, (_, i) => {
      const d = dAgo(13 - i);
      return {
        label: new Date(d + "T00:00:00").toLocaleDateString(loc, { day: "numeric", month: "short" }),
        amount: tot(txs.filter((t) => t.date === d)),
      };
    });
  }, [txs, dateLocale, locale]);

  const catSpent = useMemo(() => {
    const m = {};
    monthTxs.forEach((t) => {
      m[t.category] = (m[t.category] || 0) + t.amount;
    });
    return m;
  }, [monthTxs]);

  const loggedToday = todayTxs.length > 0;

  async function delTx(id) {
    if (uidRef.current) {
      try {
        await deleteDoc(doc(db, "users", uidRef.current, "transactions", id));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    setTxs((p) => p.filter((t) => t.id !== id));
  }

  function scrollExpenseFormTop() {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Success screen, then Home + toast so saving is obvious even if the check view was scrolled away. */
  function schedulePostSaveReset(newTx) {
    setStep("success");
    setTimeout(() => {
      setStep("mode");
      const pay = catalogRef.current.payments[0] || "";
      setForm({ amount: "", category: "", date: tdStr(), payment: pay, notes: "", tags: "" });
      setSplitOn(false);
      setSplitPpl([]);
      setPreviewImg(null);
      setTab("home");
      setSaveToast(`${formatMoney(newTx.amount)} · ${newTx.category}`);
      setTimeout(() => setSaveToast(null), 4500);
    }, 2400);
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
    const splitNormalized =
      splitOn && splitPpl.length > 0
        ? {
            type: splitType,
            people: splitPpl.map((p) => ({
              n: p.n,
              a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0,
            })),
          }
        : null;
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
      await setDoc(doc(db, "users", uidRef.current, "transactions", newTx.id), sanitizeForFirestore(newTx));
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

  async function processFile(e, isStatement = false) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    setScanErr("");
    setStep("processing");
    const reader = new FileReader();
    reader.onerror = () => {
      setScanErr("Could not read this file from your device.");
      setStep("form");
      input.value = "";
    };
    reader.onload = async (ev) => {
      try {
        const raw = ev.target.result;
        if (typeof raw !== "string" || !raw.includes(",")) {
          setScanErr("Could not read file as image or PDF.");
          setStep("form");
          return;
        }
        const b64 = raw.split(",")[1];
        if (!isStatement) setPreviewImg(raw);

        const catNames = (catalogRef.current.categories || []).map((c) => c.n).filter(Boolean);
        const catList = catNames.length ? catNames.join(", ") : "(no categories configured in database)";
        const r = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 400,
            system: `You are a receipt/bill/bank-statement OCR system. Return ONLY valid JSON: {amount:number,category:string(must be one of: ${catList}),date:string YYYY-MM-DD,notes:string}`,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: f.type.includes("pdf") ? "application/pdf" : f.type,
                      data: b64,
                    },
                  },
                  {
                    type: "text",
                    text: `Extract expense info from this ${isStatement ? "bank statement" : "receipt/bill"}. Return only JSON.`,
                  },
                ],
              },
            ],
          }),
        });
        const bodyText = await r.text();
        let d = {};
        try {
          d = JSON.parse(bodyText);
        } catch {
          /* ignore */
        }
        if (!r.ok) {
          const raw =
            d.error?.message ||
            (bodyText.length > 180 ? `${bodyText.slice(0, 180)}…` : bodyText) ||
            `Scan request failed (${r.status}).`;
          const needsKey =
            typeof raw === "string" &&
            (raw.toLowerCase().includes("x-api-key") || raw.toLowerCase().includes("api key"));
          setScanErr(
            needsKey
              ? `Anthropic key missing: ${raw.trim()} In the project folder, create or edit .env.local with ANTHROPIC_API_KEY=your_key (from console.anthropic.com), save, then stop and restart npm run dev. Deployed sites need a backend proxy; local dev uses Vite only.`
              : `${raw} For scans, set ANTHROPIC_API_KEY in .env.local and use npm run dev.`
          );
          setStep("form");
          return;
        }
        const txt = d.content?.find((c) => c.type === "text")?.text || "{}";
        let ex = {};
        try {
          ex = JSON.parse(txt.replace(/```json?|```/g, "").trim());
        } catch {
          /* ignore */
        }
        setForm((p) => ({
          ...p,
          amount: ex.amount ? String(ex.amount) : p.amount,
          category: ex.category || p.category,
          date: ex.date || p.date,
          notes: ex.notes || p.notes,
        }));
      } catch (err) {
        console.error(err);
        setScanErr(err instanceof Error ? err.message : "Scan failed. Check network and API setup.");
        setStep("form");
      } finally {
        input.value = "";
      }
    };
    reader.readAsDataURL(f);
  }

  async function genTips() {
    setLdTips(true);
    const summary = {
      monthTotal,
      weekTotal,
      cats: Object.fromEntries(Object.entries(catSpent).sort(([, a], [, b]) => b - a).slice(0, 6)),
      overBudget: Object.entries(budgets)
        .filter(([c, l]) => (catSpent[c] || 0) > l)
        .map(([c]) => c),
      topTx: txs.slice(0, 5).map((t) => ({ amount: t.amount, cat: t.category, notes: t.notes })),
    };
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system:
            "You are a personal finance advisor. Return ONLY a JSON array of exactly 5 tips. Each: {icon:single emoji,title:string(max 8 words),desc:string(max 20 words),category:string,saving:string(e.g. '₹500/month'),priority:'high'|'medium'|'low'}",
          messages: [{ role: "user", content: `Give 5 actionable expense tips: ${JSON.stringify(summary)}` }],
        }),
      });
      const bodyText = await r.text();
      let d = {};
      try {
        d = JSON.parse(bodyText);
      } catch {
        /* ignore */
      }
      if (!r.ok) {
        console.error("genTips API error", d.error?.message || bodyText.slice(0, 200) || r.status);
        setTips([]);
        return;
      }
      const txt = d.content?.find((c) => c.type === "text")?.text || "[]";
      let p = [];
      try {
        p = JSON.parse(txt.replace(/```json?|```/g, "").trim());
      } catch {
        /* ignore */
      }
      setTips(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLdTips(false);
    }
  }

  async function saveBudget() {
    if (!bmCat || !bmAmt || isNaN(+bmAmt)) return;
    const next = parseFloat(bmAmt);
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

  function toggleSplitPerson(name) {
    setSplitPpl((prev) => {
      const ex = prev.find((p) => p.n === name);
      const nl = ex ? prev.filter((p) => p.n !== name) : [...prev, { n: name, a: 0 }];
      if (splitType === "equal" && form.amount && nl.length > 0) {
        const each = parseFloat(form.amount) / nl.length;
        const rounded = Math.round(each * 100) / 100;
        return nl.map((p) => ({ ...p, a: rounded }));
      }
      return nl;
    });
  }

  async function saveUserCatalog() {
    setCatSaveMsg("");
    const cleaned = catDraft
      .map((c) => ({
        n: String(c.n || "").trim(),
        e: String(c.e || "").trim() || "📦",
        c: String(c.c || "").trim() || "#94A3B8",
        bg: String(c.bg || "").trim() || "rgba(148,163,184,.13)",
      }))
      .filter((c) => c.n.length > 0);
    const payList = payDraft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!cleaned.length) {
      setCatSaveMsg("Add at least one category with a name.");
      return;
    }
    if (!payList.length) {
      setCatSaveMsg("Add at least one payment method (one per line).");
      return;
    }
    if (uidRef.current) {
      try {
        await setDoc(
          doc(db, "users", uidRef.current, "settings", "app"),
          { userCategories: cleaned, userPayments: payList },
          { merge: true }
        );
        setCatSaveMsg("Saved.");
      } catch (e) {
        console.error(e);
        setUserCategories(cleaned);
        setUserPayments(payList);
        setCatSaveMsg("Saved on this device (could not reach cloud).");
      }
    } else {
      setUserCategories(cleaned);
      setUserPayments(payList);
      setCatSaveMsg("Saved on this device.");
    }
  }

  async function resetUserCatalogOverrides() {
    setCatSaveMsg("");
    if (uidRef.current) {
      try {
        await setDoc(
          doc(db, "users", uidRef.current, "settings", "app"),
          { userCategories: deleteField(), userPayments: deleteField() },
          { merge: true }
        );
        setCatSaveMsg("Restored global defaults.");
      } catch (e) {
        console.error(e);
        setUserCategories(null);
        setUserPayments(null);
        setCatSaveMsg("Restored defaults on this device.");
      }
    } else {
      setUserCategories(null);
      setUserPayments(null);
      setCatSaveMsg("Restored defaults.");
    }
  }

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          width: "100%",
          maxWidth: shellMax,
          margin: "0 auto",
          paddingLeft: px,
          paddingRight: px,
          boxSizing: "border-box",
          background: T.bg,
          color: T.txt,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        }}
      >
        <div style={{ color: T.sub, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthGate />;
  }

  const mainBottomPad = "calc(96px + env(safe-area-inset-bottom, 0px))";

  return (
    <div
      style={{
        background: T.bg,
        color: T.txt,
        minHeight: "100dvh",
        width: "100%",
        maxWidth: shellMax,
        margin: "0 auto",
        paddingLeft: 0,
        paddingRight: 0,
        boxSizing: "border-box",
        fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        html,body,#root{min-height:100%;margin:0;}
        #root{min-height:100dvh;display:flex;flex-direction:column;}
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);}
        select option{background:#15152A;color:#fff;}
        button,input,select,textarea,a{-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .spin{animation:spin 1s linear infinite;}
        @keyframes pop{0%{transform:scale(0.8);opacity:0}100%{transform:scale(1);opacity:1}}
        .pop{animation:pop .3s ease-out;}
      `}</style>

      {fbStatus === "loading" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: shellMax,
            zIndex: 200,
            padding: `10px ${px}px`,
            paddingTop: `max(10px, ${safeTop})`,
            background: T.card2,
            borderBottom: `1px solid ${T.bdr}`,
            fontSize: 12,
            color: T.sub,
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          Connecting to cloud…
        </div>
      )}
      {fbStatus === "error" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: shellMax,
            zIndex: 200,
            padding: `12px ${px}px`,
            paddingTop: `max(12px, ${safeTop})`,
            background: T.wdim,
            borderBottom: "1px solid rgba(245,158,11,0.35)",
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
              border: "1px solid rgba(245,158,11,0.45)",
              background: "rgba(0,0,0,0.2)",
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

      <div
        ref={mainScrollRef}
        style={{
          paddingBottom: mainBottomPad,
          overflowY: "auto",
          overflowX: "hidden",
          height: "100dvh",
          maxHeight: "100dvh",
          paddingTop: safeTop,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tab === "home" && (
          <div>
            <div style={{ padding: `${px + 8}px ${px}px ${px}px`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: T.sub }}>{new Date().getHours() < 12 ? "Good Morning" : "Good Evening"} 👋</div>
                <div style={{ fontSize: comfortable ? 26 : 22, fontWeight: 800, marginTop: 2 }}>My Expenses</div>
              </div>
              <div
                title="Notifications"
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
                <Bell size={17} color={T.sub} />
              </div>
            </div>

            <div
              style={{
                margin: `0 ${px}px 14px`,
                background: "linear-gradient(135deg,#17173A 0%,#0D1628 100%)",
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
                  background: "rgba(34,197,94,0.05)",
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
                  background: "rgba(96,165,250,0.05)",
                }}
              />
              <div style={{ fontSize: 13, color: T.sub, marginBottom: 3 }}>This Month</div>
              <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 14 }}>{formatMoney(monthTotal)}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: T.sub, marginBottom: 3 }}>Today</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{formatMoney(todayTotal)}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: T.sub, marginBottom: 3 }}>This Week</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{formatMoney(weekTotal)}</div>
                </div>
              </div>
            </div>

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
                  background: "rgba(245,158,11,0.09)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: T.r,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 26 }}>📋</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.warn }}>Daily Expense Log Pending</div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 1 }}>No entries today — tap to log now</div>
                </div>
                <span style={{ color: T.warn, fontSize: 20, fontWeight: 300 }}>›</span>
              </div>
            )}

            {tips.length > 0 && (
              <div
                style={{
                  margin: `0 ${px}px 14px`,
                  background: "rgba(34,197,94,0.07)",
                  border: "1px solid rgba(34,197,94,0.22)",
                  borderRadius: T.r,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 11, color: T.acc, fontWeight: 700, marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={11} /> AI TIP OF THE DAY
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
                  icon: "📷",
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
                  icon: "📊",
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
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {a.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: T.sub }}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {Object.entries(budgets)
              .filter(([c, l]) => (catSpent[c] || 0) >= l * 0.8)
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
                      border: `1px solid ${over ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                      borderRadius: T.r,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{cat.e}</span>
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
              {txs.slice(0, 10).map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  onDelete={delTx}
                  categories={categories}
                  formatMoney={formatMoney}
                  dateLocale={dateLocale || locale}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "add" && (
          <div>
            <div style={{ padding: `${px + 8}px ${px}px`, display: "flex", alignItems: "center", gap: 12 }}>
              {step === "form" && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("mode");
                    setScanErr("");
                  }}
                  style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 4 }}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {step === "mode"
                  ? "Add Expense"
                  : step === "form"
                    ? "Expense Details"
                    : step === "processing"
                      ? "Scanning Bill…"
                      : step === "success"
                        ? "Saved!"
                        : "Add Expense"}
              </div>
            </div>

            {step === "mode" && (
              <div style={{ padding: `0 ${px}px` }}>
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 18 }}>Choose how to add your expense</div>
                {[
                  { mode: "manual", icon: "✏️", title: "Manual Entry", sub: "Type in amount & details", col: T.acc },
                  { mode: "image", icon: "📷", title: "Scan Receipt / Bill", sub: "AI extracts details from photo", col: T.blue },
                  { mode: "statement", icon: "📄", title: "Upload Statement", sub: "Bank or credit card PDF", col: T.purp },
                ].map((opt) => (
                  <div
                    key={opt.mode}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setAddMode(opt.mode);
                      if (opt.mode === "manual") setStep("form");
                      else if (opt.mode === "image") fileRef.current?.click();
                      else stmtRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setAddMode(opt.mode);
                        if (opt.mode === "manual") setStep("form");
                        else if (opt.mode === "image") fileRef.current?.click();
                        else stmtRef.current?.click();
                      }
                    }}
                    style={{
                      ...card,
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      cursor: "pointer",
                      borderColor: addMode === opt.mode ? opt.col : T.bdr,
                      transition: "border-color .15s",
                    }}
                  >
                    <div style={{ fontSize: 32 }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{opt.title}</div>
                      <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{opt.sub}</div>
                    </div>
                    <span style={{ color: T.mut, fontSize: 18 }}>›</span>
                  </div>
                ))}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => void processFile(e, false)} />
                <input ref={stmtRef} type="file" accept="image/*,.pdf,image/heic,image/heif" style={{ display: "none" }} onChange={(e) => void processFile(e, true)} />
              </div>
            )}

            {step === "processing" && (
              <div style={{ padding: `70px ${px}px`, textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 18 }}>🔍</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>AI is reading your document…</div>
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 24 }}>Extracting amount, category & date</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: T.acc, opacity: 0.3 + i * 0.35 }} />
                  ))}
                </div>
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
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Expense Added!</div>
                <div style={{ fontSize: 13, color: T.sub }}>Redirecting to home…</div>
              </div>
            )}

            {step === "form" && (
              <div style={{ padding: `0 ${px}px` }}>
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
                        background: "linear-gradient(transparent,rgba(0,0,0,0.75))",
                        fontSize: 12,
                        color: T.acc,
                      }}
                    >
                      ✓ Bill scanned — review details below
                    </div>
                  </div>
                )}

                {scanErr && (
                  <div
                    style={{
                      background: T.ddim,
                      border: "1px solid rgba(239,68,68,0.35)",
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

                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>
                    Amount <span style={{ color: T.dng }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.sub, fontWeight: 700, fontSize: 18 }}>₹</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={form.amount}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      style={{ ...inp, paddingLeft: 34, fontSize: 22, fontWeight: 800 }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>
                    Category <span style={{ color: T.dng }}>*</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: T.dng, fontWeight: 400 }}>Required — cannot be skipped</span>
                  </label>
                  {fbStatus === "loading" && categories.length === 0 && (
                    <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Loading catalog…</div>
                  )}
                  {catalog.categories.length === 0 && categories.length > 0 && fbStatus === "ready" && (
                    <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>
                      Optional: add document <code style={{ color: T.sub }}>config/app</code> in Firestore to customize categories and payments.
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {categories.map((c) => (
                      <button
                        type="button"
                        key={c.n}
                        onClick={() => setForm((p) => ({ ...p, category: c.n }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "6px 11px",
                          borderRadius: 999,
                          border: form.category === c.n ? `2px solid ${c.c}` : `1px solid ${T.bdr}`,
                          background: form.category === c.n ? c.bg : "transparent",
                          color: form.category === c.n ? c.c : T.sub,
                          fontSize: 12,
                          fontWeight: form.category === c.n ? 700 : 400,
                          cursor: "pointer",
                          transition: "all .15s",
                        }}
                      >
                        {c.e} {c.n}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>
                      Date <span style={{ color: T.dng }}>*</span>
                    </label>
                    <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>
                      Payment <span style={{ color: T.dng }}>*</span>
                    </label>
                    <select value={form.payment} onChange={(e) => setForm((p) => ({ ...p, payment: e.target.value }))} style={{ ...inp, appearance: "none" }}>
                      {payments.map((pay) => (
                        <option key={pay}>{pay}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Notes</label>
                  <input placeholder="What was this for?" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={inp} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Tags (comma separated)</label>
                  <input placeholder="work, personal, urgent" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} style={inp} />
                </div>

                <div style={{ ...card, marginBottom: 14 }}>
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
                          const sel = splitPpl.find((sp) => sp.n === p);
                          return (
                            <button
                              type="button"
                              key={p}
                              onClick={() => toggleSplitPerson(p)}
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
                              👤 {p}
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
                                style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: 13 }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {fErr && (
                  <div style={{ background: T.ddim, border: "1px solid rgba(239,68,68,0.35)", borderRadius: T.r, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.dng }}>
                    {fErr}
                  </div>
                )}

                <button
                  type="button"
                  disabled={savingExpense}
                  onClick={() => void submitForm()}
                  style={{
                    width: "100%",
                    padding: 16,
                    borderRadius: T.r,
                    background: savingExpense ? T.mut : T.acc,
                    border: "none",
                    color: "#000",
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: savingExpense ? "not-allowed" : "pointer",
                    marginBottom: 20,
                    opacity: savingExpense ? 0.85 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  {savingExpense ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      Saving…
                    </>
                  ) : (
                    "Add Expense"
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "analytics" && (
          <div>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div>
                    <label style={lbl}>From</label>
                    <input type="date" value={cS} onChange={(e) => setCS(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>To</label>
                    <input type="date" value={cE} onChange={(e) => setCE(e.target.value)} style={inp} />
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
                          <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.e} {b.name}
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
                            <span style={{ fontSize: 13 }}>
                              {b.e} {b.name}
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

            <div style={{ padding: `0 ${px}px 16px` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                  <Sparkles size={17} color={T.acc} /> AI Insights
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
                    border: `1px solid ${T.acc}`,
                    background: T.adim,
                    color: T.acc,
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
                          <span style={{ fontSize: 11, background: T.adim, color: T.acc, borderRadius: 6, padding: "2px 8px" }}>💰 Save {tip.saving}</span>
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
                  <div style={{ fontSize: 44, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>AI-Powered Expense Advisor</div>
                  <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
                    {`Tap "Generate Tips" to get personalised tips based on your actual spending patterns`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "budgets" && (
          <div>
            <div style={{ padding: `${px + 8}px ${px}px` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Budgets</div>
                <button
                  type="button"
                  onClick={() => setShowBM(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 10,
                    background: T.acc,
                    border: "none",
                    color: "#000",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Set Budget
                </button>
              </div>
              <div style={{ fontSize: 13, color: T.sub }}>Monthly budget tracking</div>
            </div>

            <div
              style={{
                margin: `0 ${px}px 14px`,
                background: "linear-gradient(135deg,#17173A 0%,#0D1628 100%)",
                borderRadius: T.rLg,
                padding: 20,
                border: `1px solid ${T.bdr}`,
              }}
            >
              <div style={{ fontSize: 13, color: T.sub, marginBottom: 4 }}>Total Budgeted</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 12 }}>{formatMoney(Object.values(budgets).reduce((s, v) => s + v, 0))}</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.sub }}>Spent</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.dng }}>
                    {formatMoney(Object.entries(budgets).reduce((s, [c]) => s + (catSpent[c] || 0), 0))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.sub }}>Remaining</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.acc }}>
                    {formatMoney(Math.max(0, Object.entries(budgets).reduce((s, [c, l]) => s + (l - (catSpent[c] || 0)), 0)))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.sub }}>Over budget</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.warn }}>{Object.entries(budgets).filter(([c, l]) => (catSpent[c] || 0) > l).length} cats</div>
                </div>
              </div>
            </div>

            <div style={{ padding: `0 ${px}px` }}>
              {Object.entries(budgets).map(([cat, limit]) => (
                <div key={cat} style={{ ...card, marginBottom: 10 }}>
                  <BudgetBar cat={cat} limit={limit} spent={catSpent[cat] || 0} categories={categories} formatMoney={formatMoney} />
                  <button
                    type="button"
                    onClick={() => {
                      setBmCat(cat);
                      setBmAmt(String(limit));
                      setShowBM(true);
                    }}
                    style={{ background: "none", border: "none", color: T.sub, fontSize: 12, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Pencil size={11} /> Edit limit
                  </button>
                </div>
              ))}

              {categories.filter((c) => !budgets[c.n]).length > 0 && (
                <>
                  <div style={{ marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: 600, color: T.sub }}>No budget set</div>
                  {categories.filter((c) => !budgets[c.n]).map((c) => (
                    <div
                      key={c.n}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setBmCat(c.n);
                        setBmAmt("");
                        setShowBM(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setBmCat(c.n);
                          setBmAmt("");
                          setShowBM(true);
                        }
                      }}
                      style={{ ...card, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", opacity: 0.55 }}
                    >
                      <span style={{ fontSize: 22 }}>{c.e}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{c.n}</span>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: T.acc, border: `1px solid ${T.acc}`, borderRadius: 8, padding: "4px 10px" }}>+ Add</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {showBM && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: shellMax, background: T.card, borderRadius: "20px 20px 0 0", padding: 24, boxSizing: "border-box" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>{bmCat ? `Set Budget — ${bmCat}` : "Set Budget"}</div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>Category</label>
                    <select value={bmCat} onChange={(e) => setBmCat(e.target.value)} style={{ ...inp, appearance: "none" }}>
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.n} value={c.n}>
                          {c.e} {c.n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 22 }}>
                    <label style={lbl}>Monthly Limit (₹)</label>
                    <input type="number" placeholder="Enter amount" value={bmAmt} onChange={(e) => setBmAmt(e.target.value)} style={{ ...inp, fontSize: 20, fontWeight: 700 }} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
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
                      onClick={saveBudget}
                      style={{ flex: 2, padding: 14, borderRadius: T.r, background: T.acc, border: "none", color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                    >
                      Save Budget
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "profile" && (
          <div style={{ padding: `${px + 8}px ${px}px 120px` }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>Profile & Settings</div>

            <div style={{ ...card, marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg,${T.acc},${T.blue})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#000",
                  flexShrink: 0,
                }}
              >
                {(profileName && profileName.trim()[0]) || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{profileName.trim() || "—"}</div>
                {profileEmail.trim() ? (
                  <div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>{profileEmail.trim()}</div>
                ) : null}
                {firebaseUser?.email ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: T.mut, marginBottom: 6 }}>Sign-in ID (other devices)</div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <code
                        style={{
                          flex: 1,
                          fontSize: 11,
                          color: T.sub,
                          wordBreak: "break-all",
                          lineHeight: 1.35,
                        }}
                      >
                        {firebaseUser.email}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          const t = firebaseUser.email || "";
                          if (!t) return;
                          void navigator.clipboard.writeText(t).then(() => {
                            setSignInIdCopied(true);
                            setTimeout(() => setSignInIdCopied(false), 2000);
                          });
                        }}
                        style={{
                          flexShrink: 0,
                          padding: "6px 10px",
                          borderRadius: T.r,
                          border: `1px solid ${T.bdrH}`,
                          background: T.surf,
                          color: signInIdCopied ? T.acc : T.sub,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Copy size={14} />
                        {signInIdCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Users on this device</div>
              <div style={{ fontSize: 12, color: T.sub, marginBottom: 12, lineHeight: 1.45 }}>
                Names, PINs, and sign-in emails are saved in this browser for quick switching. Use{" "}
                <strong style={{ color: T.txt }}>Sign-in ID</strong> above to sign in on another device. Transactions use{" "}
                <code style={{ color: T.acc }}>appProfileUuid</code> in Firebase.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {deviceProfiles.map((p) => {
                  const isCurrent = p.email === firebaseUser?.email;
                  const pinLabel = p.pin && isValidPin(p.pin) ? "••••" : "PIN not stored";
                  return (
                    <div
                      key={p.email}
                      style={{
                        padding: 12,
                        borderRadius: T.r,
                        border: `1px solid ${isCurrent ? T.acc : T.bdr}`,
                        background: isCurrent ? T.adim : T.card2,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{profileDisplayName(p)}</div>
                          <div style={{ fontSize: 11, color: T.mut, marginTop: 4, fontFamily: "ui-monospace,monospace", wordBreak: "break-all" }}>
                            {p.uuid || "—"}
                          </div>
                          <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                            PIN: {pinLabel} {isCurrent ? "(signed in)" : ""}
                          </div>
                        </div>
                        {!isCurrent ? (
                          <button
                            type="button"
                            onClick={() => void switchToDeviceProfile(p)}
                            style={{
                              flexShrink: 0,
                              padding: "8px 12px",
                              borderRadius: T.r,
                              border: `1px solid ${T.bdrH}`,
                              background: T.surf,
                              color: T.acc,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Switch
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { l: "Transactions", v: txs.length },
                { l: "Categories", v: new Set(txs.map((t) => t.category)).size },
                { l: "Budgets", v: Object.keys(budgets).length },
              ].map((s) => (
                <div key={s.l} style={{ ...card2, textAlign: "center", padding: "14px 8px" }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Settings</div>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                style={{
                  width: "100%",
                  marginBottom: 14,
                  padding: "14px 14px",
                  borderRadius: T.r,
                  border: `1px solid ${T.dng}`,
                  background: T.ddim,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                }}
              >
                <LogOut size={22} color={T.dng} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.dng }}>Log out of app</div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>Return to PIN screen</div>
                </div>
              </button>
              {[
                { icon: "🔔", label: "Notifications", sub: "Daily reminders & alerts" },
                { icon: "💱", label: "Currency", sub: "INR ₹" },
                { icon: "🗂️", label: "Categories", sub: "Edit in Categories & payment methods below" },
                { icon: "📤", label: "Export Data", sub: "Download CSV or PDF" },
                { icon: "🔒", label: "Privacy & Security", sub: "Data & permissions" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < 4 ? `1px solid ${T.bdr}` : "none", cursor: "pointer" }}>
                  <div style={{ fontSize: 22 }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: T.sub }}>{item.sub}</div>
                  </div>
                  <span style={{ color: T.mut, fontSize: 18 }}>›</span>
                </div>
              ))}
            </div>

            <div style={{ ...card, marginBottom: 14, padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  padding: "16px 16px 14px",
                  borderBottom: `1px solid ${T.bdr}`,
                  background: `linear-gradient(180deg, ${T.surf} 0%, ${T.card} 100%)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: T.bdim,
                      border: `1px solid ${T.bdrH}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Layers size={20} color={T.blue} strokeWidth={2} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Categories & payments</div>
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 4, lineHeight: 1.5 }}>
                      Overrides are saved to your account. Reset anytime to use the global catalog from Firestore.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "14px 16px 16px" }}>
                {catSaveMsg ? (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: T.acc,
                      marginBottom: 14,
                      padding: "11px 14px",
                      borderRadius: T.r,
                      background: T.adim,
                      border: `1px solid rgba(34, 197, 94, 0.22)`,
                      lineHeight: 1.4,
                    }}
                  >
                    {catSaveMsg}
                  </div>
                ) : null}

                <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Categories
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  {catDraft.map((row, idx) => {
                    const accentHex = /^#[0-9A-Fa-f]{6}$/.test(String(row.c || "").trim())
                      ? row.c.trim()
                      : "#94a3b8";
                    return (
                      <div
                        key={idx}
                        style={{
                          background: T.card2,
                          border: `1px solid ${T.bdr}`,
                          borderRadius: T.rLg,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                          <div
                            title="Preview"
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 14,
                              background: row.bg || "rgba(148,163,184,.13)",
                              border: `2.5px solid ${accentHex}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 22,
                              lineHeight: 1,
                              flexShrink: 0,
                              boxShadow: "0 4px 14px rgba(0,0,0,.35)",
                            }}
                          >
                            <span aria-hidden>{row.e?.trim() ? row.e : "·"}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <label style={{ ...lbl, marginBottom: 4 }}>Name</label>
                            <input
                              value={row.n}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCatDraft((d) => d.map((x, i) => (i === idx ? { ...x, n: v } : x)));
                              }}
                              placeholder="e.g. Groceries"
                              style={{ ...inp, padding: "10px 12px", fontSize: 15, fontWeight: 600 }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setCatDraft((d) => d.filter((_, i) => i !== idx))}
                            style={{
                              alignSelf: "flex-end",
                              width: 44,
                              height: 44,
                              borderRadius: T.r,
                              border: `1px solid ${T.bdr}`,
                              background: T.surf,
                              color: T.mut,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                            aria-label="Remove category"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <label style={lbl}>Emoji</label>
                            <input
                              value={row.e}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCatDraft((d) => d.map((x, i) => (i === idx ? { ...x, e: v } : x)));
                              }}
                              style={{ ...inp, padding: "10px 12px", fontSize: 18, textAlign: "center" }}
                              aria-label="Emoji"
                              maxLength={8}
                            />
                          </div>
                          <div>
                            <label style={lbl}>Accent</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                              <input
                                type="color"
                                value={accentHex}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCatDraft((d) => d.map((x, i) => (i === idx ? { ...x, c: v } : x)));
                                }}
                                style={{
                                  width: 52,
                                  height: 46,
                                  padding: 4,
                                  border: `1px solid ${T.bdr}`,
                                  borderRadius: T.r,
                                  background: T.surf,
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                                title="Pick accent color"
                              />
                              <input
                                value={row.c}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCatDraft((d) => d.map((x, i) => (i === idx ? { ...x, c: v } : x)));
                                }}
                                placeholder="#94A3B8"
                                style={{
                                  ...inp,
                                  flex: 1,
                                  padding: "10px 10px",
                                  fontSize: 12,
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label style={lbl}>Background tint</label>
                          <input
                            value={row.bg}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCatDraft((d) => d.map((x, i) => (i === idx ? { ...x, bg: v } : x)));
                            }}
                            placeholder="rgba(148, 163, 184, 0.13)"
                            style={{
                              ...inp,
                              padding: "10px 12px",
                              fontSize: 13,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCatDraft((d) => [...d, { n: "", e: "📦", c: "#94A3B8", bg: "rgba(148,163,184,.13)" }])
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px 14px",
                    borderRadius: T.rLg,
                    border: `1px dashed ${T.bdrH}`,
                    background: T.surf,
                    color: T.sub,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 20,
                  }}
                >
                  <Plus size={16} strokeWidth={2.5} /> Add category
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: T.bdim,
                      border: `1px solid ${T.bdr}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CreditCard size={16} color={T.blue} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Payment methods
                    </div>
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>One method per line</div>
                  </div>
                </div>
                <textarea
                  value={payDraft}
                  onChange={(e) => setPayDraft(e.target.value)}
                  rows={5}
                  placeholder={"Cash\nUPI\nCredit Card"}
                  style={{
                    ...inp,
                    width: "100%",
                    resize: "vertical",
                    fontSize: 14,
                    lineHeight: 1.5,
                    marginBottom: 16,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    minHeight: 112,
                    borderRadius: T.rLg,
                  }}
                />

                <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
                  <button
                    type="button"
                    onClick={() => void saveUserCatalog()}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: T.rLg,
                      background: T.acc,
                      border: "none",
                      color: "#000",
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 8px 24px rgba(34, 197, 94, 0.25)",
                    }}
                  >
                    Save catalog
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetUserCatalogOverrides()}
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      borderRadius: T.rLg,
                      border: `1px solid ${T.bdrH}`,
                      background: T.surf,
                      color: T.sub,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reset to global defaults
                  </button>
                </div>
              </div>
            </div>

            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                <Users size={15} /> Split Contacts
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {people.map((p) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, background: T.card2, borderRadius: 999, padding: "6px 12px", border: `1px solid ${T.bdr}` }}>
                    <span style={{ fontSize: 13 }}>👤 {p}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = people.filter((x) => x !== p);
                        if (uidRef.current) {
                          try {
                            await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { people: next }, { merge: true });
                          } catch (e) {
                            console.error(e);
                          }
                        } else {
                          setPeople(next);
                        }
                      }}
                      style={{ background: "none", border: "none", color: T.mut, cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Add person…"
                  value={newP}
                  onChange={(e) => setNewP(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && newP.trim()) {
                      const name = newP.trim();
                      const next = [...people, name];
                      if (uidRef.current) {
                        try {
                          await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { people: next }, { merge: true });
                        } catch (err) {
                          console.error(err);
                        }
                      } else {
                        setPeople(next);
                      }
                      setNewP("");
                    }
                  }}
                  style={{ ...inp, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newP.trim()) return;
                    const name = newP.trim();
                    const next = [...people, name];
                    if (uidRef.current) {
                      try {
                        await setDoc(doc(db, "users", uidRef.current, "settings", "app"), { people: next }, { merge: true });
                      } catch (err) {
                        console.error(err);
                      }
                    } else {
                      setPeople(next);
                    }
                    setNewP("");
                  }}
                  style={{ padding: "0 18px", borderRadius: T.r, background: T.acc, border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}
                >
                  Add
                </button>
              </div>
            </div>

            {(footerLine1 || footerLine2) && (
              <div style={{ textAlign: "center", padding: "10px 0 0" }}>
                {footerLine1 ? (
                  <div style={{ fontSize: 13, color: T.mut }}>{footerLine1}</div>
                ) : null}
                {footerLine2 ? (
                  <div style={{ fontSize: 12, color: T.mut, marginTop: 3 }}>{footerLine2}</div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {saveToast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 96,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: Math.min(shellMax - 24, 520),
            padding: `0 ${px}px`,
            zIndex: 150,
            pointerEvents: "none",
          }}
        >
          <div
            className="pop"
            style={{
              background: T.card2,
              border: `1px solid ${T.acc}`,
              color: T.txt,
              borderRadius: T.rLg,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              textAlign: "center",
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Check size={18} color={T.acc} strokeWidth={3} />
            <span>
              Expense saved — <span style={{ color: T.acc }}>{saveToast}</span>
            </span>
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: shellMax,
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
          { id: "home", icon: <Home size={21} />, label: "Home" },
          { id: "analytics", icon: <BarChart2 size={21} />, label: "Analytics" },
          { id: "ADD", icon: null, label: "" },
          { id: "budgets", icon: <Wallet size={21} />, label: "Budgets" },
          { id: "profile", icon: <User size={21} />, label: "Profile" },
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
                  boxShadow: "0 4px 22px rgba(34,197,94,0.45)",
                  transform: "translateY(-12px)",
                }}
              >
                <Plus size={28} color="#000" strokeWidth={3} />
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
  );
}

