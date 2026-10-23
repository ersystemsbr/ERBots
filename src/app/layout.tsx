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
  title: {
    default: "ERBots | Atendentes Virtuais Inteligentes no WhatsApp",
    template: "%s | ERBots",
  },
  description: "Automatize o atendimento no WhatsApp da sua empresa com inteligência artificial humanizada 24h por dia, integração ágil e transbordo inteligente.",
  keywords: [
    "atendente virtual whatsapp",
    "bot whatsapp",
    "inteligencia artificial whatsapp",
    "saas whatsapp",
    "erbots",
    "atendimento 24h",
    "evolution api",
  ],
  authors: [{ name: "ERBots" }],
  openGraph: {
    title: "ERBots | Atendentes Virtuais Inteligentes no WhatsApp",
    description: "Automatize o atendimento no WhatsApp da sua empresa com inteligência artificial humanizada 24 horas por dia.",
    url: "https://erbots.com.br",
    siteName: "ERBots",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
