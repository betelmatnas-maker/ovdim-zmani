const prisma = require("../../../lib/db");
const { hashPassword } = require("../../../lib/auth");

// One-time setup helper: visiting this URL in the browser (with the right
// secret key) creates the initial payroll-clerk (admin) account, so there's
// no need for shell/CLI access on hosts where that isn't available.
//
// Example: https://your-app.onrender.com/api/setup/init?key=YOUR_SETUP_SECRET
module.exports = async function handler(req, res) {
  const { key } = req.query;
  const expected = process.env.SETUP_SECRET;

  if (!expected) {
    res.status(500).send("SETUP_SECRET לא הוגדר בהגדרות הסביבה (Environment) של האירוח.");
    return;
  }
  if (!key || key !== expected) {
    res.status(403).send("מפתח לא תקין.");
    return;
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "changeme123";
  const fullName = process.env.ADMIN_NAME || "חשבת שכר";

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(200).send(`המשתמש "${username}" כבר קיים - לא נוצר משתמש נוסף. אפשר פשוט להתחבר.`);
    return;
  }

  await prisma.user.create({
    data: { username, fullName, passwordHash: hashPassword(password), role: "admin" },
  });

  res.status(200).send(
    `נוצר בהצלחה משתמש חשבת שכר בשם משתמש "${username}". אפשר לחזור לעמוד ההתחברות ולהיכנס עם השם והסיסמה שהגדרת.`
  );
};

module.exports.default = module.exports;
