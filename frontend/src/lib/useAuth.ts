"use client";

import { useMemo, useSyncExternalStore } from "react";
import { bacaAuthMentah } from "@/services/kirana";
import { langganan } from "./storage";
import type { AuthState } from "./types";

/**
 * Status login guru.
 * - `undefined`: belum diketahui (render server / sebelum hidrasi selesai)
 * - `null`: belum login
 * - AuthState: sudah login
 *
 * Memakai useSyncExternalStore agar render server dan render hidrasi sama
 * (keduanya `undefined`), lalu React memperbarui ke nilai localStorage.
 */
export function useAuth(): AuthState | null | undefined {
  const mentah = useSyncExternalStore<string | null | undefined>(
    langganan,
    bacaAuthMentah,
    () => undefined,
  );
  return useMemo(() => {
    if (mentah === undefined) return undefined;
    if (mentah === null) return null;
    try {
      return JSON.parse(mentah) as AuthState;
    } catch {
      return null;
    }
  }, [mentah]);
}
