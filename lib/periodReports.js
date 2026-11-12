const XLSX = require("xlsx");
const prisma = require("./db");
const { hoursBetween, fmtHours, fullName } = require("./hours");
const { htmlToPdfBuffer } = require("./pdf");
const { reportDocumentHtml } = require("./pdfTemplate");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function validatePeriod(from, to) {
  if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) return "יש לבחור תאריך התחלה ותאריך סיום.";
  if (from > to) return "תאריך ההתחלה חייב להיות לפני תאריך הסיום.";
  return null;
}

// Report A - one employee: date | department | time in | time out, chronological.
async function loadEmployeeReport(employeeId, from, to) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return null;
  const [entries, departments] = await Promise.all([
    prisma.attendanceEntry.findMany({ where: { employeeId, date: { gte: from, lte: to } } }),
    prisma.department.findMany(),
  ]);
  const depName = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const rows = entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.timeIn.localeCompare(b.timeIn))
    .map((en) => ({ date: en.date, department: depName[en.departmentId] || "", timeIn: en.timeIn, timeOut: en.timeOut, hours: hoursBetween(en.timeIn, en.timeOut) }));
  return {
    emp, rows,
    totalDays: new Set(rows.map((r) => r.date)).size,
    totalHours: rows.reduce((s, r) => s + r.hours, 0),
  };
}

// Report B - one department: date | employee name | time in | time out, chronological.
async function loadDepartmentReport(departmentId, from, to) {
  const dep = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dep) return null;
  const entries = await prisma.attendanceEntry.findMany({
    where: { departmentId, date: { gte: from, lte: to } },
    include: { employee: true },
  });
  const rows = entries
    .map((en) => ({ date: en.date, name: fullName(en.employee), timeIn: en.timeIn, timeOut: en.timeOut }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.timeIn.localeCompare(b.timeIn) || a.name.localeCompare(b.name, "he"));
  return { dep, rows };
}

function xlsxBuffer(sheetName, aoa, widths) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  wb.Workbook = { Views: [{ RTL: true }] }; // column A on the right
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function employeeXlsx(r) {
  const aoa = [["תאריך", "מחלקה", "שעת כניסה", "שעת יציאה"]];
  r.rows.forEach((x) => aoa.push([x.date, x.department, x.timeIn, x.timeOut]));
  aoa.push([]);
  aoa.push(["סה״כ ימים", r.totalDays]);
  aoa.push(["סה״כ שעות", fmtHours(r.totalHours)]);
  return xlsxBuffer("דוח עובד", aoa, [14, 22, 12, 12]);
}

function departmentXlsx(r) {
  const aoa = [["תאריך", "שם עובד", "כניסה", "יציאה"]];
  r.rows.forEach((x) => aoa.push([x.date, x.name, x.timeIn, x.timeOut]));
  return xlsxBuffer("דוח מחלקה", aoa, [14, 26, 10, 10]);
}

async function employeePdf(r, from, to) {
  const body = r.rows.map((x) => `<tr><td>${esc(x.date)}</td><td>${esc(x.department)}</td><td>${esc(x.timeIn)}</td><td>${esc(x.timeOut)}</td></tr>`).join("");
  const section = `
  <section class="sheet">
    <h2>דוח נוכחות — ${esc(fullName(r.emp))}</h2>
    <p class="meta">מספר עובד: ${esc(r.emp.employeeNumber)} · תקופה: ${esc(from)} עד ${esc(to)}</p>
    <table>
      <thead><tr><th>תאריך</th><th>מחלקה</th><th>שעת כניסה</th><th>שעת יציאה</th></tr></thead>
      <tbody>${body || `<tr><td colspan="4">אין דיווחים בתקופה זו.</td></tr>`}</tbody>
    </table>
    <p class="total">סה״כ ימים: ${r.totalDays} · סה״כ שעות: ${fmtHours(r.totalHours)}</p>
  </section>`;
  return htmlToPdfBuffer(reportDocumentHtml([section]));
}

async function departmentPdf(r, from, to) {
  const body = r.rows.map((x) => `<tr><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.timeIn)}</td><td>${esc(x.timeOut)}</td></tr>`).join("");
  const section = `
  <section class="sheet">
    <h2>דוח נוכחות — מחלקת ${esc(r.dep.name)}</h2>
    <p class="meta">תקופה: ${esc(from)} עד ${esc(to)}</p>
    <table>
      <thead><tr><th>תאריך</th><th>שם עובד</th><th>כניסה</th><th>יציאה</th></tr></thead>
      <tbody>${body || `<tr><td colspan="4">אין דיווחים בתקופה זו.</td></tr>`}</tbody>
    </table>
  </section>`;
  return htmlToPdfBuffer(reportDocumentHtml([section]));
}

function send(res, buffer, fname, format) {
  res.setHeader("Content-Type", format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.status(200).send(buffer);
}

module.exports = {
  validatePeriod, loadEmployeeReport, loadDepartmentReport,
  employeeXlsx, departmentXlsx, employeePdf, departmentPdf, send,
};
