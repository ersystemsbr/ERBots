'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, BarChart3, Settings, Bot, LogOut } from 'lucide-react';

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
    { id: 'chat', label: 'Live Chat', icon: MessageSquare },
    { id: 'analytics', label: 'Resultados', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Linha única contínua para desktop e mobile */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Logo e Status do Robô */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Bot className="w-4 h-4 sm:w-6 sm:h-6 text-slate-950 font-bold" />
              </div>
              <span className="text-base sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                ER<span className="text-emerald-400">Bots</span>
              </span>
            </Link>

            {tenantName && (
              <span className="hidden xl:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[140px]">
                {tenantName}
              </span>
            )}

            {/* Status do Robô */}
            <div className="flex items-center space-x-1.5 ml-1">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
                title={isConnected ? 'WhatsApp Ativo' : 'WhatsApp Desconectado'}
              />
              <span className="text-xs text-slate-400 hidden lg:inline">
                {isConnected ? 'WhatsApp Ativo' : 'WhatsApp Desconectado'}
              </span>
            </div>
          </div>

          {/* Menus de Navegação (Live Chat, Resultados, Configurações) */}
          <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Ações da Direita: Painel Master (se superadmin) e Logout */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition"
                title="Acessar Painel Central do SaaS"
              >
                <span>👑</span>
                <span className="hidden md:inline">Painel Master</span>
              </Link>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition"
                title="Sair do painel"
                aria-label="Sair do painel"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
