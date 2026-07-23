import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: "KORAPACT — Investissez dans l'avenir",
  description: "La plateforme d'investissement communautaire. Investissez dès 500 FCFA dans des projets vérifiés.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${sora.variable}`}>
        {children}
      </body>
    </html>
  );
}