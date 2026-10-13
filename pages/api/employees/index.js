const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

async function handler(req, res) {
  if (req.method === "GET") {
    let where = {};
    if (req.session.role !== "admin") {
      const mine = await prisma.coordinatorDepartment.findMany({ where: { userId: req.session.sub } });
      const myIds = mine.map((m) => m.departmentId);
      // A coordinator sees only employees the admin assigned to one of the coordinator's
      // departments. Unassigned employees are invisible to coordinators.
      where = myIds.length === 0
        ? { id: "__none__" }
        : { departments: { some: { departmentId: { in: myIds } } } };
    }
    const employees = await prisma.employee.findMany({
      where,
      orderBy: { firstName: "asc" },
      include: { departments: { select: { departmentId: true } } },
    });
    res.status(200).json(
      employees.map((e) => ({
        id: e.id, employeeNumber: e.employeeNumber, firstName: e.firstName, lastName: e.lastName,
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
