import { X, Trash2 } from "lucide-react";
import { T } from "./config.js";
import { getCat, fDate } from "./utils.js";

/**
 * Bottom-sheet overlay showing full transaction details.
 * Shows receipt image, line items, all fields, and a delete button.
 */
export function TxDetail({ tx, categories, formatMoney, dateLocale, onClose, onDelete }) {
  if (!tx) return null;

  const cat = getCat(categories, tx.category);
  const hasLineItems = Array.isArray(tx.lineItems) && tx.lineItems.length > 0;
  const hasTags = Array.isArray(tx.tags) && tx.tags.length > 0;
  const hasSplit = tx.split?.people?.length > 0;

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
    /* dark overlay — click outside to close */
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
      {/* sheet panel */}
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
        {/* drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: T.mut }} />
        </div>

        {/* header */}
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

        {/* receipt image */}
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

        {/* category icon + amount */}
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
          <div style={{ fontSize: 34, fontWeight: 800, color: T.txt }}>
            -{formatMoney(tx.amount)}
          </div>
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

        {/* detail rows */}
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

          {hasSplit && (
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
              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}
              >
                {tx.split.people.map((p, i) => (
                  <span key={i} style={{ fontSize: 12, color: T.txt }}>
                    {p.n} · {formatMoney(p.a)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* line items */}
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
                <span style={{ fontSize: 13, color: T.txt, flex: 1, marginRight: 12 }}>
                  {item.name}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.txt, flexShrink: 0 }}>
                  {formatMoney(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* delete button */}
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
