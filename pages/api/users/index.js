const prisma = require("../../../lib/db");
const { requireAuth, hashPassword } = require("../../../lib/auth");

async function handler(req, res) {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה לנהל משתמשים." });
    return;
  }

  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      where: { role: "coordinator" },
      select: { id: true, username: true, fullName: true, createdAt: true },
      orderBy: { fullName: "asc" },
    });
    res.status(200).json(users);
    return;
  }

  if (req.method === "POST") {
    const { username, password, fullName } = req.body || {};
    if (!username || !password || !fullName) {
      res.status(400).json({ error: "יש למלא שם מלא, שם משתמש וסיסמה." });
      return;
    }
    try {
      const user = await prisma.user.create({
        data: {
          username: username.trim(),
          fullName: fullName.trim(),
          passwordHash: hashPassword(password),
          role: "coordinator",
        },
      });
      res.status(201).json({ id: user.id, username: user.username, fullName: user.fullName });
    } catch (e) {
      if (e.code === "P2002") {
        res.status(409).json({ error: "שם המשתמש הזה כבר תפוס." });
        return;
      }
      res.status(500).json({ error: "שגיאה ביצירת המשתמש." });
    }
    return;
  }

  res.status(405).end();
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
