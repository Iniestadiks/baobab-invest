import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "BAOBAB INVEST — Investis dans l'Afrique de demain",
  description: "La plateforme d'investissement communautaire pour la jeunesse africaine. Investis dès 500 FCFA dans des projets locaux vérifiés.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={`${sora.variable} font-sans bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}
