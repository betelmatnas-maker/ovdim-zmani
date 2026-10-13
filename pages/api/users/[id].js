const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להסיר משתמשים." });
    return;
  }
  const { id } = req.query;

  if (req.method === "PATCH") {
    const ids = Array.isArray(req.body && req.body.departmentIds) ? req.body.departmentIds : [];
    await prisma.$transaction([
      prisma.coordinatorDepartment.deleteMany({ where: { userId: id } }),
      prisma.coordinatorDepartment.createMany({
        data: ids.map((departmentId) => ({ userId: id, departmentId })),
        skipDuplicates: true,
      }),
    ]);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE") {
    await prisma.user.delete({ where: { id } }).catch(() => {});
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
