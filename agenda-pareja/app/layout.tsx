import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Our Journeys ✨",
  description: "Una agenda de nuestras salidas y recuerdos.",
};

const SPOTIFY_PLAYLIST_ID = "3uLsAf1zak0giKxHNNMYFu";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        {/* Fondo global elegante */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0B0F1A] via-[#0E1B2A] to-[#060A12]" />
        <div className="fixed inset-0 -z-10 opacity-50 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_85%_25%,rgba(255,255,255,0.10),transparent_35%),radial-gradient(circle_at_50%_95%,rgba(255,255,255,0.08),transparent_40%)]" />

        {/* Contenido (dejamos espacio para el reproductor fijo) */}
        <div className="pb-28">{children}</div>

        {/* Spotify fijo abajo, siempre visible */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/40 backdrop-blur">
          <div className="mx-auto max-w-6xl px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-white/80">🎵 Música</div>
              <div className="text-[11px] text-white/50">Respira ondo</div>
            </div>
            <iframe
              style={{ borderRadius: 14 }}
              src={`https://open.spotify.com/embed/playlist/${SPOTIFY_PLAYLIST_ID}?utm_source=generator`}
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        </div>
      </body>
    </html>
  );
}
