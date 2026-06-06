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
    <div className="tx-row-card">
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
        <div
          className="cat-icon-glass"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: cat.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
                bottom: -2,
                right: -2,
                width: 15,
                height: 15,
                borderRadius: 4,
                background: T.card,
                border: `1px solid ${T.bdr}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageIcon size={8} color={T.acc} strokeWidth={2.5} />
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
              letterSpacing: "-0.015em",
            }}
          >
            {tx.notes || tx.category}
          </div>
          <div
            style={{
              fontSize: 12,
              color: T.sub,
              display: "flex",
              gap: 5,
              marginTop: 2,
              alignItems: "center",
              flexWrap: "nowrap",
              overflow: "hidden",
            }}
          >
            <span style={{ flexShrink: 0 }}>{fDate(tx.date, dateLocale)}</span>
            <span style={{ opacity: 0.35, flexShrink: 0 }}>·</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1 }}>
              {tx.payment}
            </span>
            {isMirror ? (
              <>
                <span style={{ opacity: 0.35, flexShrink: 0 }}>·</span>
                <span style={{ color: T.blue, flexShrink: 0, fontSize: 11 }}>Your share</span>
              </>
            ) : null}
            {tx.split && !isMirror && (
              <>
                <span style={{ opacity: 0.35, flexShrink: 0 }}>·</span>
                <span style={{ color: T.acc, flexShrink: 0, fontSize: 11 }}>Split</span>
              </>
            )}
            {isSettled ? (
              <>
                <span style={{ opacity: 0.35, flexShrink: 0 }}>·</span>
                <span style={{ color: T.grn || T.acc, flexShrink: 0, fontSize: 11 }}>Settled</span>
              </>
            ) : null}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: isSettled ? T.sub : T.txt,
              textDecoration: isSettled ? "line-through" : "none",
              letterSpacing: "-0.02em",
            }}
          >
            −{formatMoney(displayAmt)}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: cat.c,
              marginTop: 2,
            }}
          >
            {tx.category}
          </div>
        </div>
      </div>

      {!isMirror && (
        <button
          type="button"
          onClick={() => onDelete(tx.id)}
          title="Delete expense"
          aria-label="Delete expense"
          style={{
            background: "none",
            border: "none",
            color: T.dng,
            cursor: "pointer",
            padding: 6,
            flexShrink: 0,
            opacity: 0.35,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 150ms cubic-bezier(0.165, 0.84, 0.44, 1)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.35"; }}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
