const { REPORT_REGISTRY } = require("../src/reports/registry");
const { dispatcher } = require("../src/reports");
const { getReportColumns } = require("../src/reports/columns");

const SUPPORTED_EXPORTS = new Set(["pdf", "excel", "word", "print"]);
const problems = [];

for (const report of REPORT_REGISTRY.reports) {
  const label = `${report.id}:${report.slug}`;
  if (!dispatcher[report.slug]) {
    problems.push(`${label} has no dispatcher`);
  }

  const columns = getReportColumns(report.slug);
  if (!columns.length) {
    problems.push(`${label} has no column contract`);
  }

  const keys = new Set();
  for (const column of columns) {
    if (!column.key) problems.push(`${label} has a column without key`);
    if (keys.has(column.key)) problems.push(`${label} has duplicate column key ${column.key}`);
    keys.add(column.key);
    if (!column.label || column.label === column.key) problems.push(`${label}.${column.key} needs an Arabic label`);
    if (!column.printPriority) problems.push(`${label}.${column.key} has no print priority`);
    if (!column.type) problems.push(`${label}.${column.key} has no type`);
  }

  for (const format of report.exportFormats || []) {
    if (!SUPPORTED_EXPORTS.has(format)) problems.push(`${label} has unsupported export format ${format}`);
  }
}

if (problems.length) {
  console.error(`Report audit failed with ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}

console.log(`Report audit passed: ${REPORT_REGISTRY.reports.length} reports checked.`);
