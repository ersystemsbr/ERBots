import React from 'react';
import Link from 'next/link';
import PricingSection from '@/components/PricingSection';
import {
  Bot,
  MessageSquare,
  Zap,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Building2,
  Stethoscope,
  Scissors,
  ShoppingBag,
  Mic,
  BarChart3,
  BellRing,
  HelpCircle,
} from 'lucide-react';

const FAQS = [
  {
    q: 'Preciso trocar de número ou comprar um chip novo?',
    a: 'Não! Você conecta o seu próprio número atual (WhatsApp comum ou WhatsApp Business) lendo um QR Code em 30 segundos, exatamente como no WhatsApp Web.',
  },
  {
    q: 'A IA entende áudios e fotos enviados pelos clientes?',
    a: 'Sim! O ERBots escuta áudios automaticamente, interpreta imagens/comprovantes enviados pelo cliente e responde de forma natural usando Google Gemini.',
  },
  {
    q: 'E se eu quiser responder um cliente pessoalmente pelo celular?',
    a: 'Fique tranquilo: sempre que você responder manualmente pelo celular ou assumir a conversa no Live Chat, o robô pausa sozinho naquela conversa para não atropelar seu atendimento.',
  },
  {
    q: 'O que acontece se o WhatsApp desconectar ou o cliente pedir um humano?',
    a: 'Você recebe alerta automático no seu WhatsApp de gestor caso a IA identifique pedido de atendente humano ou se o aparelho desconectar.',
  },
  {
    q: 'Tem fidelidade ou multa de cancelamento?',
    a: 'Nenhuma! Você testa grátis por 7 dias sem cartão de crédito e, ao assinar via Pix, Boleto ou Cartão, pode cancelar quando quiser direto pelo painel.',
  },
];

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

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#como-funciona" className="hover:text-white transition">
              Como Funciona
            </a>
            <a href="#recursos" className="hover:text-white transition">
              Recursos
            </a>
            <a href="#planos" className="hover:text-white transition">
              Planos
            </a>
            <a href="#faq" className="hover:text-white transition">
              Dúvidas
            </a>
          </nav>

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
            IA que entende Texto, Áudio e Fotos no seu WhatsApp
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.15]">
            Transforme seu WhatsApp em uma{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
              Máquina de Atendimento 24/7
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto font-normal leading-relaxed">
            Nunca mais perca vendas por demora na resposta, noite ou fim de semana. Conecte seu WhatsApp em 30 segundos e tenha uma atendente virtual treinada com os preços, horários e regras da sua empresa.
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
              href="#como-funciona"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base border border-slate-800 transition"
            >
              Ver Como Funciona
            </a>
          </div>

          {/* Social Proof Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 7 dias grátis sem cartão
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Escuta áudios de clientes
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pausa automática quando você responde
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sem fidelidade
            </span>
          </div>
        </div>
      </section>

      {/* Como Funciona em 3 Passos */}
      <section id="como-funciona" className="py-16 border-t border-slate-900 bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Simples e sem código
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Seu atendimento automático no ar em 3 passos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Escolha seu segmento',
                desc: 'Ao criar sua conta, já carregamos modelos prontos de respostas para clínicas, imobiliárias, barbearias, lojas ou escritórios.',
              },
              {
                step: '02',
                title: 'Teste no Simulador integrado',
                desc: 'Converse com sua IA dentro do próprio painel para ajustar preços, tom de voz e regras antes mesmo de ligar no WhatsApp.',
              },
              {
                step: '03',
                title: 'Leia o QR Code e pronto!',
                desc: 'Aponte a câmera do WhatsApp da empresa e acompanhe conversas, leads e horas economizadas em tempo real.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-3 relative overflow-hidden"
              >
                <span className="text-3xl font-black text-emerald-500/30 font-mono">{item.step}</span>
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção de Recursos Principais */}
      <section id="recursos" className="py-20 bg-slate-900/60 border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-extrabold text-white">
              Tudo o que você precisa para vender e atender melhor
            </h2>
            <p className="text-sm text-slate-400">
              Criado para donos de negócios que querem atendimento ágil, humano e sob controle total.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Compreensão de Áudio e Fotos</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Cliente mandou áudio longo no trânsito ou foto de um produto/orçamento? A IA ouve, interpreta e responde com precisão em segundos.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-5">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">IA Humanizada + Anti-Picote</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Agrupa mensagens quebradas do cliente antes de responder, entende gírias e segue rigorosamente os preços e políticas da sua Base de Conhecimento.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Live Chat &amp; Pausa Inteligente</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Acompanhe tudo ao vivo. Se você responder pelo seu próprio celular ou clicar em assumir, a IA pausa na hora naquela conversa.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
                <BellRing className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Alertas de Transbordo e Conexão</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Receba aviso imediato no WhatsApp do gestor quando um cliente pedir atendimento humano ou se o aparelho principal ficar sem internet.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Painel de Resultados &amp; Leads</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Veja quantos atendimentos foram resolvidos fora do expediente, horários de pico, horas economizadas e exporte seus contatos em CSV.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/40 transition">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Segurança &amp; Isolamento LGPD</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Ambiente exclusivo por empresa com isolamento de dados em banco (RLS), criptografia HTTPS e backups diários automatizados.
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
              Modelos prontos para o seu ramo de atuação
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Comece com uma Base de Conhecimento pré-configurada para o seu segmento e personalize em minutos.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Stethoscope className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Clínicas e Consultórios</h4>
              <p className="text-[11px] text-slate-400">Agendamentos, convênios, reembolso e preparo de exames.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Building2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Imobiliárias &amp; Corretores</h4>
              <p className="text-[11px] text-slate-400">Qualificação de compra/locação, bairros e agendamento de visitas.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Scissors className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Barbearias &amp; Estética</h4>
              <p className="text-[11px] text-slate-400">Tabela de serviços, combos, pacotes e horários livres.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <ShoppingBag className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Comércio, Pet &amp; Escritórios</h4>
              <p className="text-[11px] text-slate-400">Estoque, entregas, banho e tosa, reuniões e orçamentos rápidos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Planos e Preços (valores editáveis no painel admin) */}
      <PricingSection />

      {/* Perguntas Frequentes (FAQ) */}
      <section id="faq" className="py-20 border-t border-slate-900 bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-4 h-4" />
              Tire suas dúvidas
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Perguntas Frequentes</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((item, idx) => (
              <details
                key={idx}
                className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 open:border-emerald-500/30 transition"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white">
                  <span>{item.q}</span>
                  <span className="text-emerald-400 text-lg font-bold group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{item.a}</p>
              </details>
            ))}
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
            Crie sua conta em 1 minuto, teste sua IA no simulador e aproveite 7 dias grátis sem compromisso.
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
      <footer className="border-t border-slate-900 py-10 bg-slate-950 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">ERBots</span>
            <span>&copy; 2026 ER Systems — Todos os direitos reservados.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-slate-400">
            <a href="#planos" className="hover:text-white transition">
              Planos
            </a>
            <Link href="/login" className="hover:text-white transition">
              Área do Cliente
            </Link>
            <Link href="/cadastro" className="hover:text-white transition">
              Teste Grátis
            </Link>
            <Link href="/termos" className="hover:text-white transition">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-white transition">
              Privacidade (LGPD)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
