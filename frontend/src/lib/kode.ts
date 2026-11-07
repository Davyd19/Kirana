/**
 * Menormalkan input kode kuis dari siswa.
 * "krn 4821", "KRN4821", "4821", "krn-4821" -> "KRN-4821".
 * Mengembalikan null jika bentuknya tidak mungkin kode Kirana.
 */
export function normalkanKode(input: string): string | null {
  const bersih = input.toUpperCase().replace(/[\s-]/g, "");
  const cocok = /^(?:KRN)?(\d{4})$/.exec(bersih);
  return cocok ? `KRN-${cocok[1]}` : null;
}
