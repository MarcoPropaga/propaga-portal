import type { Metadata } from "next";
import { Outfit, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-outfit", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: "Portal Propaga",
  description: "Solicitações, valores e entregas dos clientes da Propaga.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${hanken.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
