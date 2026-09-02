const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "changeme123";
  const fullName = process.env.ADMIN_NAME || "חשבת שכר";

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`המשתמש "${username}" כבר קיים - לא נוצר משתמש חדש.`);
    return;
  }

  await prisma.user.create({
    data: {
      username,
      fullName,
      passwordHash: bcrypt.hashSync(password, 10),
      role: "admin",
    },
  });
  console.log(`נוצר משתמש אדמין: ${username} / ${password}`);
  console.log("חשוב: יש להתחבר ולשנות סיסמה (או לעדכן ADMIN_PASSWORD ולהריץ שוב לפני השימוש הראשון).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
