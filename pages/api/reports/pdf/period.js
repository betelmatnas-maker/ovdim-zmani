const prisma = require("../../../../lib/db");
const { requireAuth } = require("../../../../lib/auth");
const { htmlToPdfBuffer } = require("../../../../lib/pdf");
const { periodSectionHtml, reportDocumentHtml } = require("../../../../lib/pdfTemplate");
const { fullName } = require("../../../../lib/hours");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Payroll clerk: PDF for one employee (or all employees with entries) over any date range.
// GET /api/reports/pdf/period?employeeId=<id|all>&from=YYYY-MM-DD&to=YYYY-MM-DD
async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להוריד דוחות." });
    return;
  }
  const { employeeId, from, to } = req.query;
  if (!employeeId || !DATE_RE.test(from || "") || !DATE_RE.test(to || "")) {
    res.status(400).json({ error: "יש לבחור עובד ותאריכי התחלה וסיום." });
    return;
  }
  if (from > to) {
    res.status(400).json({ error: "תאריך ההתחלה חייב להיות לפני תאריך הסיום." });
    return;
  }

  const where = { date: { gte: from, lte: to } };
  if (employeeId !== "all") where.employeeId = employeeId;
  const [entries, departments] = await Promise.all([
    prisma.attendanceEntry.findMany({ where }),
    prisma.department.findMany(),
  ]);
  const departmentsById = Object.fromEntries(departments.map((d) => [d.id, d]));

  const entriesByEmp = {};
  entries.forEach((en) => {
    if (!entriesByEmp[en.employeeId]) entriesByEmp[en.employeeId] = [];
    entriesByEmp[en.employeeId].push(en);
  });

  let employees;
  if (employeeId === "all") {
    employees = await prisma.employee.findMany({ where: { id: { in: Object.keys(entriesByEmp) } } });
    if (employees.length === 0) {
      res.status(400).json({ error: "אין דיווחים בתקופה שנבחרה." });
      return;
    }
  } else {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) { res.status(404).json({ error: "עובד לא נמצא." }); return; }
    employees = [emp];
  }
  employees.sort((a, b) => fullName(a).localeCompare(fullName(b), "he"));

  const label = `תקופה: ${from} עד ${to}`;
  const sections = employees.map((emp) =>
    periodSectionHtml(emp, entriesByEmp[emp.id] || [], departmentsById, label, "הפרשים בתקופה")
  );
  const pdf = await htmlToPdfBuffer(reportDocumentHtml(sections));

  const who = employees.length === 1 ? fullName(employees[0]).replace(/\s+/g, "-") : "כל-העובדים";
  const fname = `דוח-${who}-${from}-עד-${to}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.status(200).send(pdf);
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
