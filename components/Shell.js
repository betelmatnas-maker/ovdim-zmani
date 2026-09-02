import { useRouter } from "next/router";
import { api } from "../lib/apiClient";

export default function Shell({ user, children }) {
  const router = useRouter();

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div>
      <header className="ledger-header">
        <div className="ledger-mark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.2 2" />
          </svg>
          <span>דיווח נוכחות לעובדים ממלאי מקום</span>
        </div>
        {user && (
          <div className="ledger-user">
            <span>{user.fullName}</span>
            <button className="link-btn" onClick={logout}>התנתקות</button>
          </div>
        )}
      </header>
      <main className="ledger-main">{children}</main>
    </div>
  );
}
