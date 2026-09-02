import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Shell from "../../components/Shell";
import { api } from "../../lib/apiClient";
import { monthLabel, fmtHours } from "../../lib/hoursClient";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("employees");

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [currentMonth, setCurrentMonth] = useState("");

  const reload = useCallback(async () => {
    const [emps, deps, month] = await Promise.all([
      api("/api/employees"),
      api("/api/departments"),
      api("/api/month"),
    ]);
    setEmployees(emps);
    setDepartments(deps);
    setCurrentMonth(month.currentMonth || "");
  }, []);

  useEffect(() => {
    api("/api/auth/me")
      .then((d) => {
        if (!d.user) { router.replace("/login"); return; }
        if (d.user.role !== "admin") { router.replace("/coordinator"); return; }
        setUser(d.user);
        return reload();
      })
      .finally(() => setLoading(false));
  }, [router, reload]);

  useEffect(() => {
    if (tab === "coordinators" && user) {
      api("/api/users").then(setCoordinators).catch(() => {});
    }
  }, [tab, user]);

  if (loading || !user) return <Shell user={user}><p className="hint-text">טוען…</p></Shell>;

  const tabs = [
    ["employees", "עובדים"],
    ["departments", "מחלקות"],
    ["coordinators", "רכזים"],
    ["month", "חודש נוכחי"],
    ["reports", "דוחות"],
  ];

  return (
    <Shell user={user}>
      <div className="back-bar">
        <h1 className="section-title">חשבת שכר</h1>
      </div>
      <div className="tabbar">
        {tabs.map(([k, l]) => (
          <button key={k} className={"tab " + (tab === k ? "is-active" : "")} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "employees" && <EmployeesTab employees={employees} reload={reload} />}
      {tab === "departments" && <DepartmentsTab departments={departments} reload={reload} />}
      {tab === "coordinators" && (
        <CoordinatorsTab
          coordinators={coordinators}
          reload={() => api("/api/users").then(setCoordinators)}
        />
      )}
      {tab === "month" && <MonthTab currentMonth={currentMonth} reload={reload} />}
      {tab === "reports" && (
        <ReportsTab employees={employees} departments={departments} currentMonth={currentMonth} />
      )}
    </Shell>
  );
}

function EmployeesTab({ employees, reload }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [err, setErr] = useState("");

  const add = async () => {
    setErr("");
    try {
      await api("/api/employees", { method: "POST", body: { firstName, lastName, employeeNumber: number } });
      setFirstName(""); setLastName(""); setNumber("");
      await reload();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    await reload();
  };

  return (
    <div className="panel">
      <div className="ledger-card">
        <h2 className="card-title">הוספת עובד חדש</h2>
        <div className="form-row">
          <label>שם פרטי<input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
          <label>שם משפחה<input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
          <label>מספר עובד<input value={number} onChange={(e) => setNumber(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={add}>הוספה</button>
        </div>
        {err && <div className="form-err">{err}</div>}
      </div>
      <div className="ledger-card">
        <h2 className="card-title">רשימת עובדים ({employees.length})</h2>
        {employees.length === 0 ? <p className="empty-note">עדיין לא הוזנו עובדים.</p> : (
          <table className="ledger-table">
            <thead><tr><th>שם פרטי</th><th>שם משפחה</th><th>מספר עובד</th><th></th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.firstName}</td><td>{e.lastName}</td><td className="mono">{e.employeeNumber}</td>
                  <td className="cell-end"><button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>הסרה</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DepartmentsTab({ departments, reload }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [rate, setRate] = useState("");
  const [err, setErr] = useState("");

  const add = async () => {
    setErr("");
    try {
      await api("/api/departments", { method: "POST", body: { name, departmentNumber: number, rate } });
      setName(""); setNumber(""); setRate("");
      await reload();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    await api(`/api/departments/${id}`, { method: "DELETE" });
    await reload();
  };

  return (
    <div className="panel">
      <div className="ledger-card">
        <h2 className="card-title">הוספת מחלקה</h2>
        <div className="form-row">
          <label>שם המחלקה<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>מספר מחלקה<input value={number} onChange={(e) => setNumber(e.target.value)} /></label>
          <label>תעריף<input value={rate} onChange={(e) => setRate(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={add}>הוספה</button>
        </div>
        {err && <div className="form-err">{err}</div>}
      </div>
      <div className="ledger-card">
        <h2 className="card-title">רשימת מחלקות ({departments.length})</h2>
        {departments.length === 0 ? <p className="empty-note">עדיין לא הוזנו מחלקות.</p> : (
          <table className="ledger-table">
            <thead><tr><th>שם מחלקה</th><th>מספר מחלקה</th><th>תעריף</th><th></th></tr></thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td><td className="mono">{d.departmentNumber}</td><td className="mono">{d.rate}</td>
                  <td className="cell-end"><button className="btn btn-ghost btn-sm" onClick={() => remove(d.id)}>הסרה</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CoordinatorsTab({ coordinators, reload }) {
  const [fullNameVal, setFullNameVal] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const add = async () => {
    setErr("");
    try {
      await api("/api/users", { method: "POST", body: { fullName: fullNameVal, username, password } });
      setFullNameVal(""); setUsername(""); setPassword("");
      await reload();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    await api(`/api/users/${id}`, { method: "DELETE" });
    await reload();
  };

  return (
    <div className="panel">
      <div className="ledger-card">
        <h2 className="card-title">הוספת רכז</h2>
        <p className="hint-text">כל רכז מתחבר עם שם משתמש וסיסמה משלו, כדי שנדע מי דיווח מה.</p>
        <div className="form-row">
          <label>שם מלא<input value={fullNameVal} onChange={(e) => setFullNameVal(e.target.value)} /></label>
          <label>שם משתמש<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
          <label>סיסמה<input type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={add}>הוספה</button>
        </div>
        {err && <div className="form-err">{err}</div>}
      </div>
      <div className="ledger-card">
        <h2 className="card-title">רשימת רכזים ({coordinators.length})</h2>
        {coordinators.length === 0 ? <p className="empty-note">עדיין לא הוזנו רכזים.</p> : (
          <table className="ledger-table">
            <thead><tr><th>שם מלא</th><th>שם משתמש</th><th></th></tr></thead>
            <tbody>
              {coordinators.map((c) => (
                <tr key={c.id}>
                  <td>{c.fullName}</td><td className="mono">{c.username}</td>
                  <td className="cell-end"><button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)}>הסרה</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MonthTab({ currentMonth, reload }) {
  const [val, setVal] = useState(currentMonth);

  useEffect(() => setVal(currentMonth), [currentMonth]);

  const open = async () => {
    if (!val) return;
    await api("/api/month", { method: "POST", body: { month: val } });
    await reload();
  };

  return (
    <div className="panel">
      <div className="ledger-card">
        <h2 className="card-title">מצב נוכחי</h2>
        <p className="stat-line">החודש הפתוח לדיווח כרגע: <strong>{currentMonth ? monthLabel(currentMonth) : "לא נפתח חודש עדיין"}</strong></p>
      </div>
      <div className="ledger-card">
        <h2 className="card-title">פתיחת חודש לדיווח</h2>
        <p className="hint-text">פתיחת חודש חדש סוגרת אוטומטית את הדיווח השוטף לחודש הקודם. דיווחים על חודשים סגורים עדיין אפשריים דרך כפתור ״דיווח הפרשים״ שבמסך הרכז.</p>
        <div className="form-row">
          <label>בחרו חודש<input type="month" value={val} onChange={(e) => setVal(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={open}>פתיחת החודש לדיווח</button>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ employees, departments, currentMonth }) {
  const [rows, setRows] = useState([]);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [busy, setBusy] = useState(null);

  const reloadSummary = useCallback(async () => {
    const data = await api("/api/reports/summary");
    setRows(data.rows);
    setUnpaidTotal(data.unpaidTotal);
  }, []);

  useEffect(() => { reloadSummary(); }, [reloadSummary]);

  const markPaid = async () => {
    await api("/api/corrections/mark-paid", { method: "POST" });
    setConfirmPaid(false);
    await reloadSummary();
  };

  const download = async (url, fallbackName) => {
    setBusy(url);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "שגיאה בהורדת הקובץ.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''(.+)$/);
      const filename = match ? decodeURIComponent(match[1]) : fallbackName;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setBusy(null);
    }
  };

  const sortedDepartments = [...departments].sort((a, b) => a.name.localeCompare(b.name, "he"));
  const deptCount = (depId) => new Set(rows.filter((r) => r.monthly > 0 && r.departmentId === depId).map((r) => r.employeeId)).size;

  return (
    <div className="panel">
      <div className="ledger-card">
        <h2 className="card-title">דוח אקסל מרוכז</h2>
        <p className="hint-text">
          הקובץ כולל שתי לשוניות: ״נוכחות {currentMonth ? monthLabel(currentMonth) : "החודש הנוכחי"}״ עם שעות, ימי עבודה, תעריף וזכאות נסיעות לפי עובד ומחלקה, ו״הפרשים״ עם ההפרשים הממתינים לתשלום ותעריף.
        </p>
        <button className="btn btn-primary" disabled={rows.length === 0 || busy} onClick={() => download("/api/reports/excel", "דוח-מרוכז.xlsx")}>
          {busy === "/api/reports/excel" ? "מוריד…" : "הורדת אקסל מרוכז"}
        </button>
        {rows.length === 0 && <p className="empty-note">אין עדיין נתונים לייצוא.</p>}
      </div>

      <div className="ledger-card">
        <h2 className="card-title">סגירת הפרשים ששולמו</h2>
        <p className="hint-text">הפרשים ממשיכים להופיע בדוחות עד שמסמנים אותם כשולמו — יש לעשות זאת אחרי שהאקסל של החודש הופק וסודר בשכר. הפעולה חלה על כל ההפרשים הלא-משולמים במערכת.</p>
        <p className="stat-line">סה״כ שעות הפרשים ממתינות לתשלום: <strong>{fmtHours(unpaidTotal)}</strong></p>
        {!confirmPaid ? (
          <button className="btn btn-secondary" onClick={() => setConfirmPaid(true)} disabled={unpaidTotal === 0}>סימון כל ההפרשים כשולמו</button>
        ) : (
          <div className="confirm-row">
            <span>לאחר הסימון ההפרשים לא יופיעו יותר בדוחות עתידיים. לאשר?</span>
            <button className="btn btn-primary btn-sm" onClick={markPaid}>אישור וסימון</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmPaid(false)}>ביטול</button>
          </div>
        )}
      </div>

      <div className="ledger-card">
        <h2 className="card-title">דוחות PDF לפי מחלקה</h2>
        <p className="hint-text">לכל מחלקה כפתור נפרד להורדת PDF, עם דף נפרד לכל עובד לפי סדר א׳-ב׳.</p>
        {departments.length === 0 ? <p className="empty-note">עדיין לא הוזנו מחלקות.</p> : (
          <table className="ledger-table">
            <thead><tr><th>מחלקה</th><th>עובדים בדוח</th><th></th></tr></thead>
            <tbody>
              {sortedDepartments.map((d) => {
                const count = deptCount(d.id);
                const url = `/api/reports/pdf/department/${d.id}`;
                return (
                  <tr key={d.id}>
                    <td>{d.name}</td><td className="mono">{count}</td>
                    <td className="cell-end">
                      <button className="btn btn-ghost btn-sm" disabled={count === 0 || busy} onClick={() => download(url, `דוח-${d.name}.pdf`)}>
                        {busy === url ? "מוריד…" : "הורדת PDF למחלקה"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="ledger-card">
        <h2 className="card-title">דוחות עובד בודד (PDF)</h2>
        {employees.length === 0 ? <p className="empty-note">אין עובדים במערכת.</p> : (
          <table className="ledger-table">
            <thead><tr><th>שם</th><th>מספר עובד</th><th></th></tr></thead>
            <tbody>
              {employees.map((e) => {
                const url = `/api/reports/pdf/employee/${e.id}`;
                return (
                  <tr key={e.id}>
                    <td>{e.firstName} {e.lastName}</td><td className="mono">{e.employeeNumber}</td>
                    <td className="cell-end">
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => download(url, `דוח-${e.firstName}-${e.lastName}.pdf`)}>
                        {busy === url ? "מוריד…" : "הורדת PDF"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
