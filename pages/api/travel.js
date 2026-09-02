const prisma = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");

async function handler(req, res) {
  if (req.method === "GET") {
    const { employeeId, month } = req.query;
    if (!employeeId || !month) {
      res.status(400).json({ error: "חסרים פרמטרים." });
      return;
    }
    const t = await prisma.travelEligibility.findUnique({
      where: { employeeId_month: { employeeId, month } },
    });
    res.status(200).json({ status: t ? t.status : null });
    return;
  }

  if (req.method === "POST") {
    const { employeeId, month, status } = req.body || {};
    if (!employeeId || !month || !["eligible", "not_eligible"].includes(status)) {
      res.status(400).json({ error: "חסרים פרמטרים." });
      return;
    }
    const t = await prisma.travelEligibility.upsert({
      where: { employeeId_month: { employeeId, month } },
      update: { status, setById: req.session.sub },
      create: { employeeId, month, status, setById: req.session.sub },
    });
    res.status(200).json({ status: t.status });
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
