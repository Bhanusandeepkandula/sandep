import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Calendar,
  AlertTriangle,
  History,
  Target,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { T, card } from "./config.js";
import { CategoryIcon } from "./categoryIcons.jsx";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const COMP_COLORS = [T.acc, T.purp, "#60A5FA", "#F472B6", "#FBBF24", "#22D3EE", "#FB923C", "#94A3B8"];

// ─── Date helpers ──────────────────────────────────────────────────────────
function weekStart(d) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay());
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function isoStr(d) { return d.toISOString().slice(0, 10); }
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(mk) {
  const [y, m] = mk.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
function daysInMonth(mk) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function prevMonthKey(mk) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return monthKey(d);
}

// ─── Analytics helpers ─────────────────────────────────────────────────────
/** Filter txs that fall inside a month key (YYYY-MM). */
function txsForMonth(txs, mk) {
  return txs.filter((t) => (t.date || "").slice(0, 7) === mk);
}

/** Build deep monthly analytics for the AI prompt + UI charts. */
function buildMonthAnalytics(monthTxs, mk) {
  const [y, m] = mk.split("-").map(Number);
  const totalDays = daysInMonth(mk);

  const total = monthTxs.reduce((s, t) => s + t.amount, 0);

  const byCategory = {};
  const byPayment = {};
  const byMerchant = {};
  const byDay = {};
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCount = [0, 0, 0, 0, 0, 0, 0];
  let weekendSpend = 0;
  let weekdaySpend = 0;

  for (let i = 1; i <= totalDays; i++) {
    const key = `${mk}-${String(i).padStart(2, "0")}`;
    byDay[key] = 0;
  }

  monthTxs.forEach((t) => {
    const cat = t.category || "Uncategorized";
    const pay = t.payment || "Unknown";
    const merch = (t.notes || "").trim() || cat;
    byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    byPayment[pay] = (byPayment[pay] || 0) + t.amount;
    byMerchant[merch] = (byMerchant[merch] || 0) + t.amount;
    if (byDay[t.date] !== undefined) byDay[t.date] += t.amount;
    const d = new Date(t.date + "T00:00:00");
    const wd = d.getDay();
    byWeekday[wd] += t.amount;
    weekdayCount[wd] += 1;
    if (wd === 0 || wd === 6) weekendSpend += t.amount;
    else weekdaySpend += t.amount;
  });

  // Week-by-week split inside the month (Week 1 = days 1–7, etc.)
  const weeks = [0, 0, 0, 0, 0];
  monthTxs.forEach((t) => {
    const day = Number((t.date || "").slice(8, 10)) || 1;
    const wi = Math.min(4, Math.floor((day - 1) / 7));
    weeks[wi] += t.amount;
  });

  const dailyArr = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => ({ day: Number(d.slice(8, 10)), date: d, amount: v }));

  const peakDay = dailyArr.reduce((best, d) => (d.amount > (best?.amount || 0) ? d : best), null);

  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  const topMerchants = Object.entries(byMerchant)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  const topPayments = Object.entries(byPayment)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  const topTransactions = [...monthTxs]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
    .map((t) => ({ date: t.date, amount: Math.round(t.amount), category: t.category, notes: (t.notes || "").slice(0, 60), payment: t.payment || "" }));

  return {
    month: mk,
    label: monthLabel(mk),
    year: y,
    monthNum: m,
    totalDays,
    total,
    txCount: monthTxs.length,
    avgTx: monthTxs.length ? total / monthTxs.length : 0,
    byCategory,
    byPayment,
    byMerchant,
    byDay,
    dailyArr,
    weeks,
    byWeekday,
    weekdaySpend,
    weekendSpend,
    peakDay,
    topCategories,
    topMerchants,
    topPayments,
    topTransactions,
  };
}

function percentChange(a, b) {
  if (!b) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
}

// ─── Storage (per-month history) ───────────────────────────────────────────
const HISTORY_LS_KEY = "track_spending_reports_v2";

function historyKey(uid) { return `${HISTORY_LS_KEY}_${uid || "anon"}`; }

