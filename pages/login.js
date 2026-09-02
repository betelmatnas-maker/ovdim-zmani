import { useState } from "react";
import { useRouter } from "next/router";
import { api } from "../lib/apiClient";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { username, password } });
      router.push(data.role === "admin" ? "/admin" : "/coordinator");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ledger-main">
      <div className="login-card">
        <h1>דיווח נוכחות לעובדים ממלאי מקום</h1>
        <form onSubmit={submit}>
          <label>
            שם משתמש
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </label>
          <label>
            סיסמה
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {err && <div className="form-err" style={{ marginBottom: 14 }}>{err}</div>}
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "מתחברים…" : "התחברות"}
          </button>
        </form>
      </div>
    </div>
  );
}
