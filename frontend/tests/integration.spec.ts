import { test, expect } from "@playwright/test";

test("teacher and mobile guest use real sessions, adaptive questions and results", async ({ page, browser }) => {
  test.skip(!process.env.KIRANA_E2E_PASSWORD, "Run with the isolated MySQL test runner --browser.");
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email Guru", { exact: true }).fill("e2e@kirana.local");
  await page.getByLabel("Kata Sandi", { exact: true }).fill(process.env.KIRANA_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/guru\/dashboard/);
  for (const op of ["Penjumlahan", "Pengurangan"]) {
    await page.goto("/guru/sesi/buat");
    await page.getByRole("button", { name: new RegExp(op + " Bersusun", "i") }).click();
    await expect(page.getByRole("button", { name: "Buat Sesi Kuis", exact: true })).toBeDisabled();
    await page.getByRole("radio", { name: "Puluhan", exact: true }).check();
    await page.getByRole("button", { name: "Buat Sesi Kuis", exact: true }).click();
    await expect(page.getByLabel("Tautan bergabung")).toBeVisible();
    const joinUrl = await page.getByLabel("Tautan bergabung").inputValue();
    const sessionId = new URL(page.url()).pathname.split("/").at(-1)!;
    const session = await (await page.request.get(`/api/sessions/${sessionId}`)).json();
    expect(joinUrl).toBe(session.join_url);
    const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const student = await studentContext.newPage();
    student.on("pageerror", e => errors.push(e.message));
    if (op === "Penjumlahan") {
      await student.goto(`${process.env.KIRANA_TEST_BASE_URL ?? "http://localhost:3000"}/join`);
      await student.getByLabel("Kode Kuis", { exact: true }).fill(session.code);
      await student.getByRole("button", { name: "Cek Kode" }).click();
    } else { await student.goto(joinUrl); }
    await student.getByLabel("Nama Panggilan").fill("Siswa " + op);
    await student.getByRole("button", { name: "Mulai Mengerjakan" }).click();
    for (let n = 1; n <= 15; n++) {
      await expect(student).toHaveURL(new RegExp(`/kerjakan/${n}$`));
      await expect(student.getByRole("radio")).toHaveCount(4);
      if (n === 2) {
        const before = await student.getByRole("radio").allTextContents();
        await student.reload();
        await expect(student.getByRole("radio")).toHaveCount(4);
        expect(await student.getByRole("radio").allTextContents()).toEqual(before);
        // Closing blocks new guests, but does not prevent this student finishing.
        await page.request.post(`/api/sessions/${sessionId}/close`);
        const denied = await student.request.post(`/api/join/${new URL(joinUrl).pathname.split("/").at(-1)}`, { data: { nickname: "Late" } });
        expect(denied.status()).toBe(409);
      }
      if (n === 1) {
        await student.getByRole("radio").first().click();
        await student.screenshot({ path: test.info().outputPath(`student-${op}.png`), fullPage: true });
        // Lose the response after server acceptance; retry must not skip a question.
        await student.route("**/responses/1", async route => { await route.fetch(); await route.abort(); }, { times: 1 });
        await student.getByRole("button", { name: "Lanjut", exact: true }).click();
        await expect(student.getByRole("alert")).toBeVisible();
        await student.getByRole("button", { name: "Lanjut", exact: true }).click();
      } else if (n === 3) {
        await student.getByRole("button", { name: "Hasil saya tidak ada di pilihan" }).click();
        await student.getByRole("button", { name: "Lanjut", exact: true }).click();
      } else { await student.getByRole("button", { name: "Lewati", exact: true }).click(); }
    }
    await expect(student).toHaveURL(/konfirmasi$/);
    await expect(student.getByRole("link", { name: /Kembali ke soal/ })).toHaveCount(0);
    await student.getByRole("button", { name: "Kumpulkan Jawaban" }).click();
    await expect(student.getByRole("heading", { name: "Jawabanmu sudah dikumpulkan." })).toBeVisible();
    await student.reload();
    await expect(student.getByRole("heading", { name: "Jawabanmu sudah dikumpulkan." })).toBeVisible();
    const reports = await (await page.request.get(`/api/sessions/${sessionId}/results`)).json();
    expect(reports.results).toHaveLength(1);
    expect(reports.results[0].answers).toHaveLength(15);
    await page.goto(`/guru/hasil/${sessionId}/siswa/${reports.results[0].attempt_id}`);
    await expect(page.getByRole("heading", { name: "Siswa " + op, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rincian 15 jawaban" })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`report-${op}.png`), fullPage: true });
    await expect(page.getByRole("heading", { name: "Jumlah kecocokan jawaban", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Perkembangan bukti soal 1–15" })).toBeVisible();
    await page.getByLabel("Lihat respons soal").selectOption("1");
    await expect(page.getByText("Soal 1:", { exact: false }).last()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: test.info().outputPath(`report-mobile-${op}.png`), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await studentContext.close();
  }
  expect(errors).toEqual([]);
});
