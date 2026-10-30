'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';

interface AppItem {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  borderHover: string;
  isCurrent?: boolean;
}

export default function ErSystemsAppsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const apps: AppItem[] = [
    {
      id: 'erbots',
      name: 'ERBots',
      category: 'Atendimento & IA',
      description: 'Automação de WhatsApp 24/7 com IA humanizada, LiveChat e qualificação de leads.',
      url: 'https://www.erbots.com.br',
      icon: Bot,
      gradient: 'from-emerald-500 to-teal-400',
      borderHover: 'hover:border-emerald-500/50 hover:bg-emerald-500/5',
      isCurrent: true,
    },
    {
      id: 'gastrosys',
      name: 'GastroSys',
      category: 'Restaurantes & Delivery',
      description: 'PDV completo, comandas, mesas, cardápio digital e integração com delivery.',
      url: 'https://www.gastrosys.com.br',
      icon: UtensilsCrossed,
      gradient: 'from-orange-500 to-amber-500',
      borderHover: 'hover:border-orange-500/50 hover:bg-orange-500/5',
    },
    {
      id: 'crm61',
      name: 'CRM61',
      category: 'Vendas & Negócios',
      description: 'Gestão de funil de vendas, Kanban comercial, contatos e integração nativa com IA.',
      url: 'https://crm61.vercel.app',
      icon: Layers,
      gradient: 'from-blue-600 to-cyan-500',
      borderHover: 'hover:border-blue-500/50 hover:bg-blue-500/5',
    },
    {
      id: 'gocontrol',
      name: 'GoControl',
      category: 'Gestão de Frotas',
      description: 'Monitoramento operacional, telemetria de veículos, motoristas e controle financeiro.',
      url: 'https://go-control.vercel.app',
      icon: Truck,
      gradient: 'from-purple-600 to-indigo-500',
      borderHover: 'hover:border-purple-500/50 hover:bg-purple-500/5',
    },
    {
      id: 'driversaas',
      name: 'DriverSaas',
      category: 'Transporte Privado & BaaS',
      description: 'Plataforma para motoristas com taxa zero por corrida, escudo jurídico PJ e conta Pix.',
      url: 'https://driver-saas-nu.vercel.app',
      icon: Car,
      gradient: 'from-amber-500 to-yellow-400',
      borderHover: 'hover:border-amber-500/50 hover:bg-amber-500/5',
    },
    {
      id: 'ervoltz',
      name: 'ERVoltz',
      category: 'Mobilidade Elétrica',
      description: 'Gestão inteligente de eletropostos e estações de carregamento para frotas e veículos.',
      url: 'https://ervoltz.vercel.app',
      icon: Zap,
      gradient: 'from-emerald-400 to-lime-400',
      borderHover: 'hover:border-lime-500/50 hover:bg-lime-500/5',
    },
    {
      id: 'checkinsampa',
      name: 'CheckInSampa',
      category: 'Hospitalidade & Estadias',
      description: 'Recepção digital, gestão de reservas, hospitalidade e controle de estadias.',
      url: 'https://cisampa.vercel.app',
      icon: Building,
      gradient: 'from-pink-500 to-rose-500',
      borderHover: 'hover:border-pink-500/50 hover:bg-pink-500/5',
    },
  ];

  // Fecha o menu ao clicar fora ou apertar ESC
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Botão no Topo */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all border ${
          isOpen
            ? 'bg-slate-800 text-white border-slate-700 shadow-md shadow-emerald-500/5'
            : 'text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border-slate-800'
        }`}
        title="Ecossistema de Aplicativos ER Systems"
        aria-expanded={isOpen}
      >
        <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shrink-0">
          <LayoutGrid className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold tracking-tight">Apps ER Systems</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Popover com Grade de Cards */}
      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 mt-2 w-[92vw] sm:w-[580px] lg:w-[680px] max-w-[680px] bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Cabeçalho do Popover */}
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  Ecossistema ER Systems
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    7 Soluções
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Acesse com 1 clique todas as plataformas e aplicativos da nossa suíte.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grade de Cards */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto [scrollbar-width:thin]">
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <a
                  key={app.id}
                  href={app.url}
                  target={app.isCurrent ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  onClick={() => !app.isCurrent && setIsOpen(false)}
                  className={`group relative p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40 transition-all duration-200 flex flex-col justify-between gap-2.5 ${app.borderHover}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${app.gradient} flex items-center justify-center text-slate-950 font-bold shadow-md shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-4 h-4 text-slate-950 font-bold" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {app.name}
                          </span>
                          {app.isCurrent && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              App Atual
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 block">
                          {app.category}
                        </span>
                      </div>
                    </div>

                    {!app.isCurrent && (
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0 mt-1" />
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-snug line-clamp-2">
                    {app.description}
                  </p>
                </a>
              );
            })}
          </div>

          {/* Rodapé com Link para Central / Hub */}
          <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px]">ER Systems • Plataformas Integradas</span>
            <a
              href="https://ersyshub.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] hover:underline"
            >
              <span>Painel Geral (ER Systems Hub)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
