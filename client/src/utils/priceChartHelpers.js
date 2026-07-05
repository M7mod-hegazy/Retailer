export function mergePriceTimeline(byField, currentPrices) {
  const fields = Object.keys(byField);
  if (!fields.length) return [];

  const allDates = new Set();
  const timelines = {};
  for (const field of fields) {
    const pts = byField[field] || [];
    const sorted = [...pts].sort((a, b) => new Date(a.date) - new Date(b.date));
    timelines[field] = sorted;
    for (const p of sorted) allDates.add(p.date);
  }

  const sortedDates = [...allDates].sort((a, b) => new Date(a) - new Date(b));
  const result = [];
  const carry = {};

  for (const field of fields) {
    carry[field] = currentPrices?.[field] ?? 0;
  }

  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const date = sortedDates[i];
    const point = { date };
    for (const field of fields) {
      const timeline = timelines[field];
      const match = timeline.find(p => p.date === date);
      if (match) carry[field] = Number(match.value);
      point[field] = carry[field];
    }
    result.push(point);
  }

  if (result.length > 0) {
    const last = result[result.length - 1];
    for (const field of fields) {
      if (last[field] == null) last[field] = currentPrices?.[field] ?? 0;
    }
  }

  return result;
}

export function filterByPeriod(data, period, customRange) {
  if (!data || !data.length) return data;
  const now = new Date();
  let start;

  if (period === "custom" && customRange?.start) {
    start = new Date(customRange.start);
  } else {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
    if (!days) return data;
    start = new Date(now - days * 86400000);
  }

  const end = period === "custom" && customRange?.end ? new Date(customRange.end) : now;
  return data.filter(p => {
    const d = new Date(p.date);
    return d >= start && d <= end;
  });
}

export function computePriceStats(data, field) {
  if (!data || !data.length) return { avg: 0, min: 0, max: 0, first: 0, last: 0, change: 0, change_pct: 0, volatility: 0 };
  const values = data.map(p => Number(p[field] || 0)).filter(v => v > 0);
  if (!values.length) return { avg: 0, min: 0, max: 0, first: 0, last: 0, change: 0, change_pct: 0, volatility: 0 };

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / values.length) * 100) / 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const first = values[0];
  const last = values[values.length - 1];
  const change = Math.round((last - first) * 100) / 100;
  const change_pct = first > 0 ? Math.round((change / first) * 100) : 0;

  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
  const volatility = avg > 0 ? Math.round((Math.sqrt(variance) / avg) * 100) / 100 : 0;

  return { avg, min, max, first, last, change, change_pct, volatility };
}
