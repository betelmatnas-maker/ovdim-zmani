const { requireAuth } = require("../../../lib/auth");
const { getCorrectionRows } = require("../../../lib/correctionsData");

async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה לצפות בהפרשים." });
    return;
  }
  const rows = await getCorrectionRows(req.query.scope);
  res.status(200).json({ rows, totalHours: rows.reduce((s, r) => s + r.hours, 0) });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
