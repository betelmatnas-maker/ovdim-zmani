const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "DELETE") {
    const entry = await prisma.attendanceEntry.findUnique({ where: { id } });
    if (entry && entry.isCorrection && entry.paid) {
      res.status(403).json({ error: "לא ניתן להסיר הפרש שכבר סומן כשולם." });
      return;
    }
    await prisma.attendanceEntry.delete({ where: { id } }).catch(() => {});
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
