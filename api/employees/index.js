const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  if (req.method === "GET") {
    const employees = await prisma.employee.findMany({ orderBy: { firstName: "asc" } });
    res.status(200).json(employees);
    return;
  }

  if (req.method === "POST") {
    if (req.session.role !== "admin") {
      res.status(403).json({ error: "רק חשבת השכר יכולה להוסיף עובדים." });
      return;
    }
    const { firstName, lastName, employeeNumber } = req.body || {};
    if (!firstName || !lastName || !employeeNumber) {
      res.status(400).json({ error: "יש למלא שם פרטי, שם משפחה ומספר עובד." });
      return;
    }
    try {
      const emp = await prisma.employee.create({
        data: { firstName: firstName.trim(), lastName: lastName.trim(), employeeNumber: employeeNumber.trim() },
      });
      res.status(201).json(emp);
    } catch (e) {
      if (e.code === "P2002") {
        res.status(409).json({ error: "מספר עובד זה כבר קיים במערכת." });
        return;
      }
      res.status(500).json({ error: "שגיאה בהוספת העובד." });
    }
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
