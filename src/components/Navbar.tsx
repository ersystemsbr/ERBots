'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, MessageSquare, Settings, BookOpen, ShieldCheck, LogOut, Building2, BarChart3 } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  tenantName?: string;
  isConnected?: boolean;
  onLogout?: () => void;
  isSuperAdmin?: boolean;
}

export default function Navbar({
  currentTab,
  onTabChange,
  tenantName,
  isConnected,
  onLogout,
  isSuperAdmin,
}: NavbarProps) {
  const navItems = [
    { id: 'whatsapp', label: 'Conexão WhatsApp', icon: Bot },
    { id: 'chat', label: 'Live Chat', icon: MessageSquare },
    { id: 'analytics', label: 'Resultados', icon: BarChart3 },
    { id: 'bot-settings', label: 'Personalizar IA', icon: Settings },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: BookOpen },
    { id: 'plans', label: 'Planos & Assinatura', icon: ShieldCheck },
    { id: 'profile', label: 'Dados da Empresa', icon: Building2 },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Linha Superior (Desktop: completa | Mobile: Logo + Status à esquerda, Sair à direita) */}
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo e Status */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Bot className="w-5 h-5 md:w-6 md:h-6 text-slate-950 font-bold" />
              </div>
              <span className="text-lg md:text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                ER<span className="text-emerald-400">Bots</span>
              </span>
            </Link>

            {tenantName && (
              <span className="hidden lg:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[160px]">
                {tenantName}
              </span>
            )}

            {/* Status do Robô */}
            <div className="flex items-center space-x-1.5 ml-1 sm:ml-3">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
                title={isConnected ? 'WhatsApp Ativo' : 'WhatsApp Desconectado'}
              />
              <span className="text-xs text-slate-400 hidden sm:inline">
                {isConnected ? 'WhatsApp Ativo' : 'WhatsApp Desconectado'}
              </span>
            </div>
          </div>

          {/* Navegação no Desktop (md:) */}
          <div className="hidden md:flex items-center space-x-2">
            <nav className="flex space-x-1 lg:space-x-2 py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {isSuperAdmin && (
              <Link
                href="/admin"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition ml-1"
                title="Acessar Painel Central do SaaS"
              >
                <span>👑</span>
                <span className="hidden xl:inline">Painel Master</span>
              </Link>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition ml-2"
                title="Sair do painel"
                aria-label="Sair do painel"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Direita no Celular (< md): Apenas ícone de sair alinhado à direita (+ Master se admin) */}
          <div className="flex md:hidden items-center space-x-1">
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="p-2 rounded-lg text-amber-400 bg-amber-500/10 border border-amber-500/30 text-xs font-semibold"
                title="Painel Master"
                aria-label="Painel Master"
              >
                <span>👑</span>
              </Link>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition"
                title="Sair do painel"
                aria-label="Sair do painel"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Segunda Linha no Celular (< md): Ícones de navegação organizados e distribuídos */}
      <div className="md:hidden border-t border-slate-800/80 bg-slate-900/95 backdrop-blur px-2 py-1.5">
        <nav className="flex items-center justify-around gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={item.label}
                aria-label={item.label}
                className={`relative flex items-center justify-center p-2.5 rounded-xl transition-all shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
