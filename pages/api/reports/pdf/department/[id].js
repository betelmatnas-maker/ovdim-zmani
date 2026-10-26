const prisma = require("../../../../../lib/db");
const { requireAuth } = require("../../../../../lib/auth");
const { htmlToPdfBuffer } = require("../../../../../lib/pdf");
const { employeeSectionHtml, periodSectionHtml, reportDocumentHtml } = require("../../../../../lib/pdfTemplate");
const { computeReportRows } = require("../../../../../lib/reportData");
const { fullName } = require("../../../../../lib/hours");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const { id } = req.query;
  const isAdmin = req.session.role === "admin";
  if (!isAdmin) {
    const allowed = await prisma.coordinatorDepartment.findUnique({
      where: { userId_departmentId: { userId: req.session.sub, departmentId: id } },
    });
    if (!allowed) {
      res.status(403).json({ error: "אין לך הרשאה לדוח של מחלקה זו." });
      return;
    }
  }
  const [dep, departments, setting] = await Promise.all([
    prisma.department.findUnique({ where: { id } }),
    prisma.department.findMany(),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);
  if (!dep) {
    res.status(404).json({ error: "מחלקה לא נמצאה." });
    return;
  }
  const currentMonth = setting ? setting.currentMonth : null;
  const departmentsById = Object.fromEntries(departments.map((d) => [d.id, d]));

  const rows = await computeReportRows(currentMonth);
  const employeeIds = [...new Set(rows.filter((r) => r.monthly > 0 && r.departmentId === id).map((r) => r.employeeId))];

  const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
  employees.sort((a, b) => fullName(a).localeCompare(fullName(b), "he"));

  if (employees.length === 0) {
    res.status(400).json({ error: "אין עובדים עם דיווח החודש במחלקה זו." });
    return;
  }

  const allEntries = await prisma.attendanceEntry.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
  });
  const entriesByEmp = {};
  allEntries.forEach((en) => {
    if (!entriesByEmp[en.employeeId]) entriesByEmp[en.employeeId] = [];
    entriesByEmp[en.employeeId].push(en);
  });

  const sections = employees.map((emp) => {
    if (isAdmin) return employeeSectionHtml(emp, entriesByEmp[emp.id] || [], departmentsById, currentMonth);
    // Coordinator: only this department, only the current month (+ unpaid corrections).
    const mine = (entriesByEmp[emp.id] || []).filter((en) => en.departmentId === id &&
      ((!en.isCorrection && en.date.slice(0, 7) === currentMonth) || (en.isCorrection && !en.paid)));
    return periodSectionHtml(emp, mine, departmentsById, `חודש: ${currentMonth} · מחלקה: ${dep.name}`, "הפרשים ממתינים לתשלום");
  });
  const html = reportDocumentHtml(sections);
  const pdf = await htmlToPdfBuffer(html);

  const fname = `דוח-${dep.name}-${currentMonth || "ללא-חודש"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.status(200).send(pdf);
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
