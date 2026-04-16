import { useState, useEffect, useRef } from "react";
import { X, Trash2, Users, Pencil, Check, ImageIcon, ShoppingBag, CheckCircle2 } from "lucide-react";
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
  splitContacts = [],
  onSaveSplit,
}) {
  const [splitOn, setSplitOn] = useState(false);
  const [splitType, setSplitType] = useState("equal");
  const [splitPpl, setSplitPpl] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [imgOpen, setImgOpen] = useState(false);
  const [splitSaved, setSplitSaved] = useState(false);
  const splitTimerRef = useRef(null);
  const dlg = useDialog();

  useEffect(() => { setEditing(false); setEditDraft(null); }, [tx?.id]);

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

  useEffect(() => {
    if (!tx) return;
    if (tx.split?.people?.length) {
      setSplitOn(true);
      setSplitType(tx.split.type === "custom" ? "custom" : "equal");
      setSplitPpl(tx.split.people.map((p) => ({ n: p.n, a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0 })));
    } else {
      setSplitOn(false);
      setSplitType("equal");
      setSplitPpl([]);
    }
  }, [tx?.id]);

  if (!tx) return null;

  const cat = getCat(categories, tx.category);
  const hasLineItems = Array.isArray(tx.lineItems) && tx.lineItems.length > 0;
  const hasTags = Array.isArray(tx.tags) && tx.tags.length > 0;
  const txAmt = Number(tx.amount) || 0;
  const canEditSplit = typeof onSaveSplit === "function" && !tx.syncedFromUid;
  const contacts = Array.isArray(splitContacts) ? splitContacts.map(normalizePerson).filter((p) => p.n) : [];

  function toggleSplitPerson(name) {
    setSplitPpl((prev) => {
      const ex = prev.find((p) => p.n === name);
      const nl = ex ? prev.filter((p) => p.n !== name) : [...prev, { n: name, a: 0 }];
      if (splitType === "equal" && txAmt > 0 && nl.length > 0) {
        const each = Math.round((txAmt / nl.length) * 100) / 100;
        return nl.map((p) => ({ ...p, a: each }));
      }
      return nl;
    });
  }
  function applyEqual(list) {
    if (!list.length || txAmt <= 0) return list;
    const each = Math.round((txAmt / list.length) * 100) / 100;
    return list.map((p) => ({ ...p, a: each }));
  }
  function handleSaveSplit() {
    if (!canEditSplit) return;
    if (!splitOn || !splitPpl.length) { onSaveSplit(tx.id, null); return; }
    if (splitType === "custom") {
      const sum = splitPpl.reduce((s, p) => s + (parseFloat(String(p.a)) || 0), 0);
      if (Math.abs(sum - txAmt) > 0.02) {
        dlg.toast(`Custom amounts should add up to ${formatMoney(txAmt)} (currently ${formatMoney(sum)}).`, { type: "warn", duration: 4000 });
        return;
      }
    }
    onSaveSplit(tx.id, { type: splitType, people: splitPpl.map((p) => ({ n: p.n, a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0 })) });
    setSplitSaved(true);
    if (splitTimerRef.current) clearTimeout(splitTimerRef.current);
    splitTimerRef.current = setTimeout(() => setSplitSaved(false), 2500);
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
            {!editing && onEdit && (
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
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>-{formatMoney(tx.amount)}</div>
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
                {tx.split?.people?.length > 0 && (() => {
                  const pplSum = tx.split.people.reduce((s, p) => s + (parseFloat(String(p.a)) || 0), 0);
                  const yourShare = txAmt - pplSum;
                  return (
                    <div style={{ padding: "10px 0" }}>
                      <div style={{ fontSize: 13, color: T.sub, marginBottom: 8 }}>Split</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Users size={11} color={T.acc} /> You</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(yourShare)}</span>
                        </div>
                        {tx.split.people.map((p, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Users size={11} color={T.sub} /> {p.n}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(p.a)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

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

            {/* Split Section */}
            {canEditSplit && (
              <div style={{ padding: "0 16px" }}>
                <div style={{ ...sectionCard, background: splitOn ? `${T.acc}08` : T.card, borderColor: splitOn ? `${T.acc}33` : T.bdr }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: splitOn ? 12 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${T.acc}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Users size={16} color={T.acc} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Split Expense</div>
                        <div style={{ fontSize: 11, color: T.sub }}>Share cost with people</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitOn((prev) => {
                          if (prev) { setSplitPpl([]); if (canEditSplit) onSaveSplit(tx.id, null); return false; }
                          if (tx.split?.people?.length) { setSplitPpl(tx.split.people.map((p) => ({ n: p.n, a: typeof p.a === "number" ? p.a : parseFloat(String(p.a)) || 0 }))); setSplitType(tx.split.type === "custom" ? "custom" : "equal"); }
                          else { setSplitPpl([]); setSplitType("equal"); }
                          return true;
                        });
                      }}
                      style={{ width: 48, height: 28, borderRadius: 999, border: "none", background: splitOn ? T.acc : T.mut, cursor: "pointer", position: "relative", flexShrink: 0, transition: "background .2s" }}
                    >
                      <span style={{ position: "absolute", top: 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", left: splitOn ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </button>
                  </div>

                  {splitOn && (
                    <>
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
                          <button type="button" onClick={handleSaveSplit} disabled={splitPpl.length === 0 || splitSaved}
                            style={{
                              width: "100%", padding: 12, borderRadius: 10, border: "none",
                              background: splitSaved ? T.adim : splitPpl.length === 0 ? T.mut : T.acc,
                              color: splitSaved ? T.acc : splitPpl.length === 0 ? T.sub : T.btnTxt,
                              fontWeight: 800, fontSize: 14,
                              cursor: splitPpl.length === 0 || splitSaved ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                              transition: "all .25s ease",
                            }}>
                            {splitSaved ? <><CheckCircle2 size={16} /> Saved!</> : <><Check size={16} /> Save Split</>}
                          </button>

                          {splitSaved && splitPpl.length > 0 && (
                            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: T.adim, border: `1px solid ${T.acc}33` }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.acc, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Split Summary</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                  <span style={{ color: T.sub }}>You</span>
                                  <span style={{ fontWeight: 700 }}>{formatMoney(txAmt - splitPpl.reduce((s, p) => s + (parseFloat(String(p.a)) || 0), 0))}</span>
                                </div>
                                {splitPpl.map((p, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                    <span style={{ color: T.sub }}>{p.n}</span>
                                    <span style={{ fontWeight: 700 }}>{formatMoney(parseFloat(String(p.a)) || 0)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Delete */}
            <div style={{ padding: "6px 16px 36px" }}>
              <button type="button" onClick={handleDelete}
                style={{ width: "100%", padding: 12, borderRadius: 12, background: T.ddim, border: `1px solid ${T.dng}44`, color: T.dng, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Trash2 size={15} /> Delete Transaction
              </button>
            </div>
          </>
        )}
      </div>
    </div>

    {/* Full-screen receipt viewer */}
    {imgOpen && tx.receiptUrl && (
      <div onClick={() => setImgOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <button type="button" onClick={() => setImgOpen(false)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={20} color="#fff" />
        </button>
        <img src={tx.receiptUrl} alt="Receipt" style={{ maxWidth: "94vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
      </div>
    )}
    </>
  );
}
