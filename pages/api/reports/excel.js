const XLSX = require("xlsx");
const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { computeReportRows, travelLabel } = require("../../../lib/reportData");
const { monthLabel, fmtHours } = require("../../../lib/hours");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "רק חשבת השכר יכולה להוריד דוחות." });
    return;
  }

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const currentMonth = setting ? setting.currentMonth : null;
  const rows = await computeReportRows(currentMonth);

  const attendanceRows = rows
    .filter((r) => r.monthly > 0)
    .map((r) => ({
      "שם פרטי": r.firstName,
      "שם משפחה": r.lastName,
      "מספר עובד": r.employeeNumber,
      "מחלקה": r.department,
      "מספר מחלקה": r.departmentNumber,
      "שעות עבודה חודשיות": fmtHours(r.monthly),
      "תעריף": r.rate,
      "ימי עבודה חודשיים": r.days,
      "זכאות לנסיעות": travelLabel(r.travel),
    }));

  const correctionRows = rows
    .filter((r) => r.corrections > 0)
    .map((r) => ({
      "שם פרטי": r.firstName,
      "שם משפחה": r.lastName,
      "מספר עובד": r.employeeNumber,
      "מחלקה": r.department,
      "מספר מחלקה": r.departmentNumber,
      "הפרשים ממתינים לתשלום (שעות)": fmtHours(r.corrections),
      "תעריף": r.rate,
    }));

  const wb = XLSX.utils.book_new();

  const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows);
  wsAttendance["!cols"] = [
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(
    wb, wsAttendance, `נוכחות ${currentMonth ? monthLabel(currentMonth) : ""}`.slice(0, 31)
  );

  const wsCorrections = XLSX.utils.json_to_sheet(correctionRows);
  wsCorrections["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 26 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsCorrections, "הפרשים");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fname = `דוח-מרוכז-${currentMonth || "ללא-חודש"}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.status(200).send(buffer);
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
