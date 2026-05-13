import api from "./api";

export const reportsApi = {
  fetchRegistry() {
    return api.get("/api/reports/registry").then((res) => res.data?.data || []);
  },

  fetchReport(slug, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") query.set(k, v);
    });
    return api.get(`/api/reports/run/${slug}?${query.toString()}`).then((res) => res.data);
  },

  fetchSourceReport(sourceKey, classification, dataMode, params = {}) {
    const query = new URLSearchParams({ classification, dataMode });
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") query.set(k, v);
    });
    return api.get(`/api/reports/source/${sourceKey}/run?${query.toString()}`).then((res) => res.data);
  },

  fetchSourceClassifications(sourceKey) {
    return api.get(`/api/reports/source/${sourceKey}/classifications`).then((res) => res.data?.data || null);
  },

  exportReport(slug, format, params = {}) {
    const { onProgress, columns, ...rest } = params;
    const query = new URLSearchParams({ format, ...rest });
    if (Array.isArray(columns) && columns.length) {
      query.set("columns", JSON.stringify(columns.map((c) => ({
        key: c.key || c.id,
        label: c.label || c.header || c.key || c.id,
        type: c.type,
        printPriority: c.printPriority,
      }))));
    }
    return api.get(`/api/reports/export-slug/${slug}?${query.toString()}`, {
      responseType: "blob",
      onDownloadProgress: onProgress,
    }).then((res) => res.data);
  },

  exportRows(rows, format = "excel", title = "Export") {
    return api.get("/api/reports/export-rows-stream", {
      params: { rows: JSON.stringify(rows), format, title },
      responseType: "blob",
    }).then((res) => res.data);
  },
};
