const { requireAuth } = require("../../../lib/auth");
const P = require("../../../lib/periodReports");

// GET /api/reports/by-department?departmentId=&from=YYYY-MM-DD&to=YYYY-MM-DD&format=pdf|xlsx
async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להוריד דוחות." });
    return;
  }
  const { departmentId, from, to } = req.query;
  const format = req.query.format === "xlsx" ? "xlsx" : "pdf";
  const bad = P.validatePeriod(from, to);
  if (!departmentId || bad) { res.status(400).json({ error: bad || "יש לבחור מחלקה." }); return; }
  const r = await P.loadDepartmentReport(departmentId, from, to);
  if (!r) { res.status(404).json({ error: "מחלקה לא נמצאה." }); return; }
  const base = `דוח-${r.dep.name.replace(/\s+/g, "-")}-${from}-עד-${to}`;
  if (format === "xlsx") P.send(res, P.departmentXlsx(r), `${base}.xlsx`, "xlsx");
  else P.send(res, await P.departmentPdf(r, from, to), `${base}.pdf`, "pdf");
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
