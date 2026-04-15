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
} from "lucide-react";
import { T, card, card2, inp, lbl, pill } from "./config.js";
import { uid, tdStr, dAgo, getCat, fmt, filterTx, tot } from "./utils.js";
import { TxRow } from "./TxRow.jsx";
import { BudgetBar } from "./BudgetBar.jsx";
import { collection, doc, getDoc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { db, auth, initAnalytics } from "./firebase.js";

const API = "/anthropic/v1/messages";

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
  const [splitOn, setSplitOn] = useState(false);
  const [splitType, setSplitType] = useState("equal");
  const [splitPpl, setSplitPpl] = useState([]);
  const [previewImg, setPreviewImg] = useState(null);
  const [scanErr, setScanErr] = useState("");
  const fileRef = useRef();
  const stmtRef = useRef();

  const [tips, setTips] = useState([]);
  const [ldTips, setLdTips] = useState(false);

  const [showBM, setShowBM] = useState(false);
  const [bmCat, setBmCat] = useState("");
  const [bmAmt, setBmAmt] = useState("");

  const [newP, setNewP] = useState("");

  const [fbStatus, setFbStatus] = useState("loading");
  const uidRef = useRef(null);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const { categories, payments, currencyCode, locale, dateLocale, footerLine1, footerLine2 } = catalog;

  const formatMoney = useCallback(
    (n) => fmt(n, { currency: currencyCode || undefined, locale: locale || undefined }),
    [currencyCode, locale]
  );

  useEffect(() => {
    let active = true;
    let unsubTx;
    let unsubSettings;
    let unsubCatalog;

    (async () => {
      try {
        await signInAnonymously(auth);
        const user = auth.currentUser;
        if (!user || !active) return;
        const uid = user.uid;
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

        const settingsSnap = await getDoc(settingsRef);
        if (active && !settingsSnap.exists()) {
          await setDoc(
            settingsRef,
            { budgets: {}, people: [], profileName: "", profileEmail: "" },
            { merge: true }
          );
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
            setDoc(settingsRef, { budgets: {}, people: [], profileName: "", profileEmail: "" }, { merge: true });
            return;
          }
          const d = snap.data();
          if (d.budgets && typeof d.budgets === "object") setBudgets(d.budgets);
          if (Array.isArray(d.people)) setPeople(d.people);
          setProfileName(typeof d.profileName === "string" ? d.profileName : "");
          setProfileEmail(typeof d.profileEmail === "string" ? d.profileEmail : "");
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
          setFbStatus("error");
          setTxs([]);
          setBudgets({});
          setPeople([]);
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
  }, []);

  useEffect(() => {
    if (!payments.length) return;
    setForm((f) => ({
      ...f,
      payment: payments.includes(f.payment) ? f.payment : payments[0],
    }));
  }, [payments]);

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

  const dailyData = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = dAgo(13 - i);
        return {
          label: new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          amount: tot(txs.filter((t) => t.date === d)),
        };
      }),
    [txs]
  );

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

  async function submitForm() {
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) {
      setFErr("Enter a valid amount");
      return;
    }
    if (!form.category) {
      setFErr("⚠️  Category is required — this field cannot be skipped");
      return;
    }
    if (!form.payment) {
      setFErr("Select a payment method");
      return;
    }
    if (!categories.length) {
      setFErr("No categories loaded from Firestore (config/app).");
      return;
    }
    if (!payments.length) {
      setFErr("No payment methods loaded from Firestore (config/app).");
      return;
    }
    setFErr("");
    if (!uidRef.current) {
      setFErr("Cloud sync not ready yet — wait a moment and try again.");
      return;
    }
    const newTx = {
      id: uid(),
      amount: parseFloat(form.amount),
      category: form.category,
      date: form.date,
      payment: form.payment,
      notes: form.notes,
      tags: form.tags ? form.tags.split(",").map((s) => s.trim()) : [],
      split: splitOn && splitPpl.length > 0 ? { type: splitType, people: splitPpl } : null,
    };
    try {
      await setDoc(doc(db, "users", uidRef.current, "transactions", newTx.id), sanitizeForFirestore(newTx));
    } catch (e) {
      console.error(e);
      setFErr("Could not save expense. Check your connection.");
      return;
    }
    setStep("success");
    setTimeout(() => {
      setStep("mode");
      const pay = catalogRef.current.payments[0] || "";
      setForm({ amount: "", category: "", date: tdStr(), payment: pay, notes: "", tags: "" });
      setSplitOn(false);
      setSplitPpl([]);
      setPreviewImg(null);
      setTab("home");
    }, 1800);
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
          setScanErr(
            d.error?.message ||
              (bodyText.length > 180 ? `${bodyText.slice(0, 180)}…` : bodyText) ||
              `Scan request failed (${r.status}). For local dev, set ANTHROPIC_API_KEY and use npm run dev (Vite proxy).`
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
      const d = await r.json();
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
    }
    setLdTips(false);
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
        return nl.map((p) => ({ ...p, a: each.toFixed(2) }));
      }
      return nl;
    });
  }

  const px = 16;

  return (
    <div
      style={{
        background: T.bg,
        color: T.txt,
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);}
        select option{background:#15152A;color:#fff;}
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
            maxWidth: 430,
            zIndex: 200,
            padding: "10px 16px",
            background: T.card2,
            borderBottom: `1px solid ${T.bdr}`,
            fontSize: 12,
            color: T.sub,
            textAlign: "center",
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
            maxWidth: 430,
            zIndex: 200,
            padding: "10px 16px",
            background: T.wdim,
            borderBottom: "1px solid rgba(245,158,11,0.35)",
            fontSize: 12,
            color: T.warn,
            textAlign: "center",
          }}
        >
          Cloud unavailable — expense data could not be loaded.
        </div>
      )}

      <div style={{ paddingBottom: 90, overflowY: "auto", height: "100vh" }}>
        {tab === "home" && (
          <div>
            <div style={{ padding: `${px + 8}px ${px}px ${px}px`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: T.sub }}>{new Date().getHours() < 12 ? "Good Morning" : "Good Evening"} 👋</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>My Expenses</div>
              </div>
              <div
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

            <div style={{ margin: `0 ${px}px 14px`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                {step === "mode" ? "Add Expense" : step === "form" ? "Expense Details" : step === "processing" ? "Scanning Bill…" : "Done!"}
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
                  {categories.length === 0 && (
                    <div style={{ fontSize: 12, color: T.warn, marginBottom: 8 }}>
                      Add a <code style={{ color: T.sub }}>categories</code> array to Firestore <code style={{ color: T.sub }}>config/app</code>.
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
                  onClick={submitForm}
                  style={{
                    width: "100%",
                    padding: 16,
                    borderRadius: T.r,
                    background: T.acc,
                    border: "none",
                    color: "#000",
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: "pointer",
                    marginBottom: 20,
                  }}
                >
                  Add Expense
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "analytics" && (
          <div>
            <div style={{ padding: `${px + 8}px ${px}px ${px}px` }}>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Analytics</div>
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

            {breakdown.length > 0 && (
              <div style={{ margin: `0 ${px}px 14px`, ...card }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Category Breakdown</div>
                <ResponsiveContainer width="100%" height={190}>
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
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.acc} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={T.acc} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.sub }} tickLine={false} axisLine={false} interval={3} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [formatMoney(v), "Spent"]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, fontSize: 12 }} />
                  <Area type="monotone" dataKey="amount" stroke={T.acc} strokeWidth={2} fill="url(#ag)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {breakdown.length > 0 && (
              <div style={{ margin: `0 ${px}px 14px`, ...card }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Top Spending Categories</div>
                <ResponsiveContainer width="100%" height={185}>
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
                <div style={{ width: "100%", maxWidth: 430, background: T.card, borderRadius: "20px 20px 0 0", padding: 24 }}>
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
          <div style={{ padding: `${px + 8}px ${px}px` }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 22 }}>Profile & Settings</div>

            <div style={{ ...card, marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
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
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{profileName.trim() || "—"}</div>
                <div style={{ fontSize: 13, color: T.sub }}>{profileEmail.trim() || "—"}</div>
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

            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Settings</div>
              {[
                { icon: "🔔", label: "Notifications", sub: "Daily reminders & alerts" },
                { icon: "💱", label: "Currency", sub: "INR ₹" },
                { icon: "🗂️", label: "Categories", sub: "Manage custom categories" },
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

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: `${T.surf}F0`,
          backdropFilter: "blur(24px)",
          borderTop: `1px solid ${T.bdr}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "8px 4px",
          zIndex: 99,
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

