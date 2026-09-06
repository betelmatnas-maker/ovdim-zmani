import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Shell from "../../components/Shell";
import { api } from "../../lib/apiClient";
import { monthLabel, monthBounds, hoursBetween, fmtHours, fullName } from "../../lib/hoursClient";

export default function CoordinatorPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [currentMonth, setCurrentMonth] = useState("");

  const [empId, setEmpId] = useState("");
  const [depId, setDepId] = useState("");
  const [query, setQuery] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [submittedFor, setSubmittedFor] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    api("/api/auth/me")
      .then(async (d) => {
        if (!d.user) { router.replace("/login"); return; }
        setUser(d.user);
        const [emps, deps, month] = await Promise.all([
          api("/api/employees"), api("/api/departments"), api("/api/month"),
        ]);
        setEmployees(emps); setDepartments(deps); setCurrentMonth(month.currentMonth || "");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const emp = employees.find((e) => e.id === empId);
  const filtered = employees.filter((e) => !query || fullName(e).includes(query) || e.employeeNumber.includes(query));

  const startOver = () => { setSubmittedFor(null); setEmpId(""); setDepId(""); setQuery(""); };
  const finish = () => { startOver(); setSessionEnded(true); };

  if (loading || !user) return <Shell user={user}><p className="hint-text">טוען… (אם זו הכניסה הראשונה אחרי זמן מה, זה עשוי לקחת עד כדקה - השרת מתעורר)</p></Shell>;

  if (sessionEnded) {
    return (
      <Shell user={user}>
        <div className="picker-wrap">
          <div className="success-icon" style={{ margin: "0 auto 18px" }}>✓</div>
          <h1 className="picker-title">סיימת לדווח</h1>
          <p className="picker-sub">אפשר לסגור את הדף הזה. תודה על הדיווח!</p>
          <button className="btn btn-ghost" onClick={() => setSessionEnded(false)}>לדווח על עובד נוסף בכל זאת</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell user={user}>
      <div className="back-bar"><h1 className="section-title">דיווח נוכחות — רכז</h1></div>

      <div className="ledger-card">
        <h2 className="card-title">1. בחירת עובד</h2>
        <input
          className="search-input"
          placeholder="חיפוש לפי שם או מספר עובד"
          value={emp ? `${fullName(emp)} · ${emp.employeeNumber}` : query}
          onChange={(e) => { setQuery(e.target.value); setEmpId(""); setDepId(""); }}
          onFocus={() => { if (emp) { setEmpId(""); setQuery(""); } }}
        />
        {!emp && query && (
          <div className="combo-list">
            {filtered.length === 0 && <div className="combo-empty">לא נמצאו עובדים.</div>}
            {filtered.map((e) => (
              <button key={e.id} className="combo-item" onClick={() => { setEmpId(e.id); setQuery(""); }}>
                <span>{fullName(e)}</span><span className="mono">{e.employeeNumber}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {emp && currentMonth && <TravelEligibilityCard empId={empId} currentMonth={currentMonth} />}

      {emp && (
        <div className="ledger-card">
          <h2 className="card-title">3. בחירת מחלקה</h2>
          {departments.length === 0 ? <p className="empty-note">חשבת השכר טרם הזינה מחלקות.</p> : (
            <div className="chip-row">
              {departments.map((d) => (
                <button key={d.id} className={"chip " + (depId === d.id ? "is-active" : "")} onClick={() => setDepId(d.id)}>{d.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {emp && depId && (
        <ReportSheet
          empId={empId}
          depId={depId}
          currentMonth={currentMonth}
          onOpenCorrection={() => setShowCorrection(true)}
          onSubmitted={() => setSubmittedFor(fullName(emp))}
        />
      )}

      {showCorrection && emp && (
        <CorrectionModal empId={empId} departments={departments} onClose={() => setShowCorrection(false)} />
      )}

      {submittedFor && (
        <div className="modal-overlay" onClick={startOver}>
          <div className="modal-box success-box" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon">✓</div>
            <h2 className="card-title">הדיווח נשלח בהצלחה</h2>
            <p className="hint-text">הדיווח עבור {submittedFor} נשלח.</p>
            <div className="success-actions">
              <button className="btn btn-primary" onClick={startOver}>דיווח על עובד נוסף</button>
              <button className="btn btn-ghost" onClick={finish}>סיום</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function TravelEligibilityCard({ empId, currentMonth }) {
  const [value, setValue] = useState(undefined);

  useEffect(() => {
    setValue(undefined);
    api(`/api/travel?employeeId=${empId}&month=${currentMonth}`).then((d) => setValue(d.status));
  }, [empId, currentMonth]);

  const setStatus = async (status) => {
    setValue(status);
    await api("/api/travel", { method: "POST", body: { employeeId: empId, month: currentMonth, status } });
  };

  return (
    <div className="ledger-card">
      <h2 className="card-title">2. זכאות לנסיעות — {monthLabel(currentMonth)}</h2>
      <p className="hint-text">מסמנים פעם אחת לחודש עבור העובד, ללא קשר למחלקה שבה עובד החודש.</p>
      <div className="chip-row">
        <button className={"chip " + (value === "eligible" ? "is-active" : "")} onClick={() => setStatus("eligible")}>זכאי לנסיעות</button>
        <button className={"chip " + (value === "not_eligible" ? "is-active" : "")} onClick={() => setStatus("not_eligible")}>לא זכאי לנסיעות</button>
      </div>
      {!value && <p className="empty-note" style={{ marginTop: 10 }}>עדיין לא סומן לחודש זה.</p>}
    </div>
  );
}

function ReportSheet({ empId, depId, currentMonth, onOpenCorrection, onSubmitted }) {
  const [entries, setEntries] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const bounds = monthBounds(currentMonth);
  const [date, setDate] = useState(bounds.min || "");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [err, setErr] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await fetch(`/api/reports/pdf/employee/${empId}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "שגיאה בהורדת הקובץ. נסו שוב בעוד כמה שניות.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''(.+)$/);
      const filename = match ? decodeURIComponent(match[1]) : "דוח-נוכחות.pdf";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert("שגיאת רשת בהורדת הקובץ. נסו שוב.");
    } finally {
      setPdfBusy(false);
    }
  };

  const reload = useCallback(async () => {
    const [all, sub] = await Promise.all([
      api(`/api/attendance?employeeId=${empId}`),
      api(`/api/submissions?employeeId=${empId}&departmentId=${depId}&month=${currentMonth}`),
    ]);
    setEntries(all.filter((en) => !en.isCorrection && en.departmentId === depId && en.date.slice(0, 7) === currentMonth));
    setSubmitted(sub.submitted);
  }, [empId, depId, currentMonth]);

  useEffect(() => { reload(); }, [reload]);

  const total = entries.reduce((s, en) => s + hoursBetween(en.timeIn, en.timeOut), 0);

  const addRow = async () => {
    if (!date || !timeIn || !timeOut) { setErr("יש למלא תאריך, שעת כניסה ושעת יציאה."); return; }
    setErr("");
    try {
      await api("/api/attendance", { method: "POST", body: { employeeId: empId, departmentId: depId, date, timeIn, timeOut } });
      setTimeIn(""); setTimeOut("");
      await reload();
    } catch (e) { setErr(e.message); }
  };

  const removeRow = async (id) => {
    await api(`/api/attendance/${id}`, { method: "DELETE" });
    await reload();
  };

  const submit = async () => {
    await api("/api/submissions", { method: "POST", body: { employeeId: empId, departmentId: depId, month: currentMonth, submitted: true } });
    setSubmitted(true);
    if (onSubmitted) onSubmitted();
  };

  const reopen = async () => {
    await api("/api/submissions", { method: "POST", body: { employeeId: empId, departmentId: depId, month: currentMonth, submitted: false } });
    setSubmitted(false);
  };

  return (
    <div className="ledger-card">
      <div className="sheet-head">
        <h2 className="card-title">4. גיליון דיווח — {monthLabel(currentMonth)}</h2>
        <span className={"badge " + (submitted ? "badge-submitted" : "badge-draft")}>{submitted ? "נשלח" : "בעריכה"}</span>
      </div>
      <table className="ledger-table">
        <thead><tr><th>תאריך</th><th>כניסה</th><th>יציאה</th><th>שעות</th>{!submitted && <th></th>}</tr></thead>
        <tbody>
          {entries.map((en) => (
            <tr key={en.id}>
              <td>{en.date}</td><td>{en.timeIn}</td><td>{en.timeOut}</td><td>{fmtHours(hoursBetween(en.timeIn, en.timeOut))}</td>
              {!submitted && <td className="cell-end"><button className="btn btn-ghost btn-sm" onClick={() => removeRow(en.id)}>הסרה</button></td>}
            </tr>
          ))}
          {entries.length === 0 && <tr><td colSpan={5}>עדיין לא דווחו שעות החודש.</td></tr>}
        </tbody>
      </table>
      <p className="stat-line">סה״כ שעות שדווחו: <strong>{fmtHours(total)}</strong></p>

      {!submitted && (
        <>
          <div className="form-row">
            <label>תאריך<input type="date" min={bounds.min} max={bounds.max} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>שעת כניסה<input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} /></label>
            <label>שעת יציאה<input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} /></label>
            <button className="btn btn-secondary" onClick={addRow}>הוספת שורה</button>
          </div>
          {err && <div className="form-err">{err}</div>}
        </>
      )}

      <div className="sheet-actions">
        {!submitted ? (
          <button className="btn btn-primary" onClick={submit} disabled={entries.length === 0}>שליחת דיווח</button>
        ) : (
          <button className="btn btn-secondary" onClick={reopen}>המשך לדווח</button>
        )}
        <button className="btn btn-ghost" onClick={onOpenCorrection}>דיווח הפרשים</button>
        <button className="btn btn-ghost" onClick={downloadPdf} disabled={pdfBusy}>
          {pdfBusy ? "מכין קובץ…" : "הורדת PDF"}
        </button>
      </div>
    </div>
  );
}

function CorrectionModal({ empId, departments, onClose }) {
  const [depId, setDepId] = useState(departments[0]?.id || "");
  const [date, setDate] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [err, setErr] = useState("");
  const [corrections, setCorrections] = useState([]);

  const reload = useCallback(async () => {
    const all = await api(`/api/attendance?employeeId=${empId}`);
    setCorrections(all.filter((en) => en.isCorrection).sort((a, b) => b.date.localeCompare(a.date)));
  }, [empId]);

  useEffect(() => { reload(); }, [reload]);

  const add = async () => {
    if (!depId || !date || !timeIn || !timeOut) { setErr("יש למלא מחלקה, תאריך, שעת כניסה ושעת יציאה."); return; }
    setErr("");
    try {
      await api("/api/attendance", { method: "POST", body: { employeeId: empId, departmentId: depId, date, timeIn, timeOut, isCorrection: true } });
      setDate(""); setTimeIn(""); setTimeOut("");
      await reload();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    try {
      await api(`/api/attendance/${id}`, { method: "DELETE" });
      await reload();
    } catch (e) { alert(e.message); }
  };

  const depName = (id) => (departments.find((d) => d.id === id) || {}).name || "";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="card-title">דיווח הפרשים</h2>
          <button className="link-btn" onClick={onClose}>סגירה ✕</button>
        </div>
        <p className="hint-text">גיליון זה מיועד לדיווח שעות על חודשים שכבר נסגרו לדיווח שוטף.</p>
        <div className="form-row">
          <label>מחלקה
            <select value={depId} onChange={(e) => setDepId(e.target.value)}>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>תאריך<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>שעת כניסה<input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} /></label>
          <label>שעת יציאה<input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={add}>הוספה</button>
        </div>
        {err && <div className="form-err">{err}</div>}

        <table className="ledger-table">
          <thead><tr><th>תאריך</th><th>מחלקה</th><th>כניסה</th><th>יציאה</th><th>שעות</th><th>סטטוס</th><th></th></tr></thead>
          <tbody>
            {corrections.map((en) => (
              <tr key={en.id}>
                <td>{en.date}</td><td>{depName(en.departmentId)}</td><td>{en.timeIn}</td><td>{en.timeOut}</td>
                <td>{fmtHours(hoursBetween(en.timeIn, en.timeOut))}</td>
                <td>{en.paid ? "שולם" : "ממתין לתשלום"}</td>
                <td className="cell-end">{!en.paid && <button className="btn btn-ghost btn-sm" onClick={() => remove(en.id)}>הסרה</button>}</td>
              </tr>
            ))}
            {corrections.length === 0 && <tr><td colSpan={7}>אין עדיין דיווחי הפרשים לעובד זה.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
