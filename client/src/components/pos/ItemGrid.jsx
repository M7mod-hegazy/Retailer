import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { usePosStore } from "../../stores/posStore";
import { Search, Package } from "lucide-react";

export default function ItemGrid() {
  const addLine = usePosStore((state) => state.addLine);
  const search = usePosStore((state) => state.search);
  const setSearch = usePosStore((state) => state.setSearch);
  const activeCategory = usePosStore((state) => state.activeCategory);
  const setActiveCategory = usePosStore((state) => state.setActiveCategory);
  const [items, setItems] = useState([]);

  useEffect(() => {
    api
      .get("/api/items", { params: search ? { search } : {} })
      .then((response) => setItems(response.data.data || []))
      .catch(() => setItems([]));
  }, [search]);

  const categories = [
    { id: "all", label: "الكل" },
    ...Array.from(
      new Map(
        items
          .filter((item) => item.category_id || item.category_name)
          .map((item) => [String(item.category_id || item.category_name), { id: String(item.category_id || item.category_name), label: item.category_name || `قسم ${item.category_id}` }]),
      ).values(),
    ),
  ];

  const visibleItems = activeCategory === "all"
    ? items
    : items.filter((item) => String(item.category_id || item.category_name) === activeCategory);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>الأصناف</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ابحث بسرعة أو المس للبيع مباشرة</p>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="ابحث بالاسم أو الباركود..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              border: '1px solid var(--border-normal)', borderRadius: '12px',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px',
              outline: 'none', transition: 'all 200ms ease', boxShadow: 'var(--shadow-card)'
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-normal)'; e.target.style.boxShadow = 'var(--shadow-card)'; }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px', minHeight: '44px' }} className="glass-scroll">
        {categories.map((category) => {
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
                border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-normal)'}`,
                background: isActive ? 'var(--primary-50)' : 'var(--bg-surface)',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 150ms ease', boxShadow: isActive ? 'none' : '0 1px 2px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={e => { if(!isActive) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
              onMouseLeave={e => { if(!isActive) { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
              {category.label}
            </button>
          )
        })}
      </div>

      {/* The Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', paddingBottom: '100px'
      }}>
        {visibleItems.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>لا توجد أصناف تطابق بحثك</p>
          </div>
        )}
        
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => addLine(item)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '12px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-normal)', borderRadius: '16px',
              cursor: 'pointer', transition: 'all 200ms ease',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)', textAlign: 'start'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.borderColor = 'var(--border-accent)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-normal)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.03)';
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '4px' }}>
                {item.name}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, monospace' }}>
                {item.barcode || item.code || "بدون باركود"}
              </div>
            </div>
            
            <div style={{ marginTop: '12px', width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'Inter, sans-serif' }}>
                {Number(item.sale_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
