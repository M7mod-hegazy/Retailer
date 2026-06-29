export const DEFAULT_MONTHLY_WORK_DAYS = 26;
export const DEFAULT_WEEKLY_WORK_DAYS = 6;

export function normalizeMonthlyWorkDays(value) {
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_MONTHLY_WORK_DAYS;
}

export function getDailySalary(employeeOrForm = {}) {
  const salary = Number(employeeOrForm.salary || 0);
  if (!Number.isFinite(salary) || salary <= 0) return 0;

  const period = employeeOrForm.salary_period || "monthly";
  if (period === "daily") return salary;
  if (period === "weekly") return salary / DEFAULT_WEEKLY_WORK_DAYS;

  return salary / normalizeMonthlyWorkDays(employeeOrForm.working_days_per_month);
}

export function getDailySalaryBasis(employeeOrForm = {}) {
  const period = employeeOrForm.salary_period || "monthly";
  if (period === "daily") return "قيمة الراتب اليومي كما هي";
  if (period === "weekly") return `${DEFAULT_WEEKLY_WORK_DAYS} أيام عمل أسبوعيًا`;
  return `${normalizeMonthlyWorkDays(employeeOrForm.working_days_per_month)} يوم عمل شهريًا`;
}

export function formatMoney(value, fractionDigits = 0) {
  const amount = Number(value || 0);
  return amount.toLocaleString("ar-EG", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

export function getAmountForSalaryDays(employeeOrForm = {}, days = 0) {
  const count = Number(days || 0);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.round(getDailySalary(employeeOrForm) * count);
}

export function getSalaryDaysForAmount(employeeOrForm = {}, amount = 0) {
  const dailySalary = getDailySalary(employeeOrForm);
  const total = Number(amount || 0);
  if (!dailySalary || !Number.isFinite(total) || total <= 0) return 0;
  return total / dailySalary;
}

export function formatSalaryDays(value) {
  const days = Number(value || 0);
  if (!Number.isFinite(days) || days <= 0) return "0";
  return days.toLocaleString("ar-EG", { maximumFractionDigits: days < 10 ? 2 : 1 });
}