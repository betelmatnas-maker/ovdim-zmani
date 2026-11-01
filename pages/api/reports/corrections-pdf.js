const { requireAuth } = require("../../../lib/auth");
const { getCorrectionRows } = require("../../../lib/correctionsData");
const { htmlToPdfBuffer } = require("../../../lib/pdf");
const { reportDocumentHtml } = require("../../../lib/pdfTemplate");
const { fmtHours } = require("../../../lib/hours");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להוריד דוחות." });
    return;
  }
  const scope = req.query.scope === "all" ? "all" : "pending";
  const rows = await getCorrectionRows(scope);
  if (rows.length === 0) {
    res.status(400).json({ error: "אין הפרשים להצגה." });
    return;
  }

  // group by employee, with a subtotal row
  const groups = [];
  rows.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.employeeId === r.employeeId) last.items.push(r);
    else groups.push({ employeeId: r.employeeId, name: `${r.lastName} ${r.firstName}`, number: r.employeeNumber, items: [r] });
  });
  const body = groups.map((g) => {
    const total = g.items.reduce((s, r) => s + r.hours, 0);
    const lines = g.items.map((r) => `
      <tr>
        <td>${esc(r.date)}</td><td>${esc(r.department)}</td><td>${esc(r.departmentNumber)}</td><td>${esc(r.rate)}</td>
        <td>${esc(r.timeIn)}</td><td>${esc(r.timeOut)}</td><td>${fmtHours(r.hours)}</td>
        <td>${r.paid ? "שולם" : "ממתין"}</td><td>${esc(r.reportedBy)}</td>
      </tr>`).join("");
    return `
      <tr class="grp"><td colspan="9">${esc(g.name)} · מספר עובד ${esc(g.number)} · סה״כ ${fmtHours(total)} שעות</td></tr>
      ${lines}`;
  }).join("");
  const grand = rows.reduce((s, r) => s + r.hours, 0);
  const title = scope === "all" ? "כל ההפרשים שהוזנו" : "הפרשים הממתינים לתשלום";
  const section = `
  <section class="sheet">
    <h2>דוח הפרשים — ${title}</h2>
    <p class="meta">הופק בתאריך ${new Date().toISOString().slice(0, 10)} · סה״כ ${fmtHours(grand)} שעות · ${rows.length} רישומים</p>
    <table style="font-size:11px">
      <thead><tr><th>תאריך עבודה</th><th>מחלקה</th><th>מס׳ מחלקה</th><th>תעריף</th><th>כניסה</th><th>יציאה</th><th>שעות</th><th>סטטוס</th><th>הוזן על ידי</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <style>.grp td { background:#F3EFE5; font-weight:700; }</style>
  </section>`;
  const pdf = await htmlToPdfBuffer(reportDocumentHtml([section]));
  const fname = scope === "all" ? "הפרשים-כל-ההפרשים.pdf" : "הפרשים-ממתינים-לתשלום.pdf";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.status(200).send(pdf);
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
