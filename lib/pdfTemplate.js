const { hoursBetween, fmtHours, monthLabel, fullName } = require("./hours");

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Renders one employee's report as an HTML "page" fragment.
function employeeSectionHtml(emp, entries, departmentsById, currentMonth) {
  const depName = (id) => (departmentsById[id] ? departmentsById[id].name : "מחלקה לא ידועה");
  const monthlyEntries = entries.filter(
    (en) => !en.isCorrection && currentMonth && en.date.slice(0, 7) === currentMonth
  );
  const totalMonthly = monthlyEntries.reduce((s, en) => s + hoursBetween(en.timeIn, en.timeOut), 0);
  const totalDays = new Set(monthlyEntries.map((en) => en.date)).size;
  const totalCorrections = entries
    .filter((en) => en.isCorrection && !en.paid)
    .reduce((s, en) => s + hoursBetween(en.timeIn, en.timeOut), 0);

  const rowsHtml = entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (en) => `
      <tr>
        <td>${escapeHtml(en.date)}</td>
        <td>${escapeHtml(depName(en.departmentId))}</td>
        <td>${escapeHtml(en.timeIn)}</td>
        <td>${escapeHtml(en.timeOut)}</td>
        <td>${fmtHours(hoursBetween(en.timeIn, en.timeOut))}</td>
        <td>${en.isCorrection ? (en.paid ? "הפרש (שולם)" : "הפרש") : "שוטף"}</td>
      </tr>`
    )
    .join("");

  return `
  <section class="sheet">
    <h2>דוח נוכחות — ${escapeHtml(fullName(emp))}</h2>
    <p class="meta">מספר עובד: ${escapeHtml(emp.employeeNumber)} · חודש: ${currentMonth ? monthLabel(currentMonth) : "—"}</p>
    <table>
      <thead><tr><th>תאריך</th><th>מחלקה</th><th>כניסה</th><th>יציאה</th><th>שעות</th><th>סוג</th></tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="6">אין רישומים.</td></tr>`}</tbody>
    </table>
    <p class="total">
      סה״כ חודש נוכחי: ${fmtHours(totalMonthly)} שעות · ${totalDays} ימי עבודה ·
      סה״כ הפרשים ממתינים לתשלום: ${fmtHours(totalCorrections)} שעות
    </p>
  </section>`;
}

function reportDocumentHtml(sections) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 28px; }
  body { font-family: 'Arial', 'Segoe UI', sans-serif; color: #22262B; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  h2 { margin: 0 0 4px; font-size: 20px; }
  .meta { color: #5B6169; font-size: 13px; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
  th { text-align: right; font-weight: 600; color: #5B6169; font-size: 11px; padding: 6px 8px; border-bottom: 1px solid #DDD6C8; }
  td { padding: 7px 8px; border-bottom: 1px solid #EEE9DD; }
  .total { font-weight: 600; }
</style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;
}

module.exports = { employeeSectionHtml, reportDocumentHtml };
