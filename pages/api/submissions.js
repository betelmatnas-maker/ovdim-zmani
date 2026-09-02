const prisma = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");

async function handler(req, res) {
  if (req.method === "GET") {
    const { employeeId, departmentId, month } = req.query;
    if (!employeeId || !departmentId || !month) {
      res.status(400).json({ error: "חסרים פרמטרים." });
      return;
    }
    const sub = await prisma.submission.findUnique({
      where: { employeeId_departmentId_month: { employeeId, departmentId, month } },
    });
    res.status(200).json({ submitted: !!(sub && sub.submitted) });
    return;
  }

  if (req.method === "POST") {
    const { employeeId, departmentId, month, submitted } = req.body || {};
    if (!employeeId || !departmentId || !month) {
      res.status(400).json({ error: "חסרים פרמטרים." });
      return;
    }
    const sub = await prisma.submission.upsert({
      where: { employeeId_departmentId_month: { employeeId, departmentId, month } },
      update: { submitted: !!submitted, submittedById: req.session.sub },
      create: { employeeId, departmentId, month, submitted: !!submitted, submittedById: req.session.sub },
    });
    res.status(200).json({ submitted: sub.submitted });
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
