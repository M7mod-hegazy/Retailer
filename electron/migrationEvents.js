let _fn = null;
function setMigrationProgress(fn) { _fn = fn; }
function reportMigrationProgress(msg) { try { _fn?.(msg); } catch (_) {} }
module.exports = { setMigrationProgress, reportMigrationProgress };
