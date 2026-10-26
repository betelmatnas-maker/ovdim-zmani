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

  if (loading || !user) return <Shell user={user}><p className="hint-text">טוען… (אם זו הכניסה הראשונה אחרי זמן מה, זה עשוי לקחת עד כדקה - השרת מתעורר)</p></Shell>;

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

      {tab === "employees" && <EmployeesTab employees={employees} departments={departments} reload={reload} />}
      {tab === "departments" && <DepartmentsTab departments={departments} reload={reload} />}
      {tab === "coordinators" && (
        <CoordinatorsTab
          coordinators={coordinators}
          departments={departments}
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

function EmployeesTab({ employees, departments, reload }) {
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
    if (!window.confirm("הסרת עובד מוחקת גם את כל דיווחי הנוכחות שלו ואי אפשר לשחזר. אם העובד פשוט לא עובד כרגע, עדיף לסמן אותו כ'לא פעיל'. למחוק?")) return;
    await api(`/api/employees/${id}`, { method: "DELETE" });
    await reload();
  };

  const [selected, setSelected] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusMsg, setStatusMsg] = useState("");

  const visible = employees.filter((e) => {
    if (statusFilter === "active" && e.active === false) return false;
    if (statusFilter === "inactive" && e.active !== false) return false;
    const q = filterText.trim();
    if (!q) return true;
    return (e.lastName + " " + e.firstName).includes(q) || e.employeeNumber.includes(q);
  });
  const allVisibleSelected = visible.length > 0 && visible.every((e) => selected.includes(e.id));
  const toggleOne = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAll = () => setSelected(allVisibleSelected
    ? selected.filter((id) => !visible.some((e) => e.id === id))
    : Array.from(new Set([...selected, ...visible.map((e) => e.id)])));

  const setStatus = async (ids, active) => {
    setStatusMsg("");
    try {
      const r = await api("/api/employees/status", { method: "POST", body: { employeeIds: ids, active } });
      setStatusMsg(`${r.changed} עובדים סומנו כ${active ? "פעילים" : "לא פעילים"}.`);
      setSelected([]);
      await reload();
    } catch (e) { setStatusMsg(e.message); }
  };

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["שם משפחה", "שם פרטי", "מספר עובד"],
      ["כהן", "דנה", "1001"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "עובדים");
    XLSX.writeFile(wb, "תבנית-ייבוא-עובדים.xlsx");
  };

  const onFile = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const table = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const rows = table.slice(1)
        .filter((r) => r.some((c) => String(c).trim() !== ""))
        .map((r) => ({ lastName: r[0], firstName: r[1], employeeNumber: r[2], department: r[3] }));
      if (rows.length === 0) throw new Error("לא נמצאו שורות בקובץ. ודאי שהשורה הראשונה היא כותרות.");
      const result = await api("/api/employees/import", { method: "POST", body: { rows } });
      setImportMsg({ ok: true, result });
      await reload();
    } catch (e) {
      setImportMsg({ ok: false, text: e.message });
    } finally { setImporting(false); }
  };

  return (
    <div className="panel">
      <div className="ledger-card">
        <h2 className="card-title">ייבוא עובדים מקובץ אקסל</h2>
        <p className="empty-note">
          העמודות בקובץ, לפי הסדר: שם משפחה | שם פרטי | מספר עובד (השורה הראשונה היא כותרות).
          אפשר להוסיף עמודה רביעית "מחלקה" - אם תמולא, המחלקה תיווצר אוטומטית והעובד ישויך אליה.
        </p>
        <div className="form-row">
          <label className="btn btn-primary" style={{ cursor: "pointer" }}>
            {importing ? "מייבא..." : "בחירת קובץ אקסל"}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={importing} style={{ display: "none" }} />
          </label>
          <button className="btn btn-ghost" onClick={downloadTemplate}>הורדת תבנית לדוגמה</button>
        </div>
        {importMsg && importMsg.ok && (
          <div className="form-ok">
            הייבוא הסתיים: נוספו {importMsg.result.createdEmployees} עובדים, עודכנו {importMsg.result.updatedEmployees},
            נוצרו {importMsg.result.createdDepartments} מחלקות חדשות, שויכו {importMsg.result.links} שיוכים.
            {importMsg.result.errors.length > 0 && (
              <div className="form-err">
                {importMsg.result.errors.slice(0, 20).map((m, i) => <div key={i}>{m}</div>)}
                {importMsg.result.errors.length > 20 && <div>ועוד {importMsg.result.errors.length - 20} שגיאות...</div>}
              </div>
            )}
          </div>
        )}
        {importMsg && !importMsg.ok && <div className="form-err">{importMsg.text}</div>}
      </div>
      <div className="ledger-card">
        <h2 className="card-title">הוספת עובד חדש</h2>
        <div className="form-row">
          <label>שם משפחה<input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
          <label>שם פרטי<input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
          <label>מספר עובד<input value={number} onChange={(e) => setNumber(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={add}>הוספה</button>
        </div>
        {err && <div className="form-err">{err}</div>}
      </div>
      <div className="ledger-card">
        <h2 className="card-title">רשימת עובדים ({employees.length})</h2>
        <div className="form-row">
          <label>חיפוש<input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="שם או מספר עובד" /></label>
          <label>הצגה
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">כל העובדים</option>
              <option value="active">פעילים בלבד</option>
              <option value="inactive">לא פעילים בלבד</option>
            </select>
          </label>
          <button className="btn btn-primary" disabled={!selected.length} onClick={() => setStatus(selected, true)}>סימון המסומנים ({selected.length}) כפעילים</button>
          <button className="btn btn-ghost" disabled={!selected.length} onClick={() => setStatus(selected, false)}>סימון המסומנים כלא פעילים</button>
        </div>
        <p className="hint-text">עובד "לא פעיל" לא מופיע ברשימה שהרכזים רואים, ודיווחים קודמים שלו נשמרים.</p>
        {statusMsg && <div className="form-ok">{statusMsg}</div>}
        {employees.length === 0 ? <p className="empty-note">עדיין לא הוזנו עובדים.</p> : (
          <table className="ledger-table">
            <thead><tr><th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} title="סימון כל המוצגים" /></th><th>שם משפחה</th><th>שם פרטי</th><th>מספר עובד</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} style={e.active === false ? { opacity: 0.55 } : undefined}>
                  <td><input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggleOne(e.id)} /></td>
                  <td>{e.lastName}</td><td>{e.firstName}</td><td className="mono">{e.employeeNumber}</td>
                  <td>{e.active === false ? "לא פעיל" : "פעיל"}</td>
                  <td className="cell-end">
                    <button className="btn btn-ghost btn-sm" onClick={() => setStatus([e.id], e.active === false)}>{e.active === false ? "הפעלה" : "השבתה"}</button>{" "}
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>הסרה</button>
                  </td>
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

  const [editId, setEditId] = useState(null);
  const [editNum, setEditNum] = useState("");
  const [editRate, setEditRate] = useState("");
  const startEdit = (d) => { setEditId(d.id); setEditNum(d.departmentNumber); setEditRate(d.rate); };
  const saveEdit = async () => {
    try {
      await api(`/api/departments/${editId}`, { method: "PATCH", body: { departmentNumber: editNum, rate: editRate } });
      setEditId(null);
      await reload();
    } catch (e) { setErr(e.message); }
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
                  <td>{d.name}</td>
                  {editId === d.id ? (
                    <>
                      <td><input value={editNum} onChange={(e) => setEditNum(e.target.value)} /></td>
                      <td><input value={editRate} onChange={(e) => setEditRate(e.target.value)} /></td>
                      <td className="cell-end">
                        <button className="btn btn-primary btn-sm" onClick={saveEdit}>שמירה</button>{" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>ביטול</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="mono">{d.departmentNumber}</td><td className="mono">{d.rate}</td>
                      <td className="cell-end">
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(d)}>עריכה</button>{" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => remove(d.id)}>הסרה</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CoordinatorsTab({ coordinators, departments, reload }) {
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

  const [permId, setPermId] = useState(null);
  const [permIds, setPermIds] = useState([]);
  const openPerm = (c) => { setPermId(c.id); setPermIds(c.departmentIds || []); };
  const togglePerm = (id) => setPermIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const savePerm = async () => {
    setErr("");
    try {
      await api(`/api/users/${permId}`, { method: "PATCH", body: { departmentIds: permIds } });
      setPermId(null);
      await reload();
    } catch (e) { setErr(e.message); }
  };
  const depLabel = (c) => {
    const names = (c.departmentIds || []).map((id) => (departments.find((d) => d.id === id) || {}).name).filter(Boolean);
    return names.length ? names.join(", ") : "ללא מחלקות - לא רואה כלום";
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
            <thead><tr><th>שם מלא</th><th>שם משתמש</th><th>מחלקות מורשות</th><th></th></tr></thead>
            <tbody>
              {coordinators.map((c) => (
                <tr key={c.id}>
                  <td>{c.fullName}</td><td className="mono">{c.username}</td><td>{depLabel(c)}</td>
                  <td className="cell-end">
                    <button className="btn btn-ghost btn-sm" onClick={() => openPerm(c)}>הרשאות מחלקות</button>{" "}
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)}>הסרה</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {permId && (
          <div className="ledger-card">
            <h3 className="card-title">באילו מחלקות הרכז רשאי לדווח?</h3>
            {departments.length === 0 ? <p className="empty-note">אין עדיין מחלקות.</p> : (
              <div className="chip-row">
                {departments.map((d) => (
                  <label key={d.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", marginInlineEnd: 16 }}>
                    <input type="checkbox" checked={permIds.includes(d.id)} onChange={() => togglePerm(d.id)} />
                    {d.name}
                  </label>
                ))}
              </div>
            )}
            <div className="form-row">
              <button className="btn btn-primary" onClick={savePerm}>שמירה</button>
              <button className="btn btn-ghost" onClick={() => setPermId(null)}>ביטול</button>
            </div>
          </div>
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
      let res;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          res = await fetch(url, { credentials: "include" });
          break;
        } catch (networkErr) {
          if (attempt === 3) throw networkErr;
          await new Promise((r) => setTimeout(r, attempt * 1500));
        }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "שגיאה בהורדת הקובץ. אם זו הפעולה הראשונה אחרי זמן מה, ייתכן שהשרת עדיין מתעורר - נסו שוב בעוד כמה שניות.");
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
    } catch (e) {
      alert("שגיאת רשת בהורדת הקובץ. נסו שוב בעוד כמה שניות.");
    } finally {
      setBusy(null);
    }
  };

  const monthStart = currentMonth ? `${currentMonth}-01` : "";
  const monthEnd = currentMonth
    ? `${currentMonth}-${String(new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)), 0).getDate()).padStart(2, "0")}`
    : "";
  const [periodEmp, setPeriodEmp] = useState("");
  const [periodQuery, setPeriodQuery] = useState("");
  const periodMatches = employees.filter((e) => {
    const q = periodQuery.trim();
    return !q || (e.lastName + " " + e.firstName).includes(q) || (e.firstName + " " + e.lastName).includes(q) || e.employeeNumber.includes(q);
  }).slice(0, 50);
  const periodSelectedLabel = periodEmp === "all" ? "כל העובדים (דף לכל עובד)"
    : (() => { const e = employees.find((x) => x.id === periodEmp); return e ? `${e.lastName} ${e.firstName} · ${e.employeeNumber}` : ""; })();
  const [periodFrom, setPeriodFrom] = useState(monthStart);
  const [periodTo, setPeriodTo] = useState(monthEnd);
  useEffect(() => { setPeriodFrom((v) => v || monthStart); setPeriodTo((v) => v || monthEnd); }, [monthStart, monthEnd]);
  const periodUrl = `/api/reports/pdf/period?employeeId=${encodeURIComponent(periodEmp)}&from=${periodFrom}&to=${periodTo}`;
  const periodReady = periodEmp && periodFrom && periodTo && periodFrom <= periodTo;

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
        <h2 className="card-title">דוח לפי תקופה</h2>
        <p className="hint-text">בחרי עובד (או כל העובדים) ותקופה, ואפשר להוריד PDF עם כל הדיווחים שלו בתקופה, מסוכם לפי מחלקה.</p>
        <div className="form-row">
          <label style={{ flex: "1 1 280px" }}>עובד
            <input
              className="search-input"
              placeholder="חיפוש לפי שם משפחה, שם פרטי או מספר עובד"
              value={periodEmp ? periodSelectedLabel : periodQuery}
              onChange={(e) => { setPeriodQuery(e.target.value); setPeriodEmp(""); }}
              onFocus={() => { if (periodEmp) { setPeriodEmp(""); setPeriodQuery(""); } }}
            />
            {!periodEmp && (
              <div className="combo-list">
                {!periodQuery.trim() && (
                  <button type="button" className="combo-item" onClick={() => { setPeriodEmp("all"); setPeriodQuery(""); }}>
                    <span>כל העובדים (דף לכל עובד)</span><span></span>
                  </button>
                )}
                {periodMatches.length === 0 && <div className="combo-empty">לא נמצאו עובדים.</div>}
                {periodMatches.map((e) => (
                  <button type="button" key={e.id} className="combo-item" onClick={() => { setPeriodEmp(e.id); setPeriodQuery(""); }}>
                    <span>{e.lastName} {e.firstName}</span><span className="mono">{e.employeeNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>מתאריך<input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} /></label>
          <label>עד תאריך<input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} /></label>
          <button className="btn btn-primary" disabled={!periodReady || busy} onClick={() => download(periodUrl, "דוח-תקופה.pdf")}>
            {busy === periodUrl ? "מכין..." : "הורדת PDF"}
          </button>
        </div>
      </div>

      <div className="ledger-card">
        <h2 className="card-title">דוחות לפי מחלקה (PDF ואקסל)</h2>
        <p className="hint-text">לכל מחלקה אפשר להוריד PDF (דף נפרד לכל עובד לפי סדר א׳-ב׳) או קובץ אקסל של המחלקה לחודש הנוכחי.</p>
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
                        {busy === url ? "מוריד…" : "הורדת PDF"}
                      </button>{" "}
                      <button className="btn btn-ghost btn-sm" disabled={count === 0 || busy} onClick={() => download(`/api/reports/excel?departmentId=${d.id}`, `דוח-${d.name}.xlsx`)}>
                        {busy === `/api/reports/excel?departmentId=${d.id}` ? "מוריד…" : "הורדת אקסל"}
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
            <thead><tr><th>שם</th><th>מספר עובד</th><th>מחלקות</th><th></th></tr></thead>
            <tbody>
              {employees.map((e) => {
                const url = `/api/reports/pdf/employee/${e.id}`;
                return (
                  <tr key={e.id}>
                    <td>{e.lastName} {e.firstName}</td><td className="mono">{e.employeeNumber}</td>
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
