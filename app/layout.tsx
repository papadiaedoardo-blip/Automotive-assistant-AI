import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vendi la tua auto",
  description: "Assistente AI per vendere un'auto usata, dalla stima al fascicolo per il passaggio di proprietà",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
