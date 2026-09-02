const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { computeReportRows } = require("../../../lib/reportData");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה לצפות בדוחות." });
    return;
  }

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const currentMonth = setting ? setting.currentMonth : null;
  const rows = await computeReportRows(currentMonth);
  const unpaidTotal = rows.reduce((s, r) => s + r.corrections, 0);

  res.status(200).json({ rows, unpaidTotal, currentMonth });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