function loadHistory(uid) {
  try {
    const raw = localStorage.getItem(historyKey(uid));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveHistory(uid, history) {
  try {
    localStorage.setItem(historyKey(uid), JSON.stringify(history));
  } catch { /* quota */ }
}

function saveMonthReport(uid, mk, entry) {
  const h = loadHistory(uid);
  h[mk] = entry;
  saveHistory(uid, h);
}

function loadMonthReport(uid, mk) {
  const h = loadHistory(uid);
  return h[mk] || null;
}

function shouldAutoGenerate(uid, reportFreq, currentMk) {
  const saved = loadMonthReport(uid, currentMk);
  if (!saved?.generatedAt) return true;
  const lastGen = new Date(saved.generatedAt);
  const now = new Date();
  if (reportFreq === "daily") return isoStr(now) !== isoStr(lastGen);
  if (reportFreq === "monthly") return monthKey(now) !== monthKey(lastGen) && now.getDate() <= 3;
  const thisWs = weekStart(now);
  const lastWs = weekStart(lastGen);
  return thisWs.getTime() !== lastWs.getTime() && now.getDay() <= 1;
}

// ─── UI atoms ──────────────────────────────────────────────────────────────
function ChangeArrow({ val }) {
  if (val > 0) return <TrendingUp size={14} color={T.dng} />;
  if (val < 0) return <TrendingDown size={14} color={T.acc} />;
  return null;
}

function ChangeBadge({ val }) {
  const color = val > 0 ? T.dng : val < 0 ? T.acc : T.sub;
  const bg = val > 0 ? T.ddim : val < 0 ? T.adim : `${T.sub}18`;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 6, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <ChangeArrow val={val} />
      {val > 0 ? "+" : ""}{Math.round(val)}%
    </span>
  );
}

export function SpendingReport({
  txs,
  categories,
  formatMoney,
  currencyCode,
  budgets,
  catSpent,
  fixedTotal,
  fixedExpenses = [],
  monthlyBudgetTotal,
  uid,
  reportFreq = "monthly",
  px = 20,
  splitAnalytics = null,
}) {
  const nowRef = useMemo(() => new Date(), []);
  const currentMk = useMemo(() => monthKey(nowRef), [nowRef]);

  // History: map of mk → { report, snapshot: { txs, fixedExpenses, budgets, monthlyBudgetTotal, currencyCode, analytics } }
  const [history, setHistory] = useState(() => loadHistory(uid));
  const [viewingMk, setViewingMk] = useState(currentMk);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  /* Mandatory/fixed category names — split discretionary from mandatory */
  const fixedCats = useMemo(() => new Set(fixedExpenses.map((f) => f.category).filter(Boolean)), [fixedExpenses]);
  const fixedNames = useMemo(() => new Set(fixedExpenses.map((f) => (f.name || "").toLowerCase().trim())), [fixedExpenses]);

  const isMandatoryTx = useCallback(
    (t) => fixedCats.has(t.category) || fixedNames.has((t.notes || "").toLowerCase().trim()),
    [fixedCats, fixedNames]
  );

  /* Viewing current month → use live data. Viewing past → use snapshot. */
  const isViewingCurrent = viewingMk === currentMk;
  const viewingEntry = !isViewingCurrent ? history[viewingMk] : null;

  const activeTxs = useMemo(() => {
    if (isViewingCurrent) return txs;
    return (viewingEntry?.snapshot?.txs || []);
  }, [isViewingCurrent, txs, viewingEntry]);

  const activeFixed = useMemo(() => {
    if (isViewingCurrent) return fixedExpenses;
    return (viewingEntry?.snapshot?.fixedExpenses || []);
  }, [isViewingCurrent, fixedExpenses, viewingEntry]);

  const activeFixedTotal = useMemo(() => {
    if (isViewingCurrent) return fixedTotal;
    return (viewingEntry?.snapshot?.fixedTotal || 0);
  }, [isViewingCurrent, fixedTotal, viewingEntry]);

  const activeBudgetTotal = useMemo(() => {
    if (isViewingCurrent) return monthlyBudgetTotal;
    return (viewingEntry?.snapshot?.monthlyBudgetTotal || 0);
  }, [isViewingCurrent, monthlyBudgetTotal, viewingEntry]);

  /* Only discretionary transactions (exclude mandatory categories/names) */
  const discretionaryActive = useMemo(
    () => activeTxs.filter((t) => !isMandatoryTx(t)),
    [activeTxs, isMandatoryTx]
  );

  // Current & prior month discretionary analytics
  const thisMk = viewingMk;
  const lastMk = useMemo(() => prevMonthKey(thisMk), [thisMk]);

  const thisMonthTxs = useMemo(() => txsForMonth(discretionaryActive, thisMk), [discretionaryActive, thisMk]);
  const lastMonthTxs = useMemo(() => txsForMonth(discretionaryActive, lastMk), [discretionaryActive, lastMk]);

  const thisAnalytics = useMemo(() => buildMonthAnalytics(thisMonthTxs, thisMk), [thisMonthTxs, thisMk]);
  const lastAnalytics = useMemo(() => buildMonthAnalytics(lastMonthTxs, lastMk), [lastMonthTxs, lastMk]);

  const monthChange = percentChange(thisAnalytics.total, lastAnalytics.total);

  // Week-over-week (still shown, uses current live data only)
  const weeksBarData = useMemo(
    () => thisAnalytics.weeks.slice(0, thisAnalytics.totalDays > 28 ? 5 : 4).map((v, i) => ({
      name: `W${i + 1}`,
      [thisAnalytics.label]: Math.round(v),
      [lastAnalytics.label]: Math.round(lastAnalytics.weeks[i] || 0),
    })),
    [thisAnalytics, lastAnalytics]
  );

  // Category comparison (this vs last) for the viewed month
  const catComparison = useMemo(() => {
    const all = new Set([...Object.keys(thisAnalytics.byCategory), ...Object.keys(lastAnalytics.byCategory)]);
    return [...all].map((name) => ({
      name,
      thisMonth: thisAnalytics.byCategory[name] || 0,
      lastMonth: lastAnalytics.byCategory[name] || 0,
      diff: (thisAnalytics.byCategory[name] || 0) - (lastAnalytics.byCategory[name] || 0),
    })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [thisAnalytics, lastAnalytics]);

  const monthBarData = useMemo(
    () => catComparison.slice(0, 6).map((c) => ({
      name: c.name.length > 8 ? c.name.slice(0, 7) + "…" : c.name,
      [thisAnalytics.label]: Math.round(c.thisMonth),
      [lastAnalytics.label]: Math.round(c.lastMonth),
    })),
    [catComparison, thisAnalytics.label, lastAnalytics.label]
  );

  const paymentPieData = useMemo(() => {
    return thisAnalytics.topPayments.map((p, i) => ({
      name: p.name, value: p.value, c: COMP_COLORS[i % COMP_COLORS.length],
    }));
  }, [thisAnalytics]);

  const dailyLineData = useMemo(
    () => thisAnalytics.dailyArr.map((d) => ({ day: d.day, amount: Math.round(d.amount) })),
    [thisAnalytics]
  );

  const biggestIncreases = catComparison.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3);
  const biggestDecreases = catComparison.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3);

  /* Active report (either live-generated for current or saved for past) */
  const report = history[viewingMk]?.report || null;

  const generateReport = useCallback(async () => {
    const openAiKey = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();
    if (!openAiKey) return;
    setLoading(true);

    try {
      const currency = currencyCode || "USD";
      const now = new Date();
      const dayOfMonth = now.getDate();
      const totalDaysThis = thisAnalytics.totalDays;
      const elapsed = viewingMk === currentMk ? dayOfMonth : totalDaysThis;
      const projectedMonthEnd = elapsed > 0
        ? Math.round((thisAnalytics.total / elapsed) * totalDaysThis)
        : Math.round(thisAnalytics.total);

      const discretionaryBudget = Math.max(0, (activeBudgetTotal || 0) - (activeFixedTotal || 0));

      // Budget status per variable category
      const budgetRows = Object.entries(budgets || {})
        .filter(([cat]) => !fixedCats.has(cat))
        .map(([cat, limit]) => {
          const spent = (catSpent && catSpent[cat]) || thisAnalytics.byCategory[cat] || 0;
          return {
            cat,
            limit: Math.round(limit),
            spent: Math.round(spent),
            pct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
            status: spent > limit ? "over" : spent >= limit * 0.8 ? "near" : "ok",
          };
        });

      const splitSnapshot = splitAnalytics && splitAnalytics.splitCount > 0 ? {
        billCount: splitAnalytics.splitCount,
        totalBillValue: Math.round(splitAnalytics.splitTotalValue),
        outstandingTheyOweYou: Math.round(splitAnalytics.outstandingToYou),
        outstandingYouOweThem: Math.round(splitAnalytics.outstandingFromYou),
        alreadyRecovered: Math.round(splitAnalytics.settledToYou),
        alreadyPaidBack: Math.round(splitAnalytics.settledFromYou),
        netPosition: Math.round(splitAnalytics.netPosition),
        topPeers: splitAnalytics.peers.slice(0, 5).map((p) => ({ name: p.name, net: Math.round(p.net), bills: p.splitCount })),
      } : null;

      const payload = {
        currency,
        todaysDate: isoStr(now),
        reportMonth: thisAnalytics.label,
        reportMonthKey: thisMk,
        previousMonth: lastAnalytics.label,
        previousMonthKey: lastMk,
        isCurrentMonth: viewingMk === currentMk,
        dayOfMonth: viewingMk === currentMk ? dayOfMonth : totalDaysThis,
        daysInMonth: totalDaysThis,
        note: "All spending figures below are DISCRETIONARY only — mandatory/fixed expenses are listed separately under mandatoryFixedExpenses and MUST be excluded from the score and from cost-cutting recommendations.",

        thisMonth: {
          totalDiscretionary: Math.round(thisAnalytics.total),
          txCount: thisAnalytics.txCount,
          avgTransaction: Math.round(thisAnalytics.avgTx),
          projectedMonthEnd,
          discretionaryBudget: Math.round(discretionaryBudget),
          projectedBudgetPct: discretionaryBudget > 0 ? Math.round((projectedMonthEnd / discretionaryBudget) * 100) : null,
          topCategories: thisAnalytics.topCategories.slice(0, 8),
          topMerchants: thisAnalytics.topMerchants,
          topPayments: thisAnalytics.topPayments,
          topTransactions: thisAnalytics.topTransactions,
          weekBreakdown: thisAnalytics.weeks.map((v, i) => ({ week: i + 1, total: Math.round(v) })),
          weekdayVsWeekend: {
            weekday: Math.round(thisAnalytics.weekdaySpend),
            weekend: Math.round(thisAnalytics.weekendSpend),
          },
          peakDay: thisAnalytics.peakDay ? { date: thisAnalytics.peakDay.date, amount: Math.round(thisAnalytics.peakDay.amount) } : null,
          dailySpend: thisAnalytics.dailyArr.map((d) => ({ day: d.day, amount: Math.round(d.amount) })),
        },

        lastMonth: {
          totalDiscretionary: Math.round(lastAnalytics.total),
          txCount: lastAnalytics.txCount,
          topCategories: lastAnalytics.topCategories.slice(0, 8),
          topMerchants: lastAnalytics.topMerchants.slice(0, 5),
        },

        monthOverMonth: {
          changeAmount: Math.round(thisAnalytics.total - lastAnalytics.total),
          changePercent: Math.round(monthChange),
          biggestIncreases: biggestIncreases.map((c) => ({
            category: c.name,
            lastMonth: Math.round(c.lastMonth),
            thisMonth: Math.round(c.thisMonth),
            diff: Math.round(c.diff),
          })),
          biggestDecreases: biggestDecreases.map((c) => ({
            category: c.name,
            lastMonth: Math.round(c.lastMonth),
            thisMonth: Math.round(c.thisMonth),
            diff: Math.round(c.diff),
          })),
        },

        mandatoryFixedExpenses: {
          totalFixed: Math.round(activeFixedTotal || 0),
          items: (activeFixed || []).map((f) => ({
            name: f.name, amount: Math.round(f.amount || 0), category: f.category, dueDay: f.dueDay || null,
          })),
          pctOfBudget: activeBudgetTotal > 0 ? Math.round(((activeFixedTotal || 0) / activeBudgetTotal) * 100) : 0,
        },

        budgets: budgetRows,
        overallCap: Math.round(activeBudgetTotal || 0),
        splits: splitSnapshot,
      };

      const systemPrompt =
        `You are a meticulous personal finance analyst producing a MONTHLY spending report. ` +
        `Use ONLY the numbers in the payload — never invent figures. ` +
        `CRITICAL: the "score" and all cost-cutting recommendations must reflect DISCRETIONARY spending vs discretionary budget ONLY — NEVER include or target mandatoryFixedExpenses (rent, EMI, subscriptions the user marked as fixed). Mandatory expenses are reported separately under fixedInsight. ` +
        `Write in the user's currency (${currency}). Be concrete: cite exact amounts, category names and merchants from the payload. ` +
        `\n\nReturn ONLY valid JSON with this exact shape (no markdown, no fences, no prose outside):\n` +
        `{` +
        `"summary": "4-5 sentence overview of ${thisAnalytics.label} discretionary spending: total, key drivers, pace vs month-end projection, and main story vs ${lastAnalytics.label}.", ` +
        `"score": <integer 1-100 — health of DISCRETIONARY spending vs discretionary budget; ignore mandatory entirely>, ` +
        `"scoreReason": "1-2 sentences justifying the score with specific numbers.", ` +
        `"monthHighlight": "2-3 sentences: how ${thisAnalytics.label} compares to ${lastAnalytics.label}, which categories/merchants drove the change, with amounts.", ` +
        `"weekHighlight": "1-2 sentences about the weekly pattern inside ${thisAnalytics.label} (peak week, trend).", ` +
        `"categoryInsights": [{"category":"<name from payload>","insight":"1 sentence with specific amount or % change"} ... up to 5], ` +
        `"dailyPattern": "1-2 sentences about weekday vs weekend, peak spending day, and daily cadence.", ` +
        `"alerts": ["2-4 concrete warnings about discretionary overspending, budget breaches, projected overruns, or unusual spikes. Do NOT flag mandatory expenses."], ` +
        `"positives": ["2-3 specific wins in discretionary spending vs last month."], ` +
        `"recommendations": ["3-5 specific, actionable steps the user can take NOW to trim discretionary spend, each with an exact ${currency} target and the category/merchant to focus on. Never suggest cutting rent/EMI/mandatory."], ` +
        `"nextMonthTips": ["3-5 forward-looking tips for the UPCOMING month — each one practical (a target amount, a category budget to set, a habit change). Base on this month''s patterns."], ` +
        `"fixedInsight": "2-3 sentences about the mandatory expenses in mandatoryFixedExpenses: the total, % of budget, and ONE long-term strategy to reduce the LARGEST fixed cost (refinance, renegotiate, switch plan). This is the ONLY place mandatory items appear."` +
        `}` +
        `\nRules:` +
        ` - If projectedMonthEnd exceeds discretionaryBudget, alerts MUST include a critical warning with the projected ${currency} overage.` +
        ` - If splits is present and has outstandingTheyOweYou > 0, include a recommendation to collect from the top 1-2 peers by name.` +
        ` - Always output every JSON key; use [] for empty arrays.` +
        ` - Do NOT mention "AI" or "LLM" in prose.`;

      const res = await fetch(OPENAI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          max_tokens: 2200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Payload:\n${JSON.stringify(payload, null, 2)}` },
          ],
        }),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Report error", d?.error?.message || res.status);
        return;
      }
      const raw = String(d?.choices?.[0]?.message?.content || "{}").trim();
      let parsed = {};
      try {
        parsed = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim());
      } catch {
        console.warn("Could not parse report JSON");
      }

      const result = { ...parsed, generatedAt: Date.now(), month: thisMk, monthLabel: thisAnalytics.label };

      // Freeze a snapshot so history can reopen this month exactly as it looked.
      const snapshot = {
        txs: isViewingCurrent ? txs.filter((t) => (t.date || "").startsWith(thisMk) || (t.date || "").startsWith(lastMk)) : activeTxs,
        fixedExpenses: activeFixed,
        fixedTotal: activeFixedTotal,
        monthlyBudgetTotal: activeBudgetTotal,
        budgets: { ...(budgets || {}) },
        currencyCode: currency,
        capturedAt: Date.now(),
      };

      const entry = { report: result, snapshot };
      saveMonthReport(uid, thisMk, entry);
      setHistory((h) => ({ ...h, [thisMk]: entry }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    txs, activeTxs, activeFixed, activeFixedTotal, activeBudgetTotal,
    thisAnalytics, lastAnalytics, monthChange,
    biggestIncreases, biggestDecreases, thisMk, lastMk, viewingMk, currentMk,
    budgets, catSpent, fixedCats, currencyCode, uid, splitAnalytics, isViewingCurrent,
  ]);

  useEffect(() => {
    if (!isViewingCurrent) return;
    if (txs.length > 0 && shouldAutoGenerate(uid, reportFreq, currentMk)) {
      generateReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, reportFreq, txs.length > 0, currentMk]);

  const scoreColor = report?.score >= 70 ? T.acc : report?.score >= 40 ? T.warn : T.dng;

  // Sorted history months (newest first), excluding current
  const historyMonths = useMemo(
    () => Object.keys(history).sort().reverse(),
    [history]
  );

  return (
    <div style={{ padding: `0 ${px}px 16px` }}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((p) => !p); }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? 14 : 0, cursor: "pointer" }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
          <FileText size={17} color={T.purp} /> Spending Report
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isViewingCurrent && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); generateReport(); }}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 8,
                border: `1px solid ${T.purp}`, background: `${T.purp}18`,
                color: T.purp, fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              <RefreshCw size={11} className={loading ? "spin" : ""} />
              {loading ? "Generating…" : "Refresh"}
            </button>
          )}
          {expanded ? <ChevronUp size={18} color={T.sub} /> : <ChevronDown size={18} color={T.sub} />}
        </div>
      </div>

      {expanded && (
        <>
          {/* Viewing banner for historical months */}
          {!isViewingCurrent && (
            <div style={{ ...card, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, borderLeft: `3px solid ${T.purp}` }}>
              <button
                type="button"
                onClick={() => setViewingMk(currentMk)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.bdr}`, background: T.card2, color: T.txt, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                <ArrowLeft size={12} /> Back
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: T.sub }}>Viewing saved report</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{thisAnalytics.label}</div>
              </div>
              {report?.score != null && (
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${scoreColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: scoreColor }}>
                  {report.score}
                </div>
              )}
            </div>
          )}

          {/* History list */}
          {historyMonths.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowHistory((p) => !p)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setShowHistory((p) => !p); }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <History size={14} color={T.purp} /> Report History
                  <span style={{ fontSize: 11, color: T.sub, fontWeight: 500 }}>({historyMonths.length})</span>
                </div>
                {showHistory ? <ChevronUp size={16} color={T.sub} /> : <ChevronDown size={16} color={T.sub} />}
              </div>
              {showHistory && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {historyMonths.map((mk) => {
                    const entry = history[mk];
                    const sc = entry?.report?.score;
                    const total = entry?.snapshot?.txs
                      ? entry.snapshot.txs
                          .filter((t) => (t.date || "").slice(0, 7) === mk && !(fixedCats.has(t.category) || fixedNames.has((t.notes || "").toLowerCase().trim())))
                          .reduce((s, t) => s + t.amount, 0)
                      : 0;
                    const col = sc >= 70 ? T.acc : sc >= 40 ? T.warn : T.dng;
                    const isActive = mk === viewingMk;
                    return (
                      <div
                        key={mk}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setViewingMk(mk); setShowHistory(false); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setViewingMk(mk); setShowHistory(false); } }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 10px", borderRadius: 8,
                          border: `1px solid ${isActive ? T.purp : T.bdr}`,
                          background: isActive ? `${T.purp}12` : T.card2,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: "50%", border: `2px solid ${sc != null ? col : T.bdr}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: sc != null ? col : T.sub, flexShrink: 0 }}>
                          {sc != null ? sc : "—"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {monthLabel(mk)} {mk === currentMk ? <span style={{ fontSize: 10, color: T.acc, fontWeight: 600 }}> · current</span> : null}
                          </div>
                          <div style={{ fontSize: 11, color: T.sub }}>
                            {formatMoney(total)} discretionary · generated {entry?.report?.generatedAt ? new Date(entry.report.generatedAt).toLocaleDateString() : "—"}
                          </div>
                        </div>
                        <ChevronDown size={14} color={T.sub} style={{ transform: "rotate(-90deg)" }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Score + summary */}
          {report?.summary && (
            <div style={{ ...card, marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: `3px solid ${scoreColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>{report.score ?? "—"}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: T.sub, marginBottom: 2 }}>Financial Health Score · {thisAnalytics.label}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{report.summary}</div>
                {report.scoreReason && (
                  <div style={{ fontSize: 11, color: T.sub, marginTop: 6, lineHeight: 1.4, fontStyle: "italic" }}>
                    {report.scoreReason}
                  </div>
                )}
                {report.generatedAt && (
                  <div style={{ fontSize: 10, color: T.mut, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={10} /> Generated {new Date(report.generatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mandatory Expenses Card — always shown when user configured any */}
          {activeFixed.length > 0 && (
            <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${T.purp}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Mandatory Expenses · {thisAnalytics.label}</div>
                  <div style={{ fontSize: 11, color: T.sub }}>From profile · excluded from the score</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.purp }}>{formatMoney(activeFixedTotal)}</div>
                  {activeBudgetTotal > 0 && (
                    <div style={{ fontSize: 10, color: T.sub }}>{Math.round((activeFixedTotal / activeBudgetTotal) * 100)}% of budget</div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: report?.fixedInsight ? 10 : 0 }}>
                {activeFixed.map((fe, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: `${T.purp}10` }}>
                    <div style={{ fontSize: 13 }}>
                      {fe.name}
                      {fe.dueDay ? <span style={{ fontSize: 10, color: T.sub, marginLeft: 6 }}>due {fe.dueDay}</span> : null}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.purp }}>{formatMoney(fe.amount)}</div>
                  </div>
                ))}
              </div>
              {report?.fixedInsight && (
                <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5, borderLeft: `2px solid ${T.purp}`, paddingLeft: 10, marginTop: 2 }}>
                  {report.fixedInsight}
                </div>
              )}
              {!report?.fixedInsight && (
                <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>
                  Generate a report to get AI tips on reducing these fixed costs.
                </div>
              )}
            </div>
          )}

          {activeFixed.length > 0 && (
            <div style={{ fontSize: 11, color: T.sub, background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: "7px 12px", marginBottom: 12 }}>
              Figures below are <strong style={{ color: T.txt }}>discretionary only</strong> — mandatory expenses above are excluded from all scores and comparisons.
            </div>
          )}

          {/* Month vs Month (primary) */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{thisAnalytics.label} vs {lastAnalytics.label}</div>
              <ChangeBadge val={monthChange} />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: `${T.acc}12` }}>
                <div style={{ fontSize: 10, color: T.sub }}>{thisAnalytics.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(thisAnalytics.total)}</div>
                <div style={{ fontSize: 10, color: T.sub }}>{thisAnalytics.txCount} txns</div>
              </div>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: `${T.sub}12` }}>
                <div style={{ fontSize: 10, color: T.sub }}>{lastAnalytics.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.sub }}>{formatMoney(lastAnalytics.total)}</div>
                <div style={{ fontSize: 10, color: T.sub }}>{lastAnalytics.txCount} txns</div>
              </div>
            </div>
            {monthBarData.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthBarData} margin={{ top: 10, left: 0, right: 4, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.sub }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [formatMoney(v)]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.txt, fontSize: 11 }} />
                  <Bar dataKey={thisAnalytics.label} fill={T.acc} radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey={lastAnalytics.label} fill={`${T.sub}55`} radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {report?.monthHighlight && (
              <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.4, borderLeft: `2px solid ${T.acc}`, paddingLeft: 10 }}>
                {report.monthHighlight}
              </div>
            )}
          </div>

          {/* Weekly breakdown within month */}
          {weeksBarData.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Weekly Pattern</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weeksBarData} margin={{ top: 10, left: 0, right: 4, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.sub }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [formatMoney(v)]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.txt, fontSize: 11 }} />
                  <Bar dataKey={thisAnalytics.label} fill={T.purp} radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey={lastAnalytics.label} fill={`${T.sub}55`} radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
              {report?.weekHighlight && (
                <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.4, borderLeft: `2px solid ${T.purp}`, paddingLeft: 10 }}>
                  {report.weekHighlight}
                </div>
              )}
            </div>
          )}

          {/* Daily spend line */}
          {dailyLineData.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Daily Spending</div>
                {thisAnalytics.peakDay && (
                  <div style={{ fontSize: 11, color: T.sub }}>
                    Peak: <strong style={{ color: T.txt }}>{formatMoney(thisAnalytics.peakDay.amount)}</strong>{" "}
                    on {thisAnalytics.peakDay.date?.slice(5)}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={dailyLineData} margin={{ top: 10, left: 0, right: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${T.bdr}55`} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: T.sub }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [formatMoney(v)]} labelFormatter={(l) => `Day ${l}`} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.txt, fontSize: 11 }} />
                  <Line type="monotone" dataKey="amount" stroke={T.acc} strokeWidth={2} dot={{ fill: T.acc, r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
              {report?.dailyPattern && (
                <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.4, borderLeft: `2px solid ${T.acc}`, paddingLeft: 10 }}>
                  {report.dailyPattern}
                </div>
              )}
            </div>
          )}

          {/* Biggest changes */}
          {(biggestIncreases.length > 0 || biggestDecreases.length > 0) && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Biggest Changes</div>
              {biggestIncreases.length > 0 && (
                <div style={{ marginBottom: biggestDecreases.length > 0 ? 12 : 0 }}>
                  <div style={{ fontSize: 11, color: T.dng, fontWeight: 600, marginBottom: 6 }}>Spending Increased</div>
                  {biggestIncreases.map((c) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <CategoryIcon name={c.name} size={16} color={T.dng} />
                      <span style={{ fontSize: 13, flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: T.sub }}>{formatMoney(c.lastMonth)}</span>
                      <ArrowRight size={12} color={T.sub} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.dng }}>{formatMoney(c.thisMonth)}</span>
                      <span style={{ fontSize: 10, color: T.dng }}>+{formatMoney(c.diff)}</span>
                    </div>
                  ))}
                </div>
              )}
              {biggestDecreases.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: T.acc, fontWeight: 600, marginBottom: 6 }}>Spending Decreased</div>
                  {biggestDecreases.map((c) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <CategoryIcon name={c.name} size={16} color={T.acc} />
                      <span style={{ fontSize: 13, flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: T.sub }}>{formatMoney(c.lastMonth)}</span>
                      <ArrowRight size={12} color={T.sub} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.acc }}>{formatMoney(c.thisMonth)}</span>
                      <span style={{ fontSize: 10, color: T.acc }}>{formatMoney(c.diff)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category insights from AI */}
          {report?.categoryInsights?.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Category Insights</div>
              {report.categoryInsights.map((ci, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <CategoryIcon name={ci.category} size={16} color={T.purp} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{ci.category}</div>
                    <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.4 }}>{ci.insight}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Top merchants */}
          {thisAnalytics.topMerchants.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Top Merchants</div>
              {thisAnalytics.topMerchants.slice(0, 6).map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 5 ? `1px solid ${T.bdr}40` : "none" }}>
                  <span style={{ fontSize: 12, color: T.txt, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(m.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payment split */}
          {paymentPieData.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Payment Split · {thisAnalytics.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={26} outerRadius={42} paddingAngle={3} dataKey="value" stroke="none">
                      {paymentPieData.map((e, i) => <Cell key={i} fill={e.c} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {paymentPieData.map((b) => (
                    <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 3, background: b.c, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1 }}>{b.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(b.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Alerts */}
          {report?.alerts?.length > 0 && (
            <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${T.warn}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={14} color={T.warn} /> Alerts
              </div>
              {report.alerts.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: T.sub, marginBottom: 4, lineHeight: 1.4, paddingLeft: 2 }}>• {a}</div>
              ))}
            </div>
          )}

          {/* Positives */}
          {report?.positives?.length > 0 && (
            <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${T.acc}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingDown size={14} color={T.acc} /> Positive Trends
              </div>
              {report.positives.map((p, i) => (
                <div key={i} style={{ fontSize: 12, color: T.sub, marginBottom: 4, lineHeight: 1.4, paddingLeft: 2 }}>• {p}</div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {report?.recommendations?.length > 0 && (
            <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${T.purp}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Target size={14} color={T.purp} /> Recommendations
              </div>
              {report.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: T.sub, marginBottom: 4, lineHeight: 1.4, paddingLeft: 2 }}>{i + 1}. {r}</div>
              ))}
            </div>
          )}

          {/* Next month tips */}
          {report?.nextMonthTips?.length > 0 && (
            <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${T.acc}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} color={T.acc} /> Tips for Next Month
              </div>
              {report.nextMonthTips.map((n, i) => (
                <div key={i} style={{ fontSize: 12, color: T.sub, marginBottom: 4, lineHeight: 1.4, paddingLeft: 2 }}>{i + 1}. {n}</div>
              ))}
            </div>
          )}

          {/* Transactions list — always for historical; current view keeps the main txs list elsewhere */}
          {!isViewingCurrent && thisMonthTxs.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Transactions · {thisAnalytics.label} ({thisMonthTxs.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                {[...thisMonthTxs].sort((a, b) => b.date.localeCompare(a.date)).map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: T.card2 }}>
                    <CategoryIcon name={t.category} size={14} color={T.purp} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.notes || t.category}
                      </div>
                      <div style={{ fontSize: 10, color: T.sub }}>{t.date} · {t.category}{t.payment ? ` · ${t.payment}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(t.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!report?.summary && !loading && (
            <div style={{ ...card, textAlign: "center", padding: 28 }}>
              <FileText size={36} color={T.purp} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No Report Yet</div>
              <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
                Tap "Refresh" to generate your first monthly spending analysis with AI-powered comparisons, tips for next month, and a financial health score.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
