const prisma = require("../../../../../lib/db");
const { requireAuth } = require("../../../../../lib/auth");
const { htmlToPdfBuffer } = require("../../../../../lib/pdf");
const { employeeSectionHtml, reportDocumentHtml } = require("../../../../../lib/pdfTemplate");
const { fullName } = require("../../../../../lib/hours");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להוריד דוחות." });
    return;
  }

  const { id } = req.query;
  const [emp, entries, departments, setting] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.attendanceEntry.findMany({ where: { employeeId: id } }),
    prisma.department.findMany(),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);
  if (!emp) {
    res.status(404).json({ error: "עובד לא נמצא." });
    return;
  }
  const departmentsById = Object.fromEntries(departments.map((d) => [d.id, d]));
  const currentMonth = setting ? setting.currentMonth : null;

  const html = reportDocumentHtml([employeeSectionHtml(emp, entries, departmentsById, currentMonth)]);
  const pdf = await htmlToPdfBuffer(html);

  const fname = `דוח-נוכחות-${fullName(emp).replace(/\s+/g, "-")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.status(200).send(pdf);
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
