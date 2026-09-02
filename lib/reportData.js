const prisma = require("./db");
const { hoursBetween, fullName } = require("./hours");

// Returns one row per employee+department that has monthly hours and/or
// unpaid correction hours, mirroring the prototype's computeReportRows().
async function computeReportRows(currentMonth) {
  const [employees, departments, entries, travel] = await Promise.all([
    prisma.employee.findMany(),
    prisma.department.findMany(),
    prisma.attendanceEntry.findMany(),
    prisma.travelEligibility.findMany({ where: currentMonth ? { month: currentMonth } : undefined }),
  ]);

  const depById = Object.fromEntries(departments.map((d) => [d.id, d]));
  const travelByEmp = Object.fromEntries(travel.map((t) => [t.employeeId, t.status]));

  // employeeId -> departmentId -> { monthly, corrections, days: Set }
  const byEmpDept = {};
  entries.forEach((en) => {
    if (!byEmpDept[en.employeeId]) byEmpDept[en.employeeId] = {};
    const bucket = byEmpDept[en.employeeId];
    if (!bucket[en.departmentId]) bucket[en.departmentId] = { monthly: 0, corrections: 0, days: new Set() };
    const h = hoursBetween(en.timeIn, en.timeOut);
    if (en.isCorrection && !en.paid) {
      bucket[en.departmentId].corrections += h;
    } else if (!en.isCorrection && currentMonth && en.date.slice(0, 7) === currentMonth) {
      bucket[en.departmentId].monthly += h;
      bucket[en.departmentId].days.add(en.date);
    }
  });

  const rows = [];
  employees.forEach((emp) => {
    const bucket = byEmpDept[emp.id] || {};
    Object.entries(bucket).forEach(([depId, sums]) => {
      if (sums.monthly === 0 && sums.corrections === 0) return;
      const dep = depById[depId];
      rows.push({
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeNumber: emp.employeeNumber,
        departmentId: depId,
        department: dep ? dep.name : "מחלקה לא ידועה",
        departmentNumber: dep ? dep.departmentNumber : "",
        rate: dep ? dep.rate : "",
        monthly: sums.monthly,
        days: sums.days.size,
        corrections: sums.corrections,
        travel: travelByEmp[emp.id] || null,
      });
    });
  });

  return rows;
}

function travelLabel(status) {
  if (status === "eligible") return "זכאי לנסיעות";
  if (status === "not_eligible") return "לא זכאי לנסיעות";
  return "לא סומן";
}

module.exports = { computeReportRows, travelLabel, fullName };
