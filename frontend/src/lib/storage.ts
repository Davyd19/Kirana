/**
 * Pembungkus localStorage dengan prefix "kirana:".
 * Aman dipanggil saat SSR (mengembalikan null / tidak melakukan apa pun),
 * tetapi hanya boleh dipakai dari client component, di dalam useEffect,
 * handler event, atau useSyncExternalStore.
 */

export const PREFIX = "kirana:";
const EVENT_UBAH = "kirana:storage-berubah";

function tersedia(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function bacaMentah(kunci: string): string | null {
  if (!tersedia()) return null;
  try {
    return window.localStorage.getItem(PREFIX + kunci);
  } catch {
    return null;
  }
}

export function baca<T>(kunci: string): T | null {
  const mentah = bacaMentah(kunci);
  if (mentah === null) return null;
  try {
    return JSON.parse(mentah) as T;
  } catch {
    return null;
  }
}

export function tulis<T>(kunci: string, nilai: T): void {
  if (!tersedia()) return;
  try {
    window.localStorage.setItem(PREFIX + kunci, JSON.stringify(nilai));
  } catch {
    // Storage penuh atau diblokir; pemanggil memeriksa kredensial setelah menyimpan.
  }
  beritahu();
}

export function hapus(kunci: string): void {
  if (!tersedia()) return;
  try {
    window.localStorage.removeItem(PREFIX + kunci);
  } catch {
    // abaikan
  }
  beritahu();
}

/** Hapus semua kunci berawalan "kirana:". */
export function hapusSemua(): void {
  if (!tersedia()) return;
  try {
    const kunci: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) kunci.push(k);
    }
    kunci.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // abaikan
  }
  beritahu();
}

function beritahu() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_UBAH));
}

/**
 * Berlangganan perubahan storage, baik dari tab ini maupun tab lain.
 * Cocok dipakai sebagai argumen `subscribe` untuk useSyncExternalStore.
 */
export function langganan(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) callback();
  };
  window.addEventListener(EVENT_UBAH, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_UBAH, callback);
    window.removeEventListener("storage", onStorage);
  };
}
