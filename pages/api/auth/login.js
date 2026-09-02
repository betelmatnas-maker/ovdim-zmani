const prisma = require("../../../lib/db");
const { verifyPassword, createSessionCookie } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: "יש להזין שם משתמש וסיסמה." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "שם משתמש או סיסמה שגויים." });
    return;
  }

  res.setHeader("Set-Cookie", createSessionCookie(user));
  res.status(200).json({ role: user.role, fullName: user.fullName, username: user.username });
};
