const HEB_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return `${HEB_MONTHS[m - 1]} ${y}`;
}

function monthBounds(ym) {
  if (!ym) return { min: "", max: "" };
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { min: `${ym}-01`, max: `${ym}-${String(last).padStart(2, "0")}` };
}

function hoursBetween(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  const [ih, im] = timeIn.split(":").map(Number);
  const [oh, om] = timeOut.split(":").map(Number);
  let start = ih * 60 + im;
  let end = oh * 60 + om;
  if (end < start) end += 24 * 60;
  return (end - start) / 60;
}

function fmtHours(h) {
  return Math.round(h * 100) / 100;
}

function fullName(e) {
  if (!e) return "";
  return `${e.firstName || ""} ${e.lastName || ""}`.trim();
}

module.exports = { HEB_MONTHS, monthLabel, monthBounds, hoursBetween, fmtHours, fullName };
