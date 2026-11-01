const prisma = require("./db");

async function isReportingLocked() {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  return !!(setting && setting.reportingLocked);
}

// For coordinator write actions: when the clerk locked reporting, answer 403 and return true.
async function blockIfLocked(req, res) {
  if (req.session.role === "admin") return false;
  if (await isReportingLocked()) {
    res.status(403).json({ error: "הדיווח נעול על ידי חשבת השכר. אפשר לדווח שוב אחרי פתיחת החודש הבא." });
    return true;
  }
  return false;
}

module.exports = { isReportingLocked, blockIfLocked };
