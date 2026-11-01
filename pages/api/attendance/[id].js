const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { hoursBetween } = require("../../../lib/hours");
const { blockIfLocked } = require("../../../lib/lock");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

async function handler(req, res) {
  const { id } = req.query;

  if ((req.method === "PATCH" || req.method === "DELETE") && (await blockIfLocked(req, res))) return;

  if (req.method === "PATCH") {
    const entry = await prisma.attendanceEntry.findUnique({ where: { id } });
    if (!entry) { res.status(404).json({ error: "הרישום לא נמצא." }); return; }
    if (entry.isCorrection && entry.paid) {
      res.status(403).json({ error: "לא ניתן לערוך הפרש שכבר סומן כשולם." });
      return;
    }
    const { date, timeIn, timeOut } = req.body || {};
    if (!DATE_RE.test(date || "") || !TIME_RE.test(timeIn || "") || !TIME_RE.test(timeOut || "")) {
      res.status(400).json({ error: "יש למלא תאריך, שעת כניסה ושעת יציאה." });
      return;
    }
    if (hoursBetween(timeIn, timeOut) <= 0) {
      res.status(400).json({ error: "שעת היציאה חייבת להיות אחרי שעת הכניסה." });
      return;
    }
    if (req.session.role !== "admin") {
      const allowed = await prisma.coordinatorDepartment.findUnique({
        where: { userId_departmentId: { userId: req.session.sub, departmentId: entry.departmentId } },
      });
      if (!allowed) {
        res.status(403).json({ error: "אין לך הרשאה לערוך דיווח במחלקה זו." });
        return;
      }
      const sub = await prisma.submission.findUnique({
        where: { employeeId_departmentId_month: { employeeId: entry.employeeId, departmentId: entry.departmentId, month: entry.date.slice(0, 7) } },
      });
      if (sub && sub.submitted) {
        res.status(403).json({ error: "הדיווח נשלח. לחצי 'המשך לדווח' כדי לערוך." });
        return;
      }
      if (!entry.isCorrection && date.slice(0, 7) !== entry.date.slice(0, 7)) {
        res.status(400).json({ error: "אפשר לשנות תאריך רק בתוך אותו חודש." });
        return;
      }
    }
    const updated = await prisma.attendanceEntry.update({ where: { id }, data: { date, timeIn, timeOut } });
    res.status(200).json(updated);
    return;
  }

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
