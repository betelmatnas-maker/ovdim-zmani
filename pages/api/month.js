const prisma = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");

async function handler(req, res) {
  if (req.method === "GET") {
    const setting = await prisma.setting.findUnique({ where: { id: 1 } });
    res.status(200).json({ currentMonth: setting ? setting.currentMonth : null });
    return;
  }

  if (req.method === "POST") {
    if (req.session.role !== "admin") {
      res.status(403).json({ error: "רק חשבת השכר יכולה לפתוח חודש." });
      return;
    }
    const { month } = req.body || {};
    if (!month) {
      res.status(400).json({ error: "יש לבחור חודש." });
      return;
    }
    const setting = await prisma.setting.upsert({
      where: { id: 1 },
      update: { currentMonth: month },
      create: { id: 1, currentMonth: month },
    });
    res.status(200).json({ currentMonth: setting.currentMonth });
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
