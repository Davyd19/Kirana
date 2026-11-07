import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, JetBrains_Mono, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Gaya lama (B4, D1, D3, tabel B2)
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// Gaya baru (kirana_interactive_canvas)
const poppins = Poppins({
  variable: "--font-poppins-next",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains-next",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Kirana",
    template: "%s · Kirana",
  },
  description:
    "Asesmen diagnostik penjumlahan dan pengurangan bersusun untuk guru SD.",
  icons: { icon: "/gambar/logokirana.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${plexMono.variable} ${poppins.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
