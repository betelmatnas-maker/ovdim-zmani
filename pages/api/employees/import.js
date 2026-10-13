const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

// Bulk import: body = { rows: [{ firstName, lastName, employeeNumber, department }, ...] }
// Creates missing employees (matched by employee number), creates missing
// departments automatically, and links each employee to the stated department.
async function handler(req, res) {
  try {
    await run(req, res);
  } catch (e) {
    console.error("import failed", e);
    res.status(500).json({ error: "שגיאת שרת בייבוא: " + String((e && e.message) || e).slice(0, 300) });
  }
}

async function run(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה לייבא עובדים." });
    return;
  }
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) { res.status(400).json({ error: "הקובץ ריק." }); return; }
  if (rows.length > 5000) { res.status(400).json({ error: "יותר מדי שורות (מקסימום 5000)." }); return; }

  const clean = (v) => String(v == null ? "" : v).trim();
  const result = { createdEmployees: 0, updatedEmployees: 0, createdDepartments: 0, links: 0, errors: [] };

  const deptCache = {};
  const existingDepts = await prisma.department.findMany();
  existingDepts.forEach((d) => { deptCache[d.name] = d.id; });

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2; // +1 header, +1 one-based
    const firstName = clean(rows[i].firstName);
    const lastName = clean(rows[i].lastName);
    const employeeNumber = clean(rows[i].employeeNumber);
    const deptName = clean(rows[i].department);
    if (!firstName || !lastName || !employeeNumber) {
      result.errors.push(`שורה ${line}: חסר שם פרטי, שם משפחה או מספר עובד.`);
      continue;
    }
    try {
      let deptId = deptName ? deptCache[deptName] : null;
      if (deptName && !deptId) {
        const dep = await prisma.department.create({ data: { name: deptName, departmentNumber: "", rate: "" } });
        deptId = dep.id;
        deptCache[deptName] = deptId;
        result.createdDepartments++;
      }
      const existing = await prisma.employee.findUnique({ where: { employeeNumber } });
      let empId;
      if (existing) {
        empId = existing.id;
        if (existing.firstName !== firstName || existing.lastName !== lastName) {
          await prisma.employee.update({ where: { id: empId }, data: { firstName, lastName } });
          result.updatedEmployees++;
        }
      } else {
        const emp = await prisma.employee.create({ data: { firstName, lastName, employeeNumber } });
        empId = emp.id;
        result.createdEmployees++;
      }
      if (deptId) {
        const link = await prisma.employeeDepartment.createMany({
          data: [{ employeeId: empId, departmentId: deptId }],
          skipDuplicates: true,
        });
        result.links += link.count;
      }
    } catch (e) {
      result.errors.push(`שורה ${line}: שגיאה בעיבוד (${employeeNumber}).`);
    }
  }
  res.status(200).json(result);
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
