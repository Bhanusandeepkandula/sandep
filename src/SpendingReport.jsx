import { useState, useMemo, useEffect, useCallback } from "react";
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
  Legend,
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
} from "lucide-react";
import { T, card } from "./config.js";
import { CategoryIcon } from "./categoryIcons.jsx";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const COMP_COLORS = [T.acc, T.purp, "#60A5FA", "#F472B6", "#FBBF24", "#22D3EE", "#FB923C", "#94A3B8"];

function weekStart(d) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay());
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function isoStr(d) {
  return d.toISOString().slice(0, 10);
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(mk) {
  const [y, m] = mk.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function buildWeeklyComparison(txs) {
  const now = new Date();
  const thisWeekStart = weekStart(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek = [];
  const lastWeek = [];

  txs.forEach((tx) => {
    const d = new Date(tx.date + "T00:00:00");
    if (d >= thisWeekStart) thisWeek.push(tx);
    else if (d >= lastWeekStart && d < thisWeekStart) lastWeek.push(tx);
  });

  const thisTotal = thisWeek.reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastWeek.reduce((s, t) => s + t.amount, 0);
  const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;

  const thisCats = {};
  const lastCats = {};
  thisWeek.forEach((t) => { thisCats[t.category] = (thisCats[t.category] || 0) + t.amount; });
  lastWeek.forEach((t) => { lastCats[t.category] = (lastCats[t.category] || 0) + t.amount; });

  const allCats = [...new Set([...Object.keys(thisCats), ...Object.keys(lastCats)])];
  const catComparison = allCats
    .map((cat) => ({
      name: cat,
      thisWeek: thisCats[cat] || 0,
      lastWeek: lastCats[cat] || 0,
      diff: (thisCats[cat] || 0) - (lastCats[cat] || 0),
    }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return { thisTotal, lastTotal, change, catComparison, thisCount: thisWeek.length, lastCount: lastWeek.length };
}

function buildMonthlyComparison(txs) {
  const now = new Date();
  const thisMonth = monthKey(now);
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastDate);

  const thisTxs = [];
  const lastTxs = [];

  txs.forEach((tx) => {
    const d = new Date(tx.date + "T00:00:00");
    const mk = monthKey(d);
    if (mk === thisMonth) thisTxs.push(tx);
    else if (mk === lastMonth) lastTxs.push(tx);
  });

  const thisTotal = thisTxs.reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastTxs.reduce((s, t) => s + t.amount, 0);
  const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;

  const thisCats = {};
  const lastCats = {};
  thisTxs.forEach((t) => { thisCats[t.category] = (thisCats[t.category] || 0) + t.amount; });
  lastTxs.forEach((t) => { lastCats[t.category] = (lastCats[t.category] || 0) + t.amount; });

  const allCats = [...new Set([...Object.keys(thisCats), ...Object.keys(lastCats)])];
  const catComparison = allCats
    .map((cat) => ({
      name: cat,
      thisMonth: thisCats[cat] || 0,
      lastMonth: lastCats[cat] || 0,
      diff: (thisCats[cat] || 0) - (lastCats[cat] || 0),
    }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const thisPay = {};
  const lastPay = {};
  thisTxs.forEach((t) => { thisPay[t.payment || "Unknown"] = (thisPay[t.payment || "Unknown"] || 0) + t.amount; });
  lastTxs.forEach((t) => { lastPay[t.payment || "Unknown"] = (lastPay[t.payment || "Unknown"] || 0) + t.amount; });

  const dailySpend = {};
  thisTxs.forEach((t) => { dailySpend[t.date] = (dailySpend[t.date] || 0) + t.amount; });
  const dailyArr = Object.entries(dailySpend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => ({ day: new Date(d + "T00:00:00").getDate(), amount: v }));

  return {
    thisTotal, lastTotal, change, catComparison,
    thisCount: thisTxs.length, lastCount: lastTxs.length,
    thisMonth, lastMonth,
    thisLabel: monthLabel(thisMonth), lastLabel: monthLabel(lastMonth),
    thisPay, lastPay, dailyArr,
  };
}

const REPORT_LS_KEY = "track_spending_report_v1";

function loadCachedReport(uid) {
  try {
    const raw = localStorage.getItem(`${REPORT_LS_KEY}_${uid || "anon"}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveCachedReport(uid, report) {
  try {
    localStorage.setItem(`${REPORT_LS_KEY}_${uid || "anon"}`, JSON.stringify(report));
  } catch { /* ignore */ }
}

function shouldAutoGenerate(uid, reportFreq) {
  const cached = loadCachedReport(uid);
  if (!cached?.generatedAt) return true;
  const lastGen = new Date(cached.generatedAt);
  const now = new Date();
  if (reportFreq === "daily") {
    return isoStr(now) !== isoStr(lastGen);
  }
  if (reportFreq === "monthly") {
    return monthKey(now) !== monthKey(lastGen) && now.getDate() <= 3;
  }
  const thisWs = weekStart(now);
  const lastWs = weekStart(lastGen);
  return thisWs.getTime() !== lastWs.getTime() && now.getDay() <= 1;
}

function ChangeArrow({ val }) {
  if (val > 0) return <TrendingUp size={14} color={T.dng} />;
  if (val < 0) return <TrendingDown size={14} color={T.acc} />;
  return null;
}

function ChangeBadge({ val, formatMoney }) {
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
  reportFreq = "weekly",
  px = 20,
  splitAnalytics = null,
}) {
  const [report, setReport] = useState(() => loadCachedReport(uid));
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  /* Fixed expense category names — used to split discretionary from mandatory */
  const fixedCats = useMemo(() => new Set(fixedExpenses.map((f) => f.category).filter(Boolean)), [fixedExpenses]);
  const fixedNames = useMemo(() => new Set(fixedExpenses.map((f) => (f.name || "").toLowerCase().trim())), [fixedExpenses]);

  /* Only discretionary transactions (not in a fixed-expense category) */
  const discretionaryTxs = useMemo(() =>
    txs.filter((t) => !fixedCats.has(t.category) && !fixedNames.has((t.notes || "").toLowerCase().trim())),
    [txs, fixedCats, fixedNames]
  );

  const weekly = useMemo(() => buildWeeklyComparison(discretionaryTxs), [discretionaryTxs]);
  const monthly = useMemo(() => buildMonthlyComparison(discretionaryTxs), [discretionaryTxs]);

  const weekBarData = useMemo(() =>
    weekly.catComparison.slice(0, 6).map((c) => ({
      name: c.name.length > 8 ? c.name.slice(0, 7) + "…" : c.name,
      "This Week": c.thisWeek,
      "Last Week": c.lastWeek,
    })),
    [weekly]
  );

  const monthBarData = useMemo(() =>
    monthly.catComparison.slice(0, 6).map((c) => ({
      name: c.name.length > 8 ? c.name.slice(0, 7) + "…" : c.name,
      [monthly.thisLabel]: c.thisMonth,
      [monthly.lastLabel]: c.lastMonth,
    })),
    [monthly]
  );

  const monthPayPieData = useMemo(() => {
    const entries = Object.entries(monthly.thisPay).sort(([, a], [, b]) => b - a);
    return entries.map(([name, value], i) => ({ name, value, c: COMP_COLORS[i % COMP_COLORS.length] }));
  }, [monthly]);

  const biggestIncreases = useMemo(() =>
    monthly.catComparison.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3),
    [monthly]
  );
  const biggestDecreases = useMemo(() =>
    monthly.catComparison.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3),
    [monthly]
  );

  const generateReport = useCallback(async () => {
    const openAiKey = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();
    if (!openAiKey) return;
    setLoading(true);

    const currency = currencyCode || "INR";
    /* Condensed split bill snapshot fed to the report model so recommendations
     * can cover peer balances and unrecovered money alongside category spend. */
    const splitSnapshot = splitAnalytics && splitAnalytics.splitCount > 0 ? {
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
      })),
      topCategoriesByVolume: splitAnalytics.byCategory.slice(0, 5).map((c) => ({ name: c.name, value: Math.round(c.value) })),
    } : null;

    const now = new Date();
    const dayOfMonth = now.getDate();
    /* Use only discretionary totals for projections */
    const projectedMonthEnd = dayOfMonth > 0 ? Math.round((monthly.thisTotal / dayOfMonth) * 30) : 0;
    const top5Txs = [...discretionaryTxs]
      .filter((t) => { const d = new Date(t.date + "T00:00:00"); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => ({ date: t.date, amount: t.amount, category: t.category, notes: t.notes || "" }));
    const catFreq = {};
    discretionaryTxs.forEach((t) => { catFreq[t.category] = (catFreq[t.category] || 0) + 1; });
    const topCatsByFreq = Object.entries(catFreq).sort(([,a],[,b]) => b-a).slice(0,5).map(([c,n]) => ({ category: c, count: n }));
    const discretionaryBudget = Math.max(0, monthlyBudgetTotal - fixedTotal);
    const data = {
      currency,
      dayOfMonth,
      note: "All spending figures below are DISCRETIONARY only — mandatory/fixed expenses are listed separately and must NOT be targeted in recommendations.",
      projectedDiscretionaryMonthEnd: projectedMonthEnd,
      discretionaryBudget,
      weekly: {
        thisWeekDiscretionary: weekly.thisTotal,
        lastWeekDiscretionary: weekly.lastTotal,
        changePercent: Math.round(weekly.change),
        transactionCounts: { thisWeek: weekly.thisCount, lastWeek: weekly.lastCount },
        topChanges: weekly.catComparison.slice(0, 8),
      },
      monthly: {
        thisMonthDiscretionary: monthly.thisTotal,
        lastMonthDiscretionary: monthly.lastTotal,
        changePercent: Math.round(monthly.change),
        thisMonth: monthly.thisLabel,
        lastMonth: monthly.lastLabel,
        transactionCounts: { thisMonth: monthly.thisCount, lastMonth: monthly.lastCount },
        avgDailyDiscretionary: dayOfMonth > 0 ? Math.round(monthly.thisTotal / dayOfMonth) : 0,
        topChanges: monthly.catComparison.slice(0, 10),
        paymentMethods: monthly.thisPay,
      },
      mandatoryFixedExpenses: {
        totalFixed: fixedTotal,
        items: fixedExpenses.map((f) => ({ name: f.name, amount: f.amount, category: f.category })),
        pctOfBudget: monthlyBudgetTotal > 0 ? Math.round((fixedTotal / monthlyBudgetTotal) * 100) : 0,
      },
      budgets: Object.entries(budgets)
        .filter(([cat]) => !fixedCats.has(cat))
        .map(([cat, limit]) => ({
          cat, limit, spent: catSpent[cat] || 0,
          pct: Math.round(((catSpent[cat] || 0) / limit) * 100),
          status: (catSpent[cat] || 0) > limit ? "over" : (catSpent[cat] || 0) >= limit * 0.8 ? "near" : "ok",
        })),
      overallCap: monthlyBudgetTotal,
      top5DiscretionaryTransactions: top5Txs,
      topCategoriesByFrequency: topCatsByFreq,
      splits: splitSnapshot,
    };

    try {
      const r = await fetch(OPENAI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.6,
          max_tokens: 1500,
          messages: [
            {
              role: "system",
              content:
                `You are a personal finance analyst. Analyse ONLY the DISCRETIONARY spending data provided — mandatory/fixed expenses are listed separately under mandatoryFixedExpenses and MUST NOT appear in recommendations or alerts. ` +
                `All amounts and category names come from real user data — never invent figures. ` +
                `Return ONLY valid JSON with this exact structure: ` +
                `{"summary": "3-4 sentence overview of discretionary spending this month: total, projected month-end, top discretionary category, and key trend in ${currency}", ` +
                `"weekHighlight": "1-2 sentences on this week vs last week discretionary spend with exact amounts", ` +
                `"monthHighlight": "1-2 sentences on this month vs last month discretionary spend with exact amounts and which categories drove the change", ` +
                `"alerts": ["2-4 warnings about discretionary overspending, budget breaches on variable categories, or projected overruns — do NOT flag mandatory expenses here"], ` +
                `"positives": ["2-3 positive findings about reduced variable spending or good discretionary habits"], ` +
                `"recommendations": ["3-5 specific, actionable steps to cut DISCRETIONARY spending with exact ${currency} targets — never suggest cutting rent/EMI/mandatory items"], ` +
                `"fixedInsight": "2-3 sentences specifically about the mandatory expenses: their total, what % of budget they consume, and ONE concrete long-term strategy to reduce the largest fixed cost (e.g. refinance, negotiate, switch plan)", ` +
                `"score": number 1-100 for overall financial health based on discretionary spending vs discretionary budget}` +
                ` When splits is present, one recommendation MUST address outstanding balances. ` +
                ` When projectedDiscretionaryMonthEnd > discretionaryBudget, flag as critical alert. ` +
                `No markdown, no explanation, ONLY the JSON object.`,
            },
            { role: "user", content: `Spending data:\n${JSON.stringify(data, null, 2)}` },
          ],
        }),
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("Report error", d?.error?.message || r.status);
        setLoading(false);
        return;
      }
      const raw = String(d?.choices?.[0]?.message?.content || "{}").trim();
      let parsed = {};
      try {
        parsed = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim());
      } catch { /* ignore */ }

      const result = { ...parsed, generatedAt: Date.now() };
      setReport(result);
      saveCachedReport(uid, result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [txs, weekly, monthly, budgets, catSpent, fixedTotal, monthlyBudgetTotal, currencyCode, uid, splitAnalytics]);

  useEffect(() => {
    if (txs.length > 0 && shouldAutoGenerate(uid, reportFreq)) {
      generateReport();
    }
  }, [uid, reportFreq, txs.length > 0]);

  const scoreColor = report?.score >= 70 ? T.acc : report?.score >= 40 ? T.warn : T.dng;

  return (
    <div style={{ padding: `0 ${px}px 16px` }}>
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
            {loading ? <RefreshCw size={11} className="spin" /> : <RefreshCw size={11} />}
            {loading ? "Generating…" : "Refresh"}
          </button>
          {expanded ? <ChevronUp size={18} color={T.sub} /> : <ChevronDown size={18} color={T.sub} />}
        </div>
      </div>

      {expanded && (
        <>
          {/* ── Score + AI Summary ── */}
          {report?.summary && (
            <div style={{ ...card, marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: `3px solid ${scoreColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>{report.score || "—"}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: T.sub, marginBottom: 2 }}>Financial Health Score</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{report.summary}</div>
                {report.generatedAt && (
                  <div style={{ fontSize: 10, color: T.mut, marginTop: 6 }}>
                    <Calendar size={10} /> Generated {new Date(report.generatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Mandatory Expenses Card ── */}
          {fixedExpenses.length > 0 && (
            <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${T.purp}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Mandatory Expenses</div>
                  <div style={{ fontSize: 11, color: T.sub }}>Fixed commitments — excluded from discretionary analysis</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.purp }}>{formatMoney(fixedTotal)}</div>
                  {monthlyBudgetTotal > 0 && (
                    <div style={{ fontSize: 10, color: T.sub }}>{Math.round((fixedTotal / monthlyBudgetTotal) * 100)}% of budget</div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: report?.fixedInsight ? 10 : 0 }}>
                {fixedExpenses.map((fe, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: `${T.purp}10` }}>
                    <div style={{ fontSize: 13 }}>{fe.name}</div>
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
                  Generate a report to get AI tips on reducing these costs.
                </div>
              )}
            </div>
          )}

          {fixedExpenses.length > 0 && (
            <div style={{ fontSize: 11, color: T.sub, background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: "7px 12px", marginBottom: 12 }}>
              Figures below are <strong style={{ color: T.txt }}>discretionary only</strong> — mandatory expenses above are excluded.
            </div>
          )}

          {/* ── Week-over-Week ── */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Week vs Week</div>
              <ChangeBadge val={weekly.change} formatMoney={formatMoney} />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: `${T.purp}12` }}>
                <div style={{ fontSize: 10, color: T.sub }}>This Week</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(weekly.thisTotal)}</div>
                <div style={{ fontSize: 10, color: T.sub }}>{weekly.thisCount} txns</div>
              </div>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: `${T.sub}12` }}>
                <div style={{ fontSize: 10, color: T.sub }}>Last Week</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.sub }}>{formatMoney(weekly.lastTotal)}</div>
                <div style={{ fontSize: 10, color: T.sub }}>{weekly.lastCount} txns</div>
              </div>
            </div>
            {weekBarData.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekBarData} margin={{ left: 0, right: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.sub }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [formatMoney(v)]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.txt, fontSize: 11 }} />
                  <Bar dataKey="This Week" fill={T.purp} radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="Last Week" fill={`${T.sub}55`} radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {report?.weekHighlight && (
              <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.4, borderLeft: `2px solid ${T.purp}`, paddingLeft: 10 }}>
                {report.weekHighlight}
              </div>
            )}
          </div>

          {/* ── Month-over-Month ── */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Month vs Month</div>
              <ChangeBadge val={monthly.change} formatMoney={formatMoney} />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: `${T.acc}12` }}>
                <div style={{ fontSize: 10, color: T.sub }}>{monthly.thisLabel}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(monthly.thisTotal)}</div>
                <div style={{ fontSize: 10, color: T.sub }}>{monthly.thisCount} txns</div>
              </div>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: `${T.sub}12` }}>
                <div style={{ fontSize: 10, color: T.sub }}>{monthly.lastLabel}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.sub }}>{formatMoney(monthly.lastTotal)}</div>
                <div style={{ fontSize: 10, color: T.sub }}>{monthly.lastCount} txns</div>
              </div>
            </div>
            {monthBarData.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthBarData} margin={{ left: 0, right: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.sub }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [formatMoney(v)]} contentStyle={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.txt, fontSize: 11 }} />
                  <Bar dataKey={monthly.thisLabel} fill={T.acc} radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey={monthly.lastLabel} fill={`${T.sub}55`} radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {report?.monthHighlight && (
              <div style={{ fontSize: 12, color: T.sub, marginTop: 8, lineHeight: 1.4, borderLeft: `2px solid ${T.acc}`, paddingLeft: 10 }}>
                {report.monthHighlight}
              </div>
            )}
          </div>

          {/* ── Biggest Changes ── */}
          {(biggestIncreases.length > 0 || biggestDecreases.length > 0) && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Biggest Changes (Month)</div>
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

          {/* ── Payment Split Pie (this month) ── */}
          {monthPayPieData.length > 0 && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Payment Split ({monthly.thisLabel})</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={monthPayPieData} cx="50%" cy="50%" innerRadius={26} outerRadius={42} paddingAngle={3} dataKey="value" stroke="none">
                      {monthPayPieData.map((e, i) => <Cell key={i} fill={e.c} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {monthPayPieData.map((b) => (
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

          {/* ── AI Alerts & Positives ── */}
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

          {report?.recommendations?.length > 0 && (
            <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${T.purp}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Recommendations</div>
              {report.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: T.sub, marginBottom: 4, lineHeight: 1.4, paddingLeft: 2 }}>{i + 1}. {r}</div>
              ))}
            </div>
          )}

          {!report?.summary && !loading && (
            <div style={{ ...card, textAlign: "center", padding: 28 }}>
              <FileText size={36} color={T.purp} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No Report Yet</div>
              <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
                Tap "Refresh" to generate your first spending analysis with AI-powered week and month comparisons.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
