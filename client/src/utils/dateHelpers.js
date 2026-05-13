export function formatDate(dateStr, format = "YYYY/MM/DD") {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return format
    .replace("YYYY", y)
    .replace("MM", m)
    .replace("DD", day)
    .replace("HH", h)
    .replace("mm", min);
}

export function formatDateArabic(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

export function today() {
  return new Date().toISOString().split("T")[0];
}
