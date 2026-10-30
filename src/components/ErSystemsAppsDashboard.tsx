'use client';

import React from 'react';
import {
  LayoutGrid,
  UtensilsCrossed,
  Bot,
  Layers,
  Truck,
  Car,
  Zap,
  Building,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Cpu,
  CheckCircle2,
} from 'lucide-react';

interface AppItem {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  description: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  tagColor: string;
  borderHover: string;
  tags: string[];
  isCurrent?: boolean;
}

export default function ErSystemsAppsDashboard() {
  const apps: AppItem[] = [
    {
      id: 'erbots',
      name: 'ERBots',
      category: 'Atendimento & IA',
      subtitle: 'Atendente Virtual Humanizada 24/7',
      description:
        'Automação inteligente para WhatsApp com IA avançada, LiveChat unificado para equipe humana, qualificação automática de clientes e base de conhecimento.',
      url: 'https://www.erbots.com.br',
      icon: Bot,
      gradient: 'from-emerald-500 to-teal-400',
      tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
      tags: ['IA WhatsApp 24/7', 'LiveChat Unificado', 'Qualificação de Leads', 'Base de Conhecimento'],
      isCurrent: true,
    },
    {
      id: 'gastrosys',
      name: 'GastroSys',
      category: 'Restaurantes & Delivery',
      subtitle: 'Gestão Gastronômica Inteligente',
      description:
        'Sistema completo para restaurantes, bares e pizzarias. Controle de PDV rápido, comandas eletrônicas, gestão de mesas, cardápio digital e integração direta com WhatsApp.',
      url: 'https://www.gastrosys.com.br',
      icon: UtensilsCrossed,
      gradient: 'from-orange-500 to-amber-500',
      tagColor: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
      borderHover: 'hover:border-orange-500/50 hover:shadow-orange-500/10',
      tags: ['PDV Balcão & Mesas', 'Comandas Eletrônicas', 'Cardápio Digital', 'Controle de Estoque'],
    },
    {
      id: 'crm61',
      name: 'CRM61',
      category: 'Vendas & Negócios',
      subtitle: 'Pipeline Comercial & Funil de Vendas',
      description:
        'CRM ágil desenvolvido para aceleração de vendas. Funis no padrão Kanban com movimentação de cards, cadastro unificado de contatos e conexão direta com o WhatsApp.',
      url: 'https://crm61.vercel.app',
      icon: Layers,
      gradient: 'from-blue-600 to-cyan-500',
      tagColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      borderHover: 'hover:border-blue-500/50 hover:shadow-blue-500/10',
      tags: ['Kanban de Vendas', 'Gestão de Oportunidades', 'Histórico de Conversas', 'Sincronização IA'],
    },
    {
      id: 'gocontrol',
      name: 'GoControl',
      category: 'Gestão de Frotas',
      subtitle: 'Telemetria & Controle Operacional',
      description:
        'Plataforma de gestão de frotas e veículos empresariais. Monitoramento operacional de viagens, controle de condutores, manutenções preventivas e financeiro.',
      url: 'https://go-control.vercel.app',
      icon: Truck,
      gradient: 'from-purple-600 to-indigo-500',
      tagColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      borderHover: 'hover:border-purple-500/50 hover:shadow-purple-500/10',
      tags: ['Monitoramento de Veículos', 'Controle de Motoristas', 'Relatórios Financeiros', 'Manutenção'],
    },
    {
      id: 'driversaas',
      name: 'DriverSaas',
      category: 'Transporte Privado & BaaS',
      subtitle: 'Mobilidade Urbana com Taxa Zero',
      description:
        'Plataforma para motoristas autônomos e frotas privadas. Taxa zero por corrida, escudo jurídico com emissão de contrato PJ e conta digital Pix instantânea.',
      url: 'https://driver-saas-nu.vercel.app',
      icon: Car,
      gradient: 'from-amber-500 to-yellow-400',
      tagColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      borderHover: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
      tags: ['Taxa Zero por Corrida', 'Escudo Jurídico PJ', 'Conta Digital Pix', 'Modo Passageiro'],
    },
    {
      id: 'ervoltz',
      name: 'ERVoltz',
      category: 'Mobilidade Elétrica',
      subtitle: 'Gestão de Eletropostos & Recarga EV',
      description:
        'Infraestrutura inteligente para monitoramento e gestão de estações de carregamento para veículos elétricos. Telemetria de consumo kWh e faturamento automatizado.',
      url: 'https://ervoltz.vercel.app',
      icon: Zap,
      gradient: 'from-emerald-400 to-lime-400',
      tagColor: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
      borderHover: 'hover:border-lime-500/50 hover:shadow-lime-500/10',
      tags: ['Eletropostos Conectados', 'Telemetria de Consumo', 'Cobrança por kWh', 'Frotas Elétricas'],
    },
    {
      id: 'checkinsampa',
      name: 'CheckInSampa',
      category: 'Hospitalidade & Estadias',
      subtitle: 'Recepção Digital & Gestão de Reservas',
      description:
        'Plataforma de hospitalidade para hotéis boutique, pousadas, flats e hospedagens. Controle dinâmico de check-in, mapa de quartos, reservas e atendimento.',
      url: 'https://cisampa.vercel.app',
      icon: Building,
      gradient: 'from-pink-500 to-rose-500',
      tagColor: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
      borderHover: 'hover:border-pink-500/50 hover:shadow-pink-500/10',
      tags: ['Check-in Online', 'Mapa de Ocupação', 'Calendário de Reservas', 'Boas-Vindas Auto'],
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Cabeçalho da Tela (Padrão Executivo da Tela de Resultados) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                Ecossistema de Aplicativos ER Systems
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Soluções especializadas em inteligência artificial, automação, controle operacional e vendas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            7 Plataformas Ativas
          </span>
        </div>
      </div>

      {/* Cards de Métricas / Destaques da Suíte */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
            <span>Tecnologia em Nuvem</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">100% Online</div>
          <span className="text-[11px] text-slate-400">Infraestrutura escalável com alta disponibilidade</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-sky-300 font-semibold">
            <span>Integrações Nativas</span>
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">IA & WhatsApp</div>
          <span className="text-[11px] text-slate-400">Sincronização entre ERBots, GastroSys e CRM</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
            <span>Segurança & Isolamento</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">Multi-Tenant</div>
          <span className="text-[11px] text-slate-400">Dados protegidos por criptografia e RLS</span>
        </div>
      </div>

      {/* Grade Principal dos Aplicativos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.id}
              className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between shadow-lg shadow-black/20 ${app.borderHover}`}
            >
              <div className="space-y-4">
                {/* Header do Card: Ícone + Categoria + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${app.gradient} flex items-center justify-center text-slate-950 font-bold shadow-lg shrink-0`}
                  >
                    <Icon className="w-6 h-6 text-slate-950" />
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${app.tagColor}`}
                    >
                      {app.category}
                    </span>
                    {app.isCurrent && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        App em Uso
                      </span>
                    )}
                  </div>
                </div>

                {/* Título e Subtítulo */}
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{app.name}</h3>
                  <p className="text-xs font-medium text-emerald-400/90 mt-0.5">{app.subtitle}</p>
                </div>

                {/* Descrição Detalhada */}
                <p className="text-xs text-slate-400 leading-relaxed min-h-[52px]">
                  {app.description}
                </p>

                {/* Tags de Recursos do App */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {app.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Botão de Ação do Card */}
              <div className="pt-5 mt-5 border-t border-slate-800/80">
                <a
                  href={app.url}
                  target={app.isCurrent ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                    app.isCurrent
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                      : 'bg-slate-800 hover:bg-emerald-500 text-slate-200 hover:text-slate-950 border border-slate-700/60 hover:border-transparent'
                  }`}
                >
                  <span>{app.isCurrent ? 'Permanecer neste App' : `Acessar ${app.name}`}</span>
                  {!app.isCurrent && <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
