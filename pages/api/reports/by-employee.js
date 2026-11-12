const { requireAuth } = require("../../../lib/auth");
const { fullName } = require("../../../lib/hours");
const P = require("../../../lib/periodReports");

// GET /api/reports/by-employee?employeeId=&from=YYYY-MM-DD&to=YYYY-MM-DD&format=pdf|xlsx
async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להוריד דוחות." });
    return;
  }
  const { employeeId, from, to } = req.query;
  const format = req.query.format === "xlsx" ? "xlsx" : "pdf";
  const bad = P.validatePeriod(from, to);
  if (!employeeId || bad) { res.status(400).json({ error: bad || "יש לבחור עובד." }); return; }
  const r = await P.loadEmployeeReport(employeeId, from, to);
  if (!r) { res.status(404).json({ error: "עובד לא נמצא." }); return; }
  const base = `דוח-${fullName(r.emp).replace(/\s+/g, "-")}-${from}-עד-${to}`;
  if (format === "xlsx") P.send(res, P.employeeXlsx(r), `${base}.xlsx`, "xlsx");
  else P.send(res, await P.employeePdf(r, from, to), `${base}.pdf`, "pdf");
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
