import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Bot, ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos e condições gerais de uso da plataforma SaaS ERBots.',
};

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center">
              <Bot className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <span className="text-lg font-black text-white">
              ER<span className="text-emerald-400">Bots</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="space-y-2 border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" />
            Contrato de Licença de Software como Serviço (SaaS)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Termos e Condições de Uso</h1>
          <p className="text-xs text-slate-400">Última atualização: Outubro de 2026</p>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">1. Objeto</h2>
            <p>
              Estes Termos regulam o acesso e uso da plataforma <strong>ERBots</strong> (disponibilizada por ER Systems), software em nuvem (SaaS) que permite a empresas contratantes configurar e operar atendentes virtuais com Inteligência Artificial integrados ao seu próprio número de WhatsApp, incluindo painel de atendimento em tempo real (Live Chat), base de conhecimento e relatórios operacionais.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">2. Período de Teste Gratuito (Trial) e Assinatura</h2>
            <p>
              Novas contas contam com um período promocional de teste gratuito de <strong>7 (sete) dias corridos</strong>, sujeito à franquia de mensagens demonstrativas vigente. Após o término do período de teste, a continuidade do atendimento automatizado depende da contratação de um dos planos mensais disponíveis no painel (via Pix, Boleto ou Cartão de Crédito, processados pela instituição de pagamento Asaas).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">3. Franquia de Mensagens, Cancelamento e Arrependimento</h2>
            <p>
              Cada plano contempla uma franquia mensal de respostas geradas por Inteligência Artificial e quantidade de conexões WhatsApp conforme tabela vigente no momento da contratação. A assinatura tem renovação mensal automática e <strong>sem fidelidade</strong>: o Contratante pode solicitar o cancelamento a qualquer momento pelo painel, permanecendo com acesso até o fim do ciclo já pago. Em conformidade com o Art. 49 do Código de Defesa do Consumidor (Lei nº 8.078/1990), é assegurado o direito de arrependimento em até 7 (sete) dias após a primeira contratação paga.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">4. Regras de Uso do WhatsApp e Prevenção a Bloqueios</h2>
            <p>
              A conexão do número telefônico ocorre mediante pareamento por QR Code (dispositivo conectado) sob controle exclusivo do Contratante. O ERBots foi projetado exclusivamente para <strong>atendimento receptivo</strong> (responder clientes que entram em contato voluntariamente com a empresa) e suporte operacional.
            </p>
            <p>
              É expressamente proibido utilizar a plataforma para: (i) envio de spam, disparos em massa não solicitados ou listas frias sem opt-in; (ii) prática de fraudes, ilícitos civis ou penais, conteúdo ofensivo ou violação de direitos de terceiros. O Contratante declara ciência de que o WhatsApp (Meta Platforms) possui políticas próprias antispam e que números utilizados em desacordo com tais políticas podem sofrer restrições ou banimento pela própria operadora do aplicativo, não cabendo à ERBots responsabilidade por bloqueios decorrentes do uso do número pelo Contratante.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">5. Limitações da Inteligência Artificial e Supervisão</h2>
            <p>
              As respostas automáticas são geradas com base exclusivamente nas instruções e na Base de Conhecimento cadastradas pelo próprio Contratante. É responsabilidade do Contratante revisar periodicamente os preços, políticas e horários informados à IA, bem como acompanhar solicitações de transbordo humano no Live Chat. A plataforma não substitui aconselhamento médico, jurídico, contábil ou emergencial.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">6. Disponibilidade e Suporte</h2>
            <p>
              O ERBots emprega monitoramento contínuo, backups diários automatizados e alertas de desconexão de aparelho para manter alta disponibilidade, ressalvadas janelas de manutenção preventiva ou indisponibilidades de serviços terceiros (operadoras de telefonia, servidores da Meta/WhatsApp, provedores de nuvem ou IA).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">7. Contato e Foro</h2>
            <p>
              Dúvidas comerciais, técnicas ou solicitações contratuais podem ser encaminhadas para{' '}
              <a href="mailto:er.systems.br@gmail.com" className="text-emerald-400 hover:underline">
                er.systems.br@gmail.com
              </a>
              . Fica eleito o foro do domicílio da sede da ER Systems para dirimir eventuais controvérsias oriundas destes Termos, ressalvadas as disposições legais aplicáveis.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
