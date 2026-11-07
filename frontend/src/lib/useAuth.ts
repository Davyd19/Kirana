"use client";
import { useEffect, useState } from "react";
import { ambilAuth } from "@/services/kirana";
import type { AuthState } from "./types";
export function useAuth(): AuthState | null | undefined {
  const [auth, setAuth] = useState<AuthState | null>();
  useEffect(() => {
    let active = true;
    const logout = () => setAuth(null);
    const check = () => { ambilAuth().then(a => { if (active) setAuth(a); }).catch(() => { if (active) setAuth(null); }); };
    check();
    window.addEventListener("kirana:logout", logout);
    window.addEventListener("focus", check);
    return () => { active = false; window.removeEventListener("kirana:logout", logout); window.removeEventListener("focus", check); };
  }, []);
  return auth;
}
