const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה לסמן הפרשים כשולמו." });
    return;
  }

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const currentMonth = setting ? setting.currentMonth : null;

  const result = await prisma.attendanceEntry.updateMany({
    where: { isCorrection: true, paid: false },
    data: { paid: true, paidInMonth: currentMonth },
  });

  res.status(200).json({ updated: result.count });
}

module.exports = requireAuth(handler);
