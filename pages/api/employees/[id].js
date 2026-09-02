const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "DELETE") {
    if (req.session.role !== "admin") {
      res.status(403).json({ error: "רק חשבת השכר יכולה להסיר עובדים." });
      return;
    }
    await prisma.employee.delete({ where: { id } }).catch(() => {});
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
