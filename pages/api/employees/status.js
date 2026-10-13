const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

// Admin marks many employees active / inactive at once.
// body: { employeeIds: [...], active: true | false }
async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה לשנות סטטוס עובדים." });
    return;
  }
  const { employeeIds, active } = req.body || {};
  const ids = Array.isArray(employeeIds) ? employeeIds.filter(Boolean) : [];
  if (ids.length === 0 || typeof active !== "boolean") {
    res.status(400).json({ error: "יש לסמן עובדים ולבחור סטטוס." });
    return;
  }
  try {
    const r = await prisma.employee.updateMany({ where: { id: { in: ids } }, data: { active } });
    res.status(200).json({ changed: r.count });
  } catch (e) {
    res.status(500).json({ error: "שגיאה בעדכון הסטטוס: " + String((e && e.message) || e).slice(0, 200) });
  }
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
