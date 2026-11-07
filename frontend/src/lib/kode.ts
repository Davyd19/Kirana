/** Normalize the public six-character session code. */
export function normalkanKode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, "");
  const match = /^(?:KRN)?([A-HJ-NP-Z2-9]{6})$/.exec(clean);
  return match ? `KRN-${match[1]}` : null;
}
