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
  metadataBase: new URL("https://www.erbots.com.br"),
  title: {
    default: "ERBots | Atendentes Virtuais Inteligentes no WhatsApp",
    template: "%s | ERBots",
  },
  description:
    "Automatize o atendimento no WhatsApp da sua empresa 24h por dia com IA humanizada que entende texto, áudio e fotos, Live Chat em tempo real e transbordo inteligente.",
  keywords: [
    "atendente virtual whatsapp",
    "automação whatsapp ia",
    "inteligencia artificial whatsapp",
    "chatbot whatsapp empresas",
    "erbots",
    "atendimento automatico 24h",
  ],
  authors: [{ name: "ERBots — ER Systems" }],
  openGraph: {
    title: "ERBots | Atendentes Virtuais Inteligentes no WhatsApp",
    description:
      "Automatize o atendimento no WhatsApp da sua empresa 24h por dia com IA humanizada que entende texto, áudio e fotos.",
    url: "https://www.erbots.com.br",
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
