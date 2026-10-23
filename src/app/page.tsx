import React from 'react';
import Link from 'next/link';
import { Bot, MessageSquare, Zap, Clock, ShieldCheck, CheckCircle2, ArrowRight, Sparkles, Building2, Stethoscope, Scissors, ShoppingBag } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Bot className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              ER<span className="text-emerald-400">Bots</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-sm font-semibold text-slate-200 hover:text-white transition shadow-sm"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition"
            >
              Testar Grátis por 7 Dias
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            Atendente Virtual Inteligente com Google Gemini
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.15]">
            Transforme seu WhatsApp em uma{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
              Máquina de Atendimento 24/7
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto font-normal leading-relaxed">
            Nunca mais perca clientes por demora na resposta. Conecte seu WhatsApp em 30 segundos e tenha uma atendente virtual com inteligência artificial treinada com as regras e preços da sua empresa.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/cadastro"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 transition"
            >
              <Zap className="w-5 h-5 fill-current" />
              Criar Atendente Virtual Grátis
            </Link>
            <a
              href="#recursos"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base border border-slate-800 transition"
            >
              Conhecer Funcionalidades
            </a>
          </div>

          {/* Social Proof Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sem taxa de adesão
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Conexão com seu número atual
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Transbordo humano com 1 clique
            </span>
          </div>
        </div>
      </section>

      {/* Seção de Recursos Principais */}
      <section id="recursos" className="py-20 bg-slate-900/60 border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-extrabold text-white">
              Tudo o que você precisa para automatizar seu WhatsApp
            </h2>
            <p className="text-sm text-slate-400">
              Criado para donos de negócios que querem atendimento ágil e profissional sem complicação técnica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 hover:border-emerald-500/40 transition">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Conexão via QR Code</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Basta apontar a câmera do seu WhatsApp como se estivesse conectando no WhatsApp Web. Seu número continua com você e o robô assume as respostas.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 hover:border-emerald-500/40 transition">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-6">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">IA com Google Gemini</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Respostas humanizadas, sem robótica travada. Ela entende gírias, erros de digitação e mensagens de áudio, respondendo no tom de voz da sua empresa.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 hover:border-emerald-500/40 transition">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Live Chat & Transbordo</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Acompanhe o que os clientes estão falando em tempo real. Se preferir conversar diretamente, assuma o atendimento com um único clique.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Segmentos que atendemos */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Perfeito para qualquer tipo de negócio
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Não importa o seu ramo, o ERBots se adapta perfeitamente ao seu catálogo e rotina.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Stethoscope className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Clínicas e Consultórios</h4>
              <p className="text-[11px] text-slate-400">Agendamentos, convênios e valores de procedimentos.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Building2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Imobiliárias & Corretores</h4>
              <p className="text-[11px] text-slate-400">Filtragem de imóveis, envio de links e marcação de visitas.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Scissors className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Barbearias & Estética</h4>
              <p className="text-[11px] text-slate-400">Tabela de serviços, pacotes e horários livres.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <ShoppingBag className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Comércio & Serviços</h4>
              <p className="text-[11px] text-slate-400">Disponibilidade de produtos, orçamentos e dúvidas frequentes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-b from-slate-950 to-slate-900 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Comece a atender no piloto automático hoje mesmo
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Crie sua conta, leia o QR Code e teste todas as funcionalidades gratuitamente por 7 dias.
          </p>
          <div>
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base rounded-xl shadow-xl shadow-emerald-500/25 transition"
            >
              Criar Atendente Virtual Agora
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 bg-slate-950 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">ERBots</span>
            <span>&copy; 2026 - Todos os direitos reservados.</span>
          </div>
          <p>Tecnologia autônoma de IA para WhatsApp Multi-Tenant.</p>
        </div>
      </footer>
    </div>
  );
}
