import { useState, useEffect, useRef } from "react";
import { X, Trash2, Users, Pencil, Check, ImageIcon, ShoppingBag, CheckCircle2, Wallet, BadgeCheck } from "lucide-react";
import { useDialog } from "./AppDialogs.jsx";
import { T, inp, pill } from "./config.js";
import { getCat, fDate } from "./utils.js";
import { CategoryIcon } from "./categoryIcons.jsx";
import { normalizePerson, personStableKey } from "./splitContactShare.js";

export function TxDetail({
  tx,
  categories,
  payments = [],
  formatMoney,
  dateLocale,
  onClose,
  onDelete,
  onEdit,
  onSettle,
  splitContacts = [],
  onSaveSplit,
  selfProfileUuid = "",
  selfFbUid = "",
  selfName = "",
}) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [imgOpen, setImgOpen] = useState(false);

  const [splitEditing, setSplitEditing] = useState(false);
  const [splitType, setSplitType] = useState("equal");
  const [splitPpl, setSplitPpl] = useState([]);
  const [splitSaved, setSplitSaved] = useState(false);
  const splitTimerRef = useRef(null);

  const [settleOpen, setSettleOpen] = useState(false);
  const [settleAmt, setSettleAmt] = useState("");
  const [settleMethod, setSettleMethod] = useState("");

  const dlg = useDialog();

  useEffect(() => {
    setEditing(false); setEditDraft(null); setSplitEditing(false);
    setSettleOpen(false); setSettleAmt(""); setSettleMethod("");
  }, [tx?.id]);

  function startEdit() {
    setEditDraft({
      amount: tx.amount != null ? String(tx.amount) : "",
      date: tx.date || "",
      category: tx.category || "",
      payment: tx.payment || "",
      notes: tx.notes || "",
    });
    setEditing(true);
  }
  function saveEdit() {
    if (!editDraft || !onEdit) return;
    const amt = parseFloat(editDraft.amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDraft.date)) return;
    onEdit(tx.id, { amount: amt, date: editDraft.date, category: editDraft.category, payment: editDraft.payment, notes: editDraft.notes });
    setEditing(false);
    setEditDraft(null);
  }
  function cancelEdit() { setEditing(false); setEditDraft(null); }

  if (!tx) return null;

  const cat = getCat(categories, tx.category);
  const hasLineItems = Array.isArray(tx.lineItems) && tx.lineItems.length > 0;
  const hasTags = Array.isArray(tx.tags) && tx.tags.length > 0;
  const txAmt = Number(tx.amount) || 0;
  const isMirror = Boolean(tx.syncedFromUid);
  const canEditSplit = typeof onSaveSplit === "function" && !isMirror;
  const contacts = Array.isArray(splitContacts) ? splitContacts.map(normalizePerson).filter((p) => p.n) : [];

  const hasSavedSplit = tx.split?.people?.length > 0;
  const peopleSafe = Array.isArray(tx.split?.people) ? tx.split.people : [];

  /* Mirror view perspective — the slave's own entry in the split list, plus the owner's implied share. */
  const selfEntry = isMirror
    ? peopleSafe.find((p) => p && (
        (selfFbUid && typeof p.fuid === "string" && p.fuid === selfFbUid) ||
        (selfProfileUuid && typeof p.u === "string" && p.u === selfProfileUuid)
      ))
    : null;
  const otherPeople = isMirror && selfEntry
    ? peopleSafe.filter((p) => p !== selfEntry)
    : peopleSafe;
  const ownerImpliedShare = (() => {
    if (!isMirror || !hasSavedSplit) return 0;
    const sum = peopleSafe.reduce((s, p) => s + (parseFloat(String(p.a)) || 0), 0);
    return Math.max(0, txAmt - sum);
  })();

  // Slave's share amount — used for settle-up default
  const myShare = selfEntry && typeof selfEntry.a === "number" && Number.isFinite(selfEntry.a)
    ? selfEntry.a
    : txAmt;

  const settlement = tx.settlement || null;
  const isSettled = Boolean(settlement);

  /* Master-side aggregate: how much have peers paid back? Used to reduce the
   * hero amount and to show per-slave "Paid back" rows in the split summary. */
  const masterSettlementsMap = (!isMirror && tx?.settlements && typeof tx.settlements === "object")
    ? tx.settlements : null;
  const masterSettledSum = masterSettlementsMap
    ? Object.values(masterSettlementsMap).reduce((s, v) => s + (parseFloat(String(v?.amount)) || 0), 0)
    : 0;

  /* Effective (remaining) amount shown in the hero.
   *   Slave: share − what I've settled    (→ 0 after full pay-back)
   *   Master: total − paid back by peers  (drops as slaves settle)
   */
  const settledByMe = isMirror ? (parseFloat(String(settlement?.amount)) || 0) : 0;
  const remainingAmt = isMirror
    ? Math.max(0, myShare - settledByMe)
    : Math.max(0, txAmt - masterSettledSum);
  const isFullySettled = remainingAmt <= 0.005 && (
    (isMirror && settlement)
    || (!isMirror && masterSettledSum > 0 && masterSettledSum >= txAmt - 0.005)
  );

  function openSettle() {
    setSettleAmt(String(myShare));
    setSettleMethod(payments[0] || "");
    setSettleOpen(true);
  }

  function handleSettle(full) {
    const amt = full ? myShare : parseFloat(settleAmt);
    if (!Number.isFinite(amt) || amt <= 0) {
      dlg.toast("Enter a valid amount", { type: "warn" }); return;
    }
    if (!settleMethod) {
      dlg.toast("Pick a payment method", { type: "warn" }); return;
    }
    onSettle?.(tx.id, { amount: amt, method: settleMethod, settledAt: new Date().toISOString(), full: amt >= myShare - 0.01 });
    setSettleOpen(false);
    dlg.toast(amt >= myShare - 0.01 ? "Fully settled!" : `Partial settlement of ${formatMoney(amt)} recorded`, { type: "success", duration: 3000 });
  }

  function openSplitEditor() {
    if (hasSavedSplit) {
      setSplitPpl(tx.split.people.map((p) => {
        const out = { n: p.n, a: typeof p.a === "number" ? p.a : parseFloat(String(p.a)) || 0 };
        if (p.fuid) out.fuid = p.fuid;
        if (p.u) out.u = p.u;
        if (p.e) out.e = p.e;
        return out;
      }));
      setSplitType(tx.split.type === "custom" ? "custom" : "equal");
    } else {
      setSplitPpl([]);
      setSplitType("equal");
    }
    setSplitEditing(true);
    setSplitSaved(false);
  }

  function toggleSplitPerson(name) {
    setSplitPpl((prev) => {
      const ex = prev.find((p) => p.n === name);
      const nl = ex ? prev.filter((p) => p.n !== name) : [...prev, { n: name, a: 0 }];
      if (splitType === "equal" && txAmt > 0 && nl.length > 0) {
        const each = Math.round((txAmt / (nl.length + 1)) * 100) / 100;
        return nl.map((p) => ({ ...p, a: each }));
      }
      return nl;
    });
  }

  /** Master removes one person from the split and redistributes equally among the rest + owner. */
  function removeSplitPerson(name) {
    setSplitPpl((prev) => {
      const nl = prev.filter((p) => p.n !== name);
      if (splitType === "equal" && txAmt > 0 && nl.length > 0) {
        const each = Math.round((txAmt / (nl.length + 1)) * 100) / 100;
        return nl.map((p) => ({ ...p, a: each }));
      }
      return nl;
    });
    dlg.toast(`${name} removed from split. Amounts adjusted.`, { type: "info", duration: 2500 });
  }

  function applyEqual(list) {
    if (!list.length || txAmt <= 0) return list;
    const each = Math.round((txAmt / (list.length + 1)) * 100) / 100;
    return list.map((p) => ({ ...p, a: each }));
  }

  function handleSaveSplit() {
    if (!canEditSplit) return;
    if (splitPpl.length === 0) {
      onSaveSplit(tx.id, null);
      setSplitEditing(false);
      setSplitSaved(false);
      dlg.toast("Split removed", { type: "info", duration: 2000 });
      return;
    }
    if (splitType === "custom") {
      const sum = splitPpl.reduce((s, p) => s + (parseFloat(String(p.a)) || 0), 0);
      if (Math.abs(sum - txAmt) > 0.02) {
        dlg.toast(`Custom amounts should add up to ${formatMoney(txAmt)} (currently ${formatMoney(sum)}).`, { type: "warn", duration: 4000 });
        return;
      }
    }
    onSaveSplit(tx.id, { type: splitType, people: splitPpl.map((p) => {
      const out = { n: p.n, a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0 };
      if (p.fuid) out.fuid = p.fuid;
      if (p.u) out.u = p.u;
      if (p.e) out.e = p.e;
      return out;
    }) });
    setSplitSaved(true);
    setSplitEditing(false);
    if (splitTimerRef.current) clearTimeout(splitTimerRef.current);
    splitTimerRef.current = setTimeout(() => setSplitSaved(false), 2500);
    dlg.toast("Split saved", { type: "success", duration: 2000 });
  }

  function handleRemoveSplit() {
    if (!canEditSplit) return;
    onSaveSplit(tx.id, null);
    setSplitEditing(false);
    setSplitPpl([]);
    setSplitSaved(false);
    dlg.toast("Split removed", { type: "info", duration: 2000 });
  }

  useEffect(() => () => { if (splitTimerRef.current) clearTimeout(splitTimerRef.current); }, []);
  function handleDelete() { onDelete(tx.id); onClose(); }

  const sectionCard = { background: T.card, borderRadius: 14, border: `1px solid ${T.bdr}`, padding: 14, marginBottom: 10 };
  const detailRow = (label, value, extra) => value ? (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${T.bdr}` }}>
      <span style={{ fontSize: 13, color: T.sub, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: T.txt, fontWeight: 500, textAlign: "right", wordBreak: "break-word", maxWidth: "65%", ...extra }}>{value}</span>
    </div>
  ) : null;

  return (
    <>
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9000, display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "fade-in .2s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surf, borderRadius: "20px 20px 0 0", maxHeight: "92vh", overflowY: "auto", WebkitOverflowScrolling: "touch", borderTop: `1px solid ${T.bdr}`, animation: "sheet-up .3s cubic-bezier(.22,1,.36,1)" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: T.mut }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 10px" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{editing ? "Edit Transaction" : "Transaction Details"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!editing && onEdit && !isMirror && (
              <button type="button" onClick={startEdit} style={{ background: T.adim, border: `1px solid ${T.acc}44`, color: T.acc, cursor: "pointer", padding: "5px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
                <Pencil size={12} /> Edit
              </button>
            )}
            <button type="button" onClick={editing ? cancelEdit : onClose} style={{ background: T.card2, border: "none", color: T.sub, cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {editing && editDraft ? (
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>Amount</label>
              <input type="number" step="0.01" value={editDraft.amount} onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))} style={{ ...inp, padding: "10px 12px" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>Date</label>
              <input type="date" value={editDraft.date} onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))} style={{ ...inp, padding: "10px 12px" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>Category</label>
                <select value={editDraft.category} onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))} style={{ ...inp, padding: "10px 12px" }}>
                  <option value="">—</option>
                  {(categories || []).map((c) => <option key={c.n} value={c.n}>{c.n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>Payment</label>
                <select value={editDraft.payment} onChange={(e) => setEditDraft((d) => ({ ...d, payment: e.target.value }))} style={{ ...inp, padding: "10px 12px" }}>
                  {(payments || []).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>Notes</label>
              <input type="text" value={editDraft.notes} onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Merchant or description" style={{ ...inp, padding: "10px 12px" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={saveEdit} style={{ flex: 2, padding: 14, borderRadius: 12, border: "none", background: T.acc, color: T.btnTxt, fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Check size={16} /> Save
              </button>
              <button type="button" onClick={cancelEdit} style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${T.bdr}`, background: "transparent", color: T.sub, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Hero: Icon + Amount + Category */}
            <div style={{ padding: "4px 16px 16px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", border: `2px solid ${cat.c}33` }}>
                <CategoryIcon name={tx.category} size={26} color={cat.c} />
              </div>
              {/* Primary number is the *remaining* amount for whoever's looking — slaves see
                  what they still owe, master sees unrecovered spend. Full bill stays visible
                  as a muted sub-line so the original total isn't lost. */}
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: isFullySettled ? (T.grn || "#22c55e") : T.txt }}>
                -{formatMoney(remainingAmt)}
              </div>
              {(isMirror ? (settledByMe > 0) : (masterSettledSum > 0)) ? (
                <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                  Bill {formatMoney(txAmt)}
                  {isMirror ? (
                    <> · your share {formatMoney(myShare)} · settled {formatMoney(settledByMe)}</>
                  ) : (
                    <> · recovered {formatMoney(masterSettledSum)}</>
                  )}
                </div>
              ) : null}
              {isFullySettled ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 11, fontWeight: 700, color: T.grn || "#22c55e", background: `${T.grn || "#22c55e"}10`, border: `1px solid ${T.grn || "#22c55e"}44`, borderRadius: 8, padding: "2px 10px", letterSpacing: 0.4 }}>
                  <BadgeCheck size={12} /> FULLY SETTLED
                </div>
              ) : null}
              {tx.notes && <div style={{ fontSize: 14, color: T.sub, marginTop: 4, lineHeight: 1.3 }}>{tx.notes}</div>}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 12, color: cat.c, background: cat.bg, borderRadius: 8, padding: "3px 10px", border: `1px solid ${cat.c}33` }}>
                <CategoryIcon name={tx.category} size={12} color={cat.c} />
                {tx.category}
              </div>
            </div>

            {/* Details Card */}
            <div style={{ padding: "0 16px" }}>
              <div style={sectionCard}>
                {detailRow("Date", fDate(tx.date, dateLocale) + "  ·  " + tx.date)}
                {detailRow("Payment", tx.payment)}
                {hasTags && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.bdr}` }}>
                    <span style={{ fontSize: 13, color: T.sub }}>Tags</span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {tx.tags.map((t, i) => (
                        <span key={i} style={{ fontSize: 11, background: T.card2, color: T.sub, borderRadius: 6, padding: "2px 7px", border: `1px solid ${T.bdr}` }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Split Summary (read-only, when split exists and NOT editing) */}
            {hasSavedSplit && !splitEditing && (() => {
              const pplSum = peopleSafe.reduce((s, p) => s + (parseFloat(String(p.a)) || 0), 0);
              const yourShare = isMirror
                ? (selfEntry ? (parseFloat(String(selfEntry.a)) || 0) : 0)
                : (txAmt - pplSum);
              const ownerLabel = "Owner"; // Future: name lookup by syncedFromUid
              return (
                <div style={{ padding: "0 16px" }}>
                  <div style={{ ...sectionCard, background: `${T.acc}08`, borderColor: `${T.acc}33` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${T.acc}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Users size={14} color={T.acc} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Split</span>
                        {isMirror ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.warn, background: T.wdim, border: `1px solid ${T.warn}44`, borderRadius: 6, padding: "2px 6px", letterSpacing: 0.4 }}>
                            SHARED WITH YOU
                          </span>
                        ) : null}
                      </div>
                      {canEditSplit && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={openSplitEditor}
                            style={{ background: T.adim, border: `1px solid ${T.acc}44`, color: T.acc, cursor: "pointer", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <Pencil size={10} /> Edit
                          </button>
                          <button type="button" onClick={handleRemoveSplit}
                            style={{ background: T.ddim, border: `1px solid ${T.dng}44`, color: T.dng, cursor: "pointer", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <Trash2 size={10} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                    {isMirror ? (
                      <div style={{ fontSize: 11, color: T.sub, marginBottom: 8, lineHeight: 1.45 }}>
                        You can only view this split — the person who added the bill can edit it.
                      </div>
                    ) : null}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                          <Users size={12} color={T.acc} /> {selfName || "You"}{isMirror ? " (you)" : ""}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isMirror && settledByMe > 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.grn || "#22c55e" }}>
                              -{formatMoney(settledByMe)}
                            </span>
                          ) : null}
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.acc, textDecoration: isMirror && settledByMe >= myShare - 0.005 && settledByMe > 0 ? "line-through" : "none" }}>
                            {formatMoney(yourShare)}
                          </span>
                        </div>
                      </div>
                      {isMirror && ownerImpliedShare > 0 ? (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                            <Users size={12} color={T.sub} /> {ownerLabel}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(ownerImpliedShare)}</span>
                        </div>
                      ) : null}
                      {otherPeople.map((p, i) => {
                        /* Master view: look up whether this peer has paid anything back.
                         * Peers are keyed by Firebase uid in `tx.settlements`. */
                        const peerSettlement = !isMirror && masterSettlementsMap && p?.fuid
                          ? masterSettlementsMap[p.fuid]
                          : null;
                        const paidBack = peerSettlement ? (parseFloat(String(peerSettlement.amount)) || 0) : 0;
                        const owedAmt = (parseFloat(String(p.a)) || 0);
                        const peerFullySettled = paidBack > 0 && paidBack >= owedAmt - 0.005;
                        return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                            <Users size={12} color={T.sub} /> {p.n}
                            {peerFullySettled ? (
                              <BadgeCheck size={11} color={T.grn || "#22c55e"} />
                            ) : null}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {paidBack > 0 && !peerFullySettled ? (
                              <span style={{ fontSize: 11, fontWeight: 700, color: T.grn || "#22c55e" }} title={`Paid back ${formatMoney(paidBack)}`}>
                                -{formatMoney(paidBack)}
                              </span>
                            ) : null}
                            <span style={{ fontSize: 13, fontWeight: 700, textDecoration: peerFullySettled ? "line-through" : "none", color: peerFullySettled ? T.sub : T.txt }}>
                              {formatMoney(p.a)}
                            </span>
                            {canEditSplit && (
                              <button type="button"
                                onClick={() => {
                                  const remaining = peopleSafe.filter((x) => x.n !== p.n);
                                  const type = tx.split?.type || "equal";
                                  const adjusted = type === "equal" && txAmt > 0 && remaining.length > 0
                                    ? remaining.map((x) => ({ ...x, a: Math.round((txAmt / (remaining.length + 1)) * 100) / 100 }))
                                    : remaining;
                                  onSaveSplit?.(tx.id, adjusted.length ? { type, people: adjusted } : null);
                                  dlg.toast(`${p.n} removed. Amounts adjusted.`, { type: "info", duration: 2500 });
                                }}
                                title={`Remove ${p.n} from split`}
                                style={{ background: T.ddim, border: `1px solid ${T.dng}44`, color: T.dng, borderRadius: 6, padding: "2px 6px", cursor: "pointer", fontSize: 11, fontWeight: 600, lineHeight: 1 }}>
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Split Editor (only when editing or no saved split + user initiated) */}
            {canEditSplit && (splitEditing || (!hasSavedSplit && !splitSaved)) && (
              <div style={{ padding: "0 16px" }}>
                <div style={{ ...sectionCard, background: splitEditing ? `${T.acc}08` : T.card, borderColor: splitEditing ? `${T.acc}33` : T.bdr }}>
                  {!splitEditing && !hasSavedSplit ? (
                    <button type="button" onClick={openSplitEditor}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit",
                      }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${T.acc}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Users size={16} color={T.acc} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Split Expense</div>
                        <div style={{ fontSize: 11, color: T.sub }}>Tap to split cost with people</div>
                      </div>
                    </button>
                  ) : splitEditing ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: `${T.acc}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Users size={16} color={T.acc} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Split Expense</div>
                            <div style={{ fontSize: 11, color: T.sub }}>Select people and amounts</div>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSplitEditing(false)}
                          style={{ background: T.card2, border: "none", color: T.sub, cursor: "pointer", padding: 6, borderRadius: 8 }}>
                          <X size={16} />
                        </button>
                      </div>

                      {contacts.length === 0 ? (
                        <div style={{ fontSize: 12, color: T.warn, lineHeight: 1.4, padding: "8px 10px", background: T.wdim, borderRadius: 8 }}>
                          Add people under <strong style={{ color: T.txt }}>Profile &rarr; Split Contacts</strong> first.
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                            {["equal", "custom"].map((t) => (
                              <button key={t} type="button" onClick={() => { setSplitType(t); if (t === "equal") setSplitPpl((p) => applyEqual(p)); }}
                                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: splitType === t ? `1.5px solid ${T.acc}` : `1px solid ${T.bdr}`, background: splitType === t ? T.adim : "transparent", color: splitType === t ? T.acc : T.sub, fontSize: 12, fontWeight: splitType === t ? 700 : 500, cursor: "pointer" }}>
                                {t === "equal" ? "Equal split" : "Custom amounts"}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                            {contacts.map((p) => {
                              const sel = splitPpl.find((sp) => sp.n === p.n);
                              return (
                                <button key={personStableKey(p)} type="button" onClick={() => toggleSplitPerson(p.n)}
                                  style={{ padding: "6px 12px", borderRadius: 10, border: sel ? `1.5px solid ${T.acc}` : `1px solid ${T.bdr}`, background: sel ? T.adim : "transparent", color: sel ? T.acc : T.sub, fontSize: 12, fontWeight: sel ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                                  <Users size={12} /> {p.n}
                                  {sel && splitType === "equal" && txAmt > 0 && <span style={{ fontWeight: 700, color: T.acc }}>{formatMoney(sel.a)}</span>}
                                </button>
                              );
                            })}
                          </div>
                          {splitType === "custom" && splitPpl.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              {splitPpl.map((p, i) => (
                                <div key={p.n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                  <span style={{ fontSize: 12, color: T.sub, width: 80, display: "flex", alignItems: "center", gap: 4 }}><Users size={11} /> {p.n}</span>
                                  <input type="number" inputMode="decimal" value={p.a} onChange={(e) => setSplitPpl((prev) => prev.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: 14 }} />
                                </div>
                              ))}
                              <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>Total must equal {formatMoney(txAmt)}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={handleSaveSplit} disabled={splitPpl.length === 0}
                              style={{
                                flex: 2, padding: 12, borderRadius: 10, border: "none",
                                background: splitPpl.length === 0 ? T.mut : T.acc,
                                color: splitPpl.length === 0 ? T.sub : T.btnTxt,
                                fontWeight: 800, fontSize: 14,
                                cursor: splitPpl.length === 0 ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                              }}>
                              <Check size={16} /> Save Split
                            </button>
                            <button type="button" onClick={() => setSplitEditing(false)}
                              style={{
                                flex: 1, padding: 12, borderRadius: 10,
                                border: `1px solid ${T.bdr}`, background: "transparent",
                                color: T.sub, fontSize: 13, fontWeight: 600, cursor: "pointer",
                              }}>
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {/* Receipt Image */}
            {tx.receiptUrl && (
              <div style={{ padding: "0 16px" }}>
                <div style={sectionCard}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <ImageIcon size={13} /> Receipt
                  </div>
                  <button type="button" onClick={() => setImgOpen(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", display: "block" }}>
                    <img src={tx.receiptUrl} alt="Receipt" style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "cover", display: "block" }} />
                  </button>
                </div>
              </div>
            )}

            {/* Line Items */}
            {hasLineItems && (
              <div style={{ padding: "0 16px" }}>
                <div style={sectionCard}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 8, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    <ShoppingBag size={13} /> Items ({tx.lineItems.length})
                  </div>
                  {tx.lineItems.map((item, i) => {
                    const itemName = item.name || item.description || item.item || item.desc || `Item ${i + 1}`;
                    const itemAmt = typeof item.amount === "number" ? item.amount : typeof item.price === "number" ? item.price : typeof item.total === "number" ? item.total : null;
                    const qty = item.quantity || item.qty;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < tx.lineItems.length - 1 ? `1px solid ${T.bdr}` : "none" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>{i + 1}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemName}</div>
                          {qty && <div style={{ fontSize: 11, color: T.sub }}>Qty: {qty}</div>}
                        </div>
                        {itemAmt != null && (
                          <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{formatMoney(itemAmt)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Settle Up (mirrors only) */}
            {isMirror && (
              <div style={{ padding: "0 16px 8px" }}>
                {isSettled && !settleOpen ? (
                  <div style={{ background: `${T.grn || "#22c55e"}10`, border: `1px solid ${T.grn || "#22c55e"}44`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <BadgeCheck size={18} color={T.grn || "#22c55e"} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.grn || "#22c55e" }}>
                            {settlement.full ? "Fully Settled" : "Partially Settled"}
                          </div>
                          <div style={{ fontSize: 11, color: T.sub }}>
                            {formatMoney(settlement.amount)} · {settlement.method} · {fDate(settlement.settledAt?.slice?.(0,10) || settlement.settledAt, dateLocale)}
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={openSettle}
                        style={{ background: "none", border: `1px solid ${T.bdr}`, color: T.sub, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "4px 10px", borderRadius: 8 }}>
                        Update
                      </button>
                    </div>
                  </div>
                ) : null}

                {settleOpen ? (
                  <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Settle Up</div>
                      <button type="button" onClick={() => setSettleOpen(false)}
                        style={{ background: T.card2, border: "none", color: T.sub, cursor: "pointer", padding: 5, borderRadius: 8 }}>
                        <X size={15} />
                      </button>
                    </div>

                    <div style={{ fontSize: 11, color: T.sub, marginBottom: 10 }}>
                      Your share: <strong style={{ color: T.txt }}>{formatMoney(myShare)}</strong>
                    </div>

                    {/* Full / Custom toggle */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <button type="button"
                        onClick={() => setSettleAmt(String(myShare))}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: parseFloat(settleAmt) >= myShare - 0.01 ? `1.5px solid ${T.acc}` : `1px solid ${T.bdr}`, background: parseFloat(settleAmt) >= myShare - 0.01 ? T.adim : "transparent", color: parseFloat(settleAmt) >= myShare - 0.01 ? T.acc : T.sub, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Full {formatMoney(myShare)}
                      </button>
                      <button type="button"
                        onClick={() => setSettleAmt("")}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: settleAmt !== "" && parseFloat(settleAmt) < myShare - 0.01 ? `1.5px solid ${T.acc}` : `1px solid ${T.bdr}`, background: settleAmt !== "" && parseFloat(settleAmt) < myShare - 0.01 ? T.adim : "transparent", color: settleAmt !== "" && parseFloat(settleAmt) < myShare - 0.01 ? T.acc : T.sub, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Custom amount
                      </button>
                    </div>

                    <input
                      type="number" inputMode="decimal" placeholder={`Amount (max ${formatMoney(myShare)})`}
                      value={settleAmt}
                      onChange={(e) => setSettleAmt(e.target.value)}
                      style={{ ...inp, padding: "10px 12px", marginBottom: 10, fontSize: 15 }}
                    />

                    {/* Payment method */}
                    <div style={{ fontSize: 11, color: T.sub, marginBottom: 8 }}>Payment method</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {payments.map((p) => (
                        <button key={p} type="button" onClick={() => setSettleMethod(p)}
                          style={{ padding: "6px 12px", borderRadius: 10, border: settleMethod === p ? `1.5px solid ${T.acc}` : `1px solid ${T.bdr}`, background: settleMethod === p ? T.adim : "transparent", color: settleMethod === p ? T.acc : T.sub, fontSize: 12, fontWeight: settleMethod === p ? 700 : 400, cursor: "pointer" }}>
                          {p}
                        </button>
                      ))}
                    </div>

                    <button type="button" onClick={() => handleSettle(false)}
                      disabled={!settleAmt || !settleMethod}
                      style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: !settleAmt || !settleMethod ? T.mut : T.acc, color: !settleAmt || !settleMethod ? T.sub : T.btnTxt, fontSize: 14, fontWeight: 800, cursor: !settleAmt || !settleMethod ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Check size={15} /> Confirm Settlement
                    </button>
                  </div>
                ) : !isSettled ? (
                  <button type="button" onClick={openSettle}
                    style={{ width: "100%", padding: 13, borderRadius: 12, border: `1px solid ${T.acc}44`, background: T.adim, color: T.acc, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 10 }}>
                    <Wallet size={15} /> Settle Up
                  </button>
                ) : null}
              </div>
            )}

            {/* Delete — owner only */}
            <div style={{ padding: "6px 16px 36px" }}>
              {!isMirror && (
                <button type="button" onClick={handleDelete}
                  style={{ width: "100%", padding: 12, borderRadius: 12, background: T.ddim, border: `1px solid ${T.dng}44`, color: T.dng, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Trash2 size={15} /> Delete Transaction
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>

    {/* Full-screen receipt viewer */}
    {imgOpen && tx.receiptUrl && (
      <div onClick={() => setImgOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fade-in .2s ease" }}>
        <button type="button" onClick={() => setImgOpen(false)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={20} color="#fff" />
        </button>
        <img src={tx.receiptUrl} alt="Receipt" style={{ maxWidth: "94vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
      </div>
    )}
    </>
  );
}
