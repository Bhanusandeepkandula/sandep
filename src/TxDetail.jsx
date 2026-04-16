import { useState, useEffect } from "react";
import { X, Trash2, Users } from "lucide-react";
import { T, inp, pill } from "./config.js";
import { getCat, fDate } from "./utils.js";
import { normalizePerson, personStableKey } from "./splitContactShare.js";

/**
 * Bottom-sheet overlay showing full transaction details.
 * Optional split editor when `onSaveSplit` + `splitContacts` are provided.
 */
export function TxDetail({
  tx,
  categories,
  formatMoney,
  dateLocale,
  onClose,
  onDelete,
  splitContacts = [],
  onSaveSplit,
}) {
  const [splitOn, setSplitOn] = useState(false);
  const [splitType, setSplitType] = useState("equal");
  const [splitPpl, setSplitPpl] = useState([]);

  useEffect(() => {
    if (!tx) return;
    if (tx.split?.people?.length) {
      setSplitOn(true);
      setSplitType(tx.split.type === "custom" ? "custom" : "equal");
      setSplitPpl(
        tx.split.people.map((p) => ({
          n: p.n,
          a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0,
        }))
      );
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

  function applyEqualFromCount(list) {
    if (!list.length || txAmt <= 0) return list;
    const each = Math.round((txAmt / list.length) * 100) / 100;
    return list.map((p) => ({ ...p, a: each }));
  }

  function handleSaveSplit() {
    if (!canEditSplit) return;
    if (!splitOn || !splitPpl.length) {
      onSaveSplit(tx.id, null);
      return;
    }
    if (splitType === "custom") {
      const sum = splitPpl.reduce((s, p) => s + (parseFloat(String(p.a)) || 0), 0);
      if (Math.abs(sum - txAmt) > 0.02) {
        window.alert(`Custom amounts should add up to ${formatMoney(txAmt)} (currently ${formatMoney(sum)}).`);
        return;
      }
    }
    onSaveSplit(tx.id, {
      type: splitType,
      people: splitPpl.map((p) => ({
        n: p.n,
        a: typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0,
      })),
    });
  }

  function handleDelete() {
    onDelete(tx.id);
    onClose();
  }

  const row = (label, value) =>
    value ? (
      <div
        key={label}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "11px 0",
          borderBottom: `1px solid ${T.bdr}`,
        }}
      >
        <span style={{ fontSize: 13, color: T.sub, flexShrink: 0, marginRight: 12 }}>{label}</span>
        <span
          style={{
            fontSize: 13,
            color: T.txt,
            fontWeight: 500,
            textAlign: "right",
            wordBreak: "break-word",
          }}
        >
          {value}
        </span>
      </div>
    ) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surf,
          borderRadius: "20px 20px 0 0",
          maxHeight: "90vh",
          overflowY: "auto",
          borderTop: `1px solid ${T.bdr}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: T.mut }} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 12px",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: T.txt }}>Transaction Details</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: T.sub,
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {tx.receiptUrl && (
          <div style={{ padding: "0 16px 16px" }}>
            <img
              src={tx.receiptUrl}
              alt="Receipt"
              style={{
                width: "100%",
                borderRadius: 12,
                border: `1px solid ${T.bdr}`,
                maxHeight: 300,
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        )}

        <div style={{ padding: "0 16px 16px", textAlign: "center" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: cat.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              margin: "0 auto 10px",
            }}
          >
            {cat.e}
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: T.txt }}>-{formatMoney(tx.amount)}</div>
          <div
            style={{
              fontSize: 12,
              color: cat.c,
              background: cat.bg,
              borderRadius: 6,
              padding: "2px 10px",
              display: "inline-block",
              marginTop: 6,
            }}
          >
            {tx.category}
          </div>
        </div>

        <div style={{ padding: "0 16px" }}>
          {row("Date", fDate(tx.date, dateLocale) + "  ·  " + tx.date)}
          {row("Payment", tx.payment)}
          {row("Notes", tx.notes || null)}

          {hasTags && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "11px 0",
                borderBottom: `1px solid ${T.bdr}`,
              }}
            >
              <span style={{ fontSize: 13, color: T.sub }}>Tags</span>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {tx.tags.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      background: T.card2 || "#1C1C32",
                      color: T.sub,
                      borderRadius: 6,
                      padding: "2px 8px",
                      border: `1px solid ${T.bdr}`,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {canEditSplit && (
          <div style={{ padding: "12px 16px 8px" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.sub,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Users size={14} /> Split this expense
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: splitOn ? 12 : 0,
              }}
            >
              <span style={{ fontSize: 13, color: T.sub }}>Share cost with people</span>
              <button
                type="button"
                onClick={() => {
                  setSplitOn((prev) => {
                    if (prev) {
                      setSplitPpl([]);
                      if (canEditSplit) {
                        onSaveSplit(tx.id, null);
                      }
                      return false;
                    }
                    if (tx.split?.people?.length) {
                      setSplitPpl(
                        tx.split.people.map((p) => ({
                          n: p.n,
                          a: typeof p.a === "number" ? p.a : parseFloat(String(p.a)) || 0,
                        }))
                      );
                      setSplitType(tx.split.type === "custom" ? "custom" : "equal");
                    } else {
                      setSplitPpl([]);
                      setSplitType("equal");
                    }
                    return true;
                  });
                }}
                style={{
                  width: 46,
                  height: 28,
                  borderRadius: 999,
                  border: "none",
                  background: splitOn ? T.acc : T.mut,
                  cursor: "pointer",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#fff",
                    left: splitOn ? 21 : 3,
                    transition: "left .2s",
                  }}
                />
              </button>
            </div>

            {splitOn && (
              <>
                {contacts.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.warn, lineHeight: 1.45, marginBottom: 12 }}>
                    Add people under <strong style={{ color: T.txt }}>Profile → Split Contacts</strong> first, then pick them here.
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      {["equal", "custom"].map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => {
                            setSplitType(t);
                            if (t === "equal") {
                              setSplitPpl((prev) => applyEqualFromCount(prev));
                            }
                          }}
                          style={{ ...pill(splitType === t, T.acc), flex: 1 }}
                        >
                          {t === "equal" ? "Equal split" : "Custom amounts"}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Select people:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
                      {contacts.map((p) => {
                        const label = p.n;
                        const sel = splitPpl.find((sp) => sp.n === label);
                        return (
                          <button
                            type="button"
                            key={personStableKey(p)}
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
                            {sel && splitType === "equal" && txAmt > 0 && (
                              <span style={{ fontWeight: 700 }}> {formatMoney(sel.a)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {splitType === "custom" && splitPpl.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {splitPpl.map((p, i) => (
                          <div key={p.n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: T.sub, width: 72 }}>👤 {p.n}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="₹"
                              value={p.a}
                              onChange={(e) =>
                                setSplitPpl((prev) =>
                                  prev.map((x, j) => (j === i ? { ...x, a: e.target.value } : x))
                                )
                              }
                              style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: 13 }}
                            />
                          </div>
                        ))}
                        <div style={{ fontSize: 11, color: T.mut }}>
                          Total must equal {formatMoney(txAmt)}.
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleSaveSplit}
                    disabled={contacts.length === 0 || splitPpl.length === 0}
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "none",
                      background: contacts.length === 0 || splitPpl.length === 0 ? T.mut : T.acc,
                      color: "#000",
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: contacts.length === 0 || splitPpl.length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Save split
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!canEditSplit && tx.split?.people?.length > 0 && (
          <div style={{ padding: "0 16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "11px 0",
                borderBottom: `1px solid ${T.bdr}`,
              }}
            >
              <span style={{ fontSize: 13, color: T.sub }}>Split</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                {tx.split.people.map((p, i) => (
                  <span key={i} style={{ fontSize: 12, color: T.txt }}>
                    {p.n} · {formatMoney(p.a)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasLineItems && (
          <div style={{ padding: "14px 16px 0" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.sub,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Detected items ({tx.lineItems.length})
            </div>
            {tx.lineItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 0",
                  borderBottom: `1px solid ${T.bdr}`,
                }}
              >
                <span style={{ fontSize: 13, color: T.txt, flex: 1, marginRight: 12 }}>{item.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.txt, flexShrink: 0 }}>
                  {formatMoney(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "20px 16px 36px" }}>
          <button
            type="button"
            onClick={handleDelete}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 14,
              background: "rgba(239,68,68,0.10)",
              border: `1px solid ${T.dng}`,
              color: T.dng,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Trash2 size={16} />
            Delete Transaction
          </button>
        </div>
      </div>
    </div>
  );
}
