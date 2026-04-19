import { T } from "./config.js";
import { getCat } from "./utils.js";
import { CategoryIcon } from "./categoryIcons.jsx";

export function BudgetBar({ cat, limit, spent, categories, formatMoney }) {
  const c = getCat(categories, cat);
  const pct = Math.min(Math.round((spent / limit) * 100), 100);
  const over = spent > limit;
  const near = !over && pct >= 80;
  const barC = over ? T.dng : near ? T.warn : c.c;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CategoryIcon name={cat} size={18} color={c.c} />
          <span style={{ fontSize: 14, fontWeight: 600, color: T.txt }}>{cat}</span>
          {over && (
            <span style={{ fontSize: 11, color: T.dng, background: T.ddim, borderRadius: 6, padding: "1px 8px" }}>Over!</span>
          )}
          {near && (
            <span style={{ fontSize: 11, color: T.warn, background: T.wdim, borderRadius: 6, padding: "1px 8px" }}>80%</span>
          )}
        </div>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: over ? T.dng : T.txt }}>{formatMoney(spent)}</span>
          <span style={{ fontSize: 12, color: T.sub }}> / {formatMoney(limit)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 2,
              background: i < Math.round((pct / 100) * 20) ? barC : T.bdr,
              transition: "background 0.4s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
