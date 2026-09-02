const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  if (req.method === "GET") {
    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
    res.status(200).json(departments);
    return;
  }

  if (req.method === "POST") {
    if (req.session.role !== "admin") {
      res.status(403).json({ error: "רק חשבת השכר יכולה להוסיף מחלקות." });
      return;
    }
    const { name, departmentNumber, rate } = req.body || {};
    if (!name || !departmentNumber || !rate) {
      res.status(400).json({ error: "יש למלא שם מחלקה, מספר מחלקה ותעריף." });
      return;
    }
    try {
      const dep = await prisma.department.create({
        data: { name: name.trim(), departmentNumber: departmentNumber.trim(), rate: rate.trim() },
      });
      res.status(201).json(dep);
    } catch (e) {
      if (e.code === "P2002") {
        res.status(409).json({ error: "מחלקה בשם זה כבר קיימת." });
        return;
      }
      res.status(500).json({ error: "שגיאה בהוספת המחלקה." });
    }
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);
