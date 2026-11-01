const XLSX = require("xlsx");
const { requireAuth } = require("../../../lib/auth");
const { getCorrectionRows } = require("../../../lib/correctionsData");
const { fmtHours } = require("../../../lib/hours");

async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להוריד דוחות." });
    return;
  }
  const scope = req.query.scope === "all" ? "all" : "pending";
  const rows = await getCorrectionRows(scope);
  const data = rows.map((r) => ({
    "שם משפחה": r.lastName,
    "שם פרטי": r.firstName,
    "מספר עובד": r.employeeNumber,
    "שם המחלקה": r.department,
    "מספר מחלקה": r.departmentNumber,
    "תעריף לשעה": r.rate,
    "תאריך העבודה": r.date,
    "כניסה": r.timeIn,
    "יציאה": r.timeOut,
    "שעות": fmtHours(r.hours),
    "סטטוס": r.paid ? "שולם" : "ממתין לתשלום",
    "הוזן על ידי": r.reportedBy,
    "תאריך הזנה": r.reportedAt,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [16, 16, 14, 18, 14, 12, 14, 9, 9, 9, 16, 18, 14].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "הפרשים");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fname = scope === "all" ? "הפרשים-כל-ההפרשים.xlsx" : "הפרשים-ממתינים-לתשלום.xlsx";
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.status(200).send(buffer);
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
