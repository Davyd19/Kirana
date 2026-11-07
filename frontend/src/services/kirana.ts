import { baca, tulis, hapus } from "@/lib/storage";
import { KiranaError, type PatternAssessment, type EvidencePoint, type NumberCategory, type Attempt, type AuthState, type DetailDiagnosis, type HasilSiswa, type Operasi, type Respons, type Ringkasan, type Sesi, type SesiSiswa, type Soal, type StatusBukti } from "@/lib/types";

export async function api<T>(path: string, method = "GET", body?: unknown, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, credentials: "same-origin", cache: "no-store",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  } catch { throw new KiranaError("jaringan", "Layanan belum dapat dihubungi. Periksa koneksi lalu coba lagi."); }
  const data = await response.json().catch(() => ({ message: "Layanan belum tersedia. Coba lagi." }));
  if (!response.ok) {
    if (response.status === 401 && !token) window.dispatchEvent(new Event("kirana:logout"));
    throw new KiranaError(response.status === 401 ? "kredensial_salah" : response.status === 404 ? "kode_tidak_ditemukan" : "jaringan", data.message ?? "Permintaan gagal.");
  }
  return data as T;
}
export const masuk = (email: string, sandi: string) => api<AuthState>("/auth/login", "POST", { email, password: sandi });
export const keluar = async () => { await api("/auth/logout", "POST"); window.dispatchEvent(new Event("kirana:logout")); };
export const ambilAuth = () => api<AuthState>("/auth/me");
type SessionApi = { number_category: NumberCategory | null; quiz_policy_version: string; session_id: string; operation: string; code: string; question_count: number; status: string; created_at: string; closed_at: string | null; submission_count: number; participant_count: number; join_url: string; join_qr_svg: string };
const operasi = (value: string): Operasi => value === "addition" ? "penjumlahan" : "pengurangan";
function sesi(s: SessionApi): Sesi { return { numberCategory: s.number_category, quizPolicyVersion: s.quiz_policy_version, id: s.session_id, kode: s.code, operasi: operasi(s.operation), status: s.status === "open" ? "terbuka" : "ditutup", jumlahSoal: s.question_count, dibuatPada: s.created_at, ditutupPada: s.closed_at, jumlahPengumpulan: s.submission_count, jumlahPeserta: s.participant_count, joinUrl: s.join_url, joinQrSvg: s.join_qr_svg }; }
export async function daftarSesi() { return (await api<{ sessions: SessionApi[] }>("/sessions")).sessions.map(sesi); }
export async function ambilSesi(id: string) { return sesi(await api<SessionApi>(`/sessions/${id}`)); }
export async function buatSesi(op: Operasi, category: NumberCategory) { return sesi(await api<SessionApi>("/sessions", "POST", { number_category: category, operation: op === "penjumlahan" ? "addition" : "subtraction" })); }
export async function tutupSesi(id: string) { return sesi(await api<SessionApi>(`/sessions/${id}/close`, "POST")); }
type QuestionApi = { id: string; position: number; operation: string; operand_1: number; operand_2: number; options: { id: string; value: number }[] };
function soal(q: QuestionApi): Soal { return { id: q.id, urutan: q.position, operandAtas: q.operand_1, operandBawah: q.operand_2, tanda: q.operation === "addition" ? "+" : "−", opsi: q.options.map(o => ({ id: o.id, nilai: o.value })) }; }
type Credentials = { attempt_id: string; student_token: string };
type Progress = { attempt_id: string; nickname: string; submitted_at: string | null; questions: QuestionApi[]; responses: { position: number; kind: string; option_id: string | null }[] };
const credentials = (code: string) => baca<Credentials>(`guest-v1:${code}`);
function requireGuest(code: string) { const c = credentials(code); if (!c) throw new KiranaError("belum_terdaftar", "Isi nama terlebih dahulu."); return c; }
function attempt(p: Progress): Attempt { return { pesertaId: p.attempt_id, nama: p.nickname, dikumpulkanPada: p.submitted_at, urutanTerakhir: p.responses.length + 1, soal: p.questions.map(soal), respons: p.responses.map(r => { const soalId = p.questions[r.position - 1].id; return r.kind === "selected" ? { jenis: "opsi", soalId, opsiId: r.option_id! } : { jenis: r.kind === "skipped" ? "dilewati" : "di_luar_opsi", soalId }; }) }; }
export async function ambilAttempt(code: string): Promise<Attempt | null> { const c = credentials(code); if (!c) return null; return attempt(await api<Progress>(`/attempts/${c.attempt_id}/progress`, "GET", undefined, c.student_token)); }
export async function ambilInfoSesi(code: string): Promise<SesiSiswa> {
  const resolved = await api<{ token: string }>("/join/resolve", "POST", { code });
  return ambilSesiToken(resolved.token);
}
export async function ambilSesiToken(token: string): Promise<SesiSiswa> {
  const s = await api<{ number_category: NumberCategory | null; code: string; operation: string; question_count: number; status: string }>(`/join/${encodeURIComponent(token)}`);
  tulis(`join-v1:${s.code}`, token);
  return { numberCategory: s.number_category, kode: s.code, operasi: operasi(s.operation), jumlahSoal: s.question_count, status: s.status === "open" ? "terbuka" : "ditutup" };
}
export const ambilSesiDenganKode = ambilInfoSesi;
export async function daftarkanPeserta(code: string, nama: string): Promise<Attempt> {
  const existing = await ambilAttempt(code); if (existing) return existing;
  await ambilInfoSesi(code);
  const token = baca<string>(`join-v1:${code}`);
  const guest = await api<Credentials>(`/join/${token}`, "POST", { nickname: nama });
  tulis(`guest-v1:${code}`, { attempt_id: guest.attempt_id, student_token: guest.student_token });
  if (!credentials(code)) throw new KiranaError("jaringan", "Izinkan penyimpanan browser agar pengerjaan bisa dilanjutkan.");
  return (await ambilAttempt(code))!;
}
export async function lepasAttempt(code: string) { hapus(`guest-v1:${code}`); }
export async function simpanRespons(code: string, r: Respons, position: number): Promise<Attempt> {
  const c = requireGuest(code);
  await api(`/attempts/${c.attempt_id}/responses/${position}`, "PUT", { kind: r.jenis === "opsi" ? "selected" : r.jenis === "dilewati" ? "skipped" : "outside_options", ...(r.jenis === "opsi" ? { option_id: r.opsiId } : {}) }, c.student_token);
  return (await ambilAttempt(code))!;
}
export async function kumpulkan(code: string) { const c = requireGuest(code); return api(`/attempts/${c.attempt_id}/finish`, "POST", undefined, c.student_token); }
type ExampleApi = { position: number; operand_1: number; operand_2: number; selected_value: number; correct_value: number };
type ReportApi = { evidence_timeline?: EvidencePoint[]; attempt_id: string; nickname: string; submitted_at: string; summary: { correct: number; wrong: number; outside_options: number; skipped: number }; answers: (Omit<ExampleApi, "selected_value"> & { selected_value: number | null; kind: string })[]; diagnosis: { pattern_assessments: PatternAssessment[]; ambiguous_groups: { patterns: string[]; shared_answers: number; reason: string }[]; model_compatibility: string; diagnosis_policy_version: string; status: string; message?: string | null; patterns: { pattern: string; name: string; matching_answers: number; shown_opportunities: number; follow_up: string; examples: ExampleApi[] }[] } };
const statuses: Record<string, StatusBukti> = { preliminary: "dugaan_awal", ambiguous: "ambigu", supported: "pola_didukung", insufficient_evidence: "belum_cukup", no_pattern_detected: "tanpa_pola", unavailable: "tidak_tersedia" };
function summary(r: ReportApi): Ringkasan { return { benar: r.summary.correct, salah: r.summary.wrong, diLuarOpsi: r.summary.outside_options, dilewati: r.summary.skipped }; }
function hasil(r: ReportApi, id: string): HasilSiswa { return { pesertaId: r.attempt_id, sesiId: id, nama: r.nickname, dikumpulkanPada: r.submitted_at, ringkasan: summary(r), status: statuses[r.diagnosis.status] ?? "tidak_tersedia", jumlahPola: r.diagnosis.patterns.length }; }
export async function daftarHasil(id: string) { return (await api<{ results: ReportApi[] }>(`/sessions/${id}/results`)).results.map(r => hasil(r, id)); }
export const daftarPengumpulan = daftarHasil;
export async function getDiagnosis(id: string, student: string): Promise<DetailDiagnosis> {
  const [s, r] = await Promise.all([ambilSesi(id), api<ReportApi>(`/sessions/${id}/results/${student}`)]);
  const tanda = s.operasi === "penjumlahan" ? "+" as const : "−" as const;
  return { sesi: s, pengumpulan: hasil(r, id), hasil: {
    assessments: r.diagnosis.pattern_assessments, timeline: r.evidence_timeline ?? [], ambiguousGroups: r.diagnosis.ambiguous_groups, modelCompatibility: r.diagnosis.model_compatibility, policyVersion: r.diagnosis.diagnosis_policy_version,
    status: statuses[r.diagnosis.status] ?? "tidak_tersedia", ringkasan: summary(r), ambigu: [],
    pola: r.diagnosis.patterns.map(p => ({ id: p.pattern, nama: p.name, jumlahPendukung: p.matching_answers, jumlahKesempatan: p.shown_opportunities, saran: p.follow_up, contoh: p.examples.map(e => ({ soalId: String(e.position), urutan: e.position, operandAtas: e.operand_1, operandBawah: e.operand_2, tanda, pilihanSiswa: e.selected_value, jawabanBenar: e.correct_value })) })),
    alasanBelumCukup: r.diagnosis.message ?? null, saranBelumCukup: "Minta siswa menunjukkan langkah pengerjaan pada soal serupa.",
    keteranganTanpaPola: "Belum ada pola terdeteksi pada respons sesi ini; hasil ini bukan kepastian bahwa semua materi sudah dikuasai.",
    rincian: r.answers.map(a => ({ urutan: a.position, operandAtas: a.operand_1, operandBawah: a.operand_2, tanda, pilihanSiswa: a.selected_value, jawabanBenar: a.correct_value, jenis: a.kind === "correct" ? "benar" : a.kind === "wrong" ? "salah" : a.kind === "skipped" ? "dilewati" : "di_luar_opsi" }))
  } };
}
