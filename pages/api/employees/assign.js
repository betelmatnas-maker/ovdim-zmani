const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

// Admin assigns (or un-assigns) many employees to one department at once.
// body: { employeeIds: [...], departmentId, action: "add" | "remove" }
async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה לשייך עובדים למחלקות." });
    return;
  }
  const { employeeIds, departmentId, action } = req.body || {};
  const ids = Array.isArray(employeeIds) ? employeeIds.filter(Boolean) : [];
  if (ids.length === 0 || !departmentId) {
    res.status(400).json({ error: "יש לסמן עובדים ולבחור מחלקה." });
    return;
  }
  try {
    if (action === "remove") {
      const r = await prisma.employeeDepartment.deleteMany({
        where: { departmentId, employeeId: { in: ids } },
      });
      res.status(200).json({ changed: r.count });
    } else {
      const r = await prisma.employeeDepartment.createMany({
        data: ids.map((employeeId) => ({ employeeId, departmentId })),
        skipDuplicates: true,
      });
      res.status(200).json({ changed: r.count });
    }
  } catch (e) {
    res.status(500).json({ error: "שגיאה בשיוך: " + String((e && e.message) || e).slice(0, 200) });
  }
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
