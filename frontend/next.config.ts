import path from "node:path";
import type { NextConfig } from "next";

// Kirana tahap hackathon adalah aplikasi frontend murni: semua data dibaca dari
// localStorage di client. Cache Components (PPR + <Activity>) sengaja tidak
// diaktifkan karena tidak ada data server yang perlu di-cache, dan perilaku
// "rute tersembunyi tetap ter-mount" menyulitkan state berbasis storage.
const nextConfig: NextConfig = {
  devIndicators: false,
  // Halaman Pengaturan Akun (D4) sudah dihapus; tautan lama diarahkan ke dashboard.
  async redirects() {
    return [{ source: "/guru/pengaturan", destination: "/guru/dashboard", permanent: false }];
  },
  turbopack: {
    // Folder frontend/ adalah root proyek (ada package-lock.json lain di luar repo).
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
