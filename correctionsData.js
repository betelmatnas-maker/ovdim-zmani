const prisma = require("./db");
const { hoursBetween } = require("./hours");

// scope: "pending" (not yet paid) | "all"
async function getCorrectionRows(scope) {
  const where = { isCorrection: true };
  if (scope !== "all") where.paid = false;
  const entries = await prisma.attendanceEntry.findMany({
    where,
    include: { employee: true, department: true, createdBy: { select: { fullName: true } } },
  });
  const rows = entries.map((en) => ({
    id: en.id,
    employeeId: en.employeeId,
    lastName: en.employee.lastName,
    firstName: en.employee.firstName,
    employeeNumber: en.employee.employeeNumber,
    department: en.department.name,
    departmentNumber: en.department.departmentNumber,
    rate: en.department.rate,
    date: en.date,
    timeIn: en.timeIn,
    timeOut: en.timeOut,
    hours: hoursBetween(en.timeIn, en.timeOut),
    paid: en.paid,
    reportedBy: en.createdBy ? en.createdBy.fullName : "",
    reportedAt: en.createdAt.toISOString().slice(0, 10),
  }));
  rows.sort((a, b) =>
    a.lastName.localeCompare(b.lastName, "he") ||
    a.firstName.localeCompare(b.firstName, "he") ||
    a.date.localeCompare(b.date));
  return rows;
}

module.exports = { getCorrectionRows };
