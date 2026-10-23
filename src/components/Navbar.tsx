'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, MessageSquare, Settings, BookOpen, ShieldCheck, LogOut, Building2 } from 'lucide-react';

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
    { id: 'bot-settings', label: 'Personalizar IA', icon: Settings },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: BookOpen },
    { id: 'plans', label: 'Planos & Assinatura', icon: ShieldCheck },
    { id: 'profile', label: 'Dados da Empresa', icon: Building2 },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Bot className="w-6 h-6 text-slate-950 font-bold" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                ER<span className="text-emerald-400">Bots</span>
              </span>
            </Link>

            {tenantName && (
              <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {tenantName}
              </span>
            )}

            {/* Status do Robô */}
            <div className="flex items-center space-x-2 ml-4">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-xs text-slate-400 hidden sm:inline">
                {isConnected ? 'WhatsApp Ativo' : 'WhatsApp Desconectado'}
              </span>
            </div>
          </div>

          {/* Navegação */}
          <div className="flex items-center space-x-2">
            <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{item.label}</span>
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
                <span className="hidden lg:inline">Painel Master</span>
              </Link>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition ml-2"
                title="Sair do painel"
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
