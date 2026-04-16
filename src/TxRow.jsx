import { useState } from "react";
import { MoreVertical, Trash2, ImageIcon } from "lucide-react";
import { T } from "./config.js";
import { getCat, fDate } from "./utils.js";

export function TxRow({ tx, onDelete, categories, formatMoney, dateLocale }) {
  const cat = getCat(categories, tx.category);
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        borderBottom: `1px solid ${T.bdr}`,
        position: "relative",
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: cat.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
          position: "relative",
          overflow: "visible",
        }}
      >
        {cat.e}
        {tx.receiptUrl ? (
          <span
            title="Receipt attached"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 17,
              height: 17,
              borderRadius: 5,
              background: T.surf,
              border: `1px solid ${T.bdr}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }}
          >
            <ImageIcon size={10} color={T.acc} strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: T.txt,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tx.notes || tx.category}
        </div>
        <div style={{ fontSize: 12, color: T.sub, display: "flex", gap: 6, marginTop: 2 }}>
          <span>{fDate(tx.date, dateLocale)}</span>
          <span>·</span>
          <span>{tx.payment}</span>
          {tx.split && (
            <>
              <span>·</span>
              <span style={{ color: T.acc }}>Split</span>
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.txt }}>-{formatMoney(tx.amount)}</div>
        <div style={{ fontSize: 11, color: cat.c, background: cat.bg, borderRadius: 6, padding: "1px 7px", marginTop: 2 }}>
          {tx.category}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", color: T.mut, cursor: "pointer", padding: 4, flexShrink: 0 }}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            background: T.card2,
            border: `1px solid ${T.bdr}`,
            borderRadius: 10,
            zIndex: 50,
            minWidth: 100,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onDelete(tx.id);
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: "none",
              border: "none",
              color: T.dng,
              cursor: "pointer",
              fontSize: 13,
              width: "100%",
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
