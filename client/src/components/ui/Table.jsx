import React, { useEffect, useRef, useState } from "react";

export default function Table({ columns = [], rows = [] }) {
  const [mobileSheetRow, setMobileSheetRow] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const longPressTimer = useRef(null);
  const actionColumn = columns.find((column) => column.key === "actions");
  const visibleColumns = columns.filter((column) => column.key !== "actions");

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  function startLongPress(row) {
    if (!actionColumn) return;
    longPressTimer.current = window.setTimeout(() => setMobileSheetRow(row), 500);
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="glass-panel rounded-[18px] px-4 py-8 text-center text-sm text-text-muted">لا توجد بيانات</div>
          ) : (
            rows.map((row, index) => {
              const primary = visibleColumns[0];
              const secondary = visibleColumns[1];
              const rest = visibleColumns.slice(2);
              return (
                <button
                  key={index}
                  type="button"
                  onPointerDown={() => startLongPress(row)}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  className="glass-panel block w-full rounded-[20px] p-4 text-start transition-all hover:border-primary/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold text-text-primary">
                        {primary?.render ? primary.render(row[primary.key], row) : row[primary?.key]}
                      </div>
                      {secondary ? (
                        <div className="mt-1 text-sm text-text-secondary">
                          {secondary.label}: {secondary.render ? secondary.render(row[secondary.key], row) : row[secondary.key]}
                        </div>
                      ) : null}
                    </div>
                    {actionColumn ? <div className="rounded-full border border-border-subtle px-2 py-1 text-[10px] text-text-secondary" style={{ background: "var(--bg-input)" }}>اضغط مطولاً</div> : null}
                  </div>
                  {rest.length > 0 ? (
                    <div className="mt-4 grid gap-2 text-sm text-text-secondary">
                      {rest.map((column) => (
                        <div key={column.key} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2" style={{ background: "var(--bg-input)" }}>
                          <span>{column.label}</span>
                          <span className="text-text-primary">
                            {column.render ? column.render(row[column.key], row) : row[column.key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {mobileSheetRow ? (
          <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" onClick={() => setMobileSheetRow(null)}>
            <div
              className="glass-elevated absolute inset-x-0 bottom-0 rounded-t-[28px] p-5 animate-[sheetUp_220ms_ease-out]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-16 rounded-full" style={{ background: "var(--border-normal)" }} />
              <div className="mb-4 text-sm font-semibold text-text-primary">إجراءات العنصر</div>
              <div>{actionColumn?.render ? actionColumn.render(mobileSheetRow[actionColumn.key], mobileSheetRow) : null}</div>
              <div className="mt-4">
                <button type="button" className="btn btn-ghost w-full" onClick={() => setMobileSheetRow(null)}>
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="glass-panel glass-scroll w-full overflow-x-auto overflow-y-hidden rounded-[16px]">
      <table className="w-full border-collapse text-start" dir="rtl">
        <thead className="border-b border-border-strong" style={{ background: "var(--bg-input)" }}>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-text-muted" colSpan={columns.length || 1}>
                لا توجد بيانات
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="group relative transition-colors duration-150 hover:bg-primary/5">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-sm text-text-primary whitespace-nowrap first:font-medium">
                    {c.render ? c.render(row[c.key], row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
