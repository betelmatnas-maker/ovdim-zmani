import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api } from "../lib/apiClient";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api("/api/auth/me")
      .then((data) => {
        if (!data.user) {
          router.replace("/login");
        } else if (data.user.role === "admin") {
          router.replace("/admin");
        } else {
          router.replace("/coordinator");
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setChecking(false));
  }, [router]);

  return (
    <div className="ledger-main">
      <p className="hint-text">{checking ? "טוען…" : ""}</p>
    </div>
  );
}
