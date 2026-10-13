const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  if (req.method === "GET") {
    let where = {};
    if (req.session.role !== "admin") {
      const mine = await prisma.coordinatorDepartment.findMany({ where: { userId: req.session.sub } });
      const myIds = mine.map((m) => m.departmentId);
      // A coordinator sees all employees, but only if the admin gave him at least one
      // department. A coordinator with no departments sees nothing.
      where = myIds.length === 0 ? { id: "__none__" } : { active: true };
    }
    const employees = await prisma.employee.findMany({
      where,
      orderBy: { lastName: "asc" },
      include: { departments: { select: { departmentId: true } } },
    });
    const sorted = employees.slice().sort((a, b) =>
      a.lastName.localeCompare(b.lastName, "he") || a.firstName.localeCompare(b.firstName, "he"));
    res.status(200).json(
      sorted.map((e) => ({
        id: e.id, active: e.active, employeeNumber: e.employeeNumber, firstName: e.firstName, lastName: e.lastName,
        departmentIds: e.departments.map((d) => d.departmentId),
      }))
    );
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
