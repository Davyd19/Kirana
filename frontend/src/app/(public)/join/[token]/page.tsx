"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ambilSesiToken } from "@/services/kirana";
export default function JoinToken() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    ambilSesiToken(token).then(s => { if (active) router.replace(`/kuis/${s.kode}`); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token, router, retry]);
  return <main className="p-8 text-center"><p role="status">{error || "Membuka sesi kuis..."}</p>{error && <button onClick={() => { setError(""); setRetry(n => n + 1); }}>Coba lagi</button>}</main>;
}
