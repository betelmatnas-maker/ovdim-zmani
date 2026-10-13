const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { hoursBetween } = require("../../../lib/hours");

async function handler(req, res) {
  if (req.method === "GET") {
    const { employeeId } = req.query;
    const where = employeeId ? { employeeId } : {};
    const entries = await prisma.attendanceEntry.findMany({ where, orderBy: { date: "asc" } });
    res.status(200).json(entries);
    return;
  }

  if (req.method === "POST") {
    const { employeeId, departmentId, date, timeIn, timeOut, isCorrection } = req.body || {};
    if (!employeeId || !departmentId || !date || !timeIn || !timeOut) {
      res.status(400).json({ error: "יש למלא מחלקה, תאריך, שעת כניסה ושעת יציאה." });
      return;
    }
    if (hoursBetween(timeIn, timeOut) <= 0) {
      res.status(400).json({ error: "שעת היציאה חייבת להיות אחרי שעת הכניסה." });
      return;
    }
    if (req.session.role !== "admin") {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp || !emp.active) {
        res.status(403).json({ error: "העובד אינו פעיל." });
        return;
      }
      const allowed = await prisma.coordinatorDepartment.findUnique({
        where: { userId_departmentId: { userId: req.session.sub, departmentId } },
      });
      if (!allowed) {
        res.status(403).json({ error: "אין לך הרשאה לדווח על מחלקה זו." });
        return;
      }
    }
    const entry = await prisma.attendanceEntry.create({
      data: {
        employeeId,
        departmentId,
        date,
        timeIn,
        timeOut,
        isCorrection: !!isCorrection,
        createdById: req.session.sub,
      },
    });
    res.status(201).json(entry);
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
