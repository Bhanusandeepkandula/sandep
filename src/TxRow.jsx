import { Trash2, ImageIcon } from "lucide-react";
import { T } from "./config.js";
import { getCat, fDate, effectiveAmount } from "./utils.js";
import { CategoryIcon } from "./categoryIcons.jsx";

export function TxRow({
  tx,
  onDelete,
  onSelect,
  categories,
  formatMoney,
  dateLocale,
  selfProfileUuid = "",
  selfFbUid = "",
}) {
  const cat = getCat(categories, tx.category);
  const isMirror =
    typeof tx.syncedFromUid === "string" && tx.syncedFromUid.trim().length > 0;
  const displayAmt = effectiveAmount(tx, selfProfileUuid, selfFbUid);
  const isSettled = displayAmt <= 0 && (
    Boolean(tx?.settlement) ||
    (tx?.settlements && typeof tx.settlements === "object" && Object.keys(tx.settlements).length > 0)
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        borderBottom: `1px solid ${T.bdr}`,
        position: "relative",
      }}
    >
      {/* clickable area: icon + title + amount */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(tx)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(tx)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
          cursor: onSelect ? "pointer" : "default",
        }}
      >
        {/* category icon */}
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
          }}
        >
          <CategoryIcon name={tx.category} size={20} color={cat.c} />
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

        {/* title + meta */}
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
            {isMirror ? (
              <>
                <span>·</span>
                <span style={{ color: T.blue }} title="Your share of a split from a contact">
                  Your share
                </span>
              </>
            ) : null}
            {tx.split && !isMirror && (
              <>
                <span>·</span>
                <span style={{ color: T.acc }}>Split</span>
              </>
            )}
            {isSettled ? (
              <>
                <span>·</span>
                <span style={{ color: T.grn || "#22c55e" }} title="Fully settled">Settled</span>
              </>
            ) : null}
          </div>
        </div>

        {/* amount + category badge */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: isSettled ? T.sub : T.txt,
              textDecoration: isSettled ? "line-through" : "none",
            }}
          >
            -{formatMoney(displayAmt)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: cat.c,
              background: cat.bg,
              borderRadius: 6,
              padding: "1px 7px",
              marginTop: 2,
            }}
          >
            {tx.category}
          </div>
        </div>
      </div>

      {/* delete button — owner only. Slaves can't delete mirror copies from the home screen;
          the master-side delete will remove this mirror for them automatically. */}
      {!isMirror && (
        <button
          type="button"
          onClick={() => onDelete(tx.id)}
          title="Delete"
          style={{
            background: "none",
            border: "none",
            color: T.dng,
            cursor: "pointer",
            padding: 6,
            flexShrink: 0,
            opacity: 0.6,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
