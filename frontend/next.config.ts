import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.KIRANA_TEST_DIST ?? ".next",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.KIRANA_EXPRESS_URL ?? "http://127.0.0.1:3001"}/api/:path*` }];
  },
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
