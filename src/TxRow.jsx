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
      className="tx-row-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
        // borderBottom omitted — glass card replaces it
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
        {/* Category icon — glass pill */}
        <div
          className="cat-icon-glass"
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: cat.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <CategoryIcon name={tx.category} size={22} color={cat.c} />
          {tx.receiptUrl ? (
            <span
              title="Receipt attached"
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 16,
                height: 16,
                borderRadius: 5,
                background: T.surf,
                border: `1px solid ${T.bdr}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
              }}
            >
              <ImageIcon size={9} color={T.acc} strokeWidth={2.5} />
            </span>
          ) : null}
        </div>

        {/* title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.txt,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "-0.2px",
            }}
          >
            {tx.notes || tx.category}
          </div>
          <div style={{
            fontSize: 12,
            color: T.sub,
            display: "flex",
            gap: 5,
            marginTop: 3,
            alignItems: "center",
            flexWrap: "nowrap",
            overflow: "hidden",
          }}>
            <span style={{ flexShrink: 0 }}>{fDate(tx.date, dateLocale)}</span>
            <span style={{ opacity: 0.4, flexShrink: 0 }}>·</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1 }}>
              {tx.payment}
            </span>
            {isMirror ? (
              <>
                <span style={{ opacity: 0.4, flexShrink: 0 }}>·</span>
                <span style={{ color: T.blue, flexShrink: 0 }} title="Your share of a split">
                  Your share
                </span>
              </>
            ) : null}
            {tx.split && !isMirror && (
              <>
                <span style={{ opacity: 0.4, flexShrink: 0 }}>·</span>
                <span style={{ color: T.acc, flexShrink: 0 }}>Split</span>
              </>
            )}
            {isSettled ? (
              <>
                <span style={{ opacity: 0.4, flexShrink: 0 }}>·</span>
                <span style={{ color: T.grn || "#30D158", flexShrink: 0 }}>Settled</span>
              </>
            ) : null}
          </div>
        </div>

        {/* amount + category badge */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            className="stat-display"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: isSettled ? T.sub : T.txt,
              textDecoration: isSettled ? "line-through" : "none",
              letterSpacing: "-0.5px",
            }}
          >
            -{formatMoney(displayAmt)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: cat.c,
              background: cat.bg,
              borderRadius: 999,
              padding: "2px 8px",
              marginTop: 3,
              fontWeight: 600,
              letterSpacing: "-0.1px",
              display: "inline-block",
            }}
          >
            {tx.category}
          </div>
        </div>
      </div>

      {/* delete button — owner only */}
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
            opacity: 0.45,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
