import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Bot, ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade e LGPD',
  description: 'Política de Privacidade e Proteção de Dados Pessoais (LGPD) da plataforma ERBots.',
};

export default function PrivacidadePage() {
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
            <ShieldCheck className="w-3.5 h-3.5" />
            Conformidade com a Lei nº 13.709/2018 (LGPD)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Política de Privacidade</h1>
          <p className="text-xs text-slate-400">Última atualização: Outubro de 2026</p>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">1. Papéis no Tratamento de Dados (Controlador e Operador)</h2>
            <p>
              Em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD):
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Dados cadastrais e financeiros do cliente SaaS (Contratante):</strong> a ER Systems (<strong>ERBots</strong>) atua como <strong>Controladora</strong> dos dados fornecidos pelo representante da empresa assinante (nome, e-mail, CPF/CNPJ, telefone e histórico de cobrança).
              </li>
              <li>
                <strong>Mensagens e contatos atendidos via WhatsApp da empresa assinante:</strong> a empresa assinante atua como <strong>Controladora</strong> perante seus consumidores finais, e o <strong>ERBots</strong> atua exclusivamente como <strong>Operador</strong>, processando mensagens sob instrução estrita da empresa assinante para viabilizar o atendimento automatizado e o painel Live Chat.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">2. Dados Coletados e Finalidades</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Cadastro e Autenticação:</strong> nome, razão/nome fantasia, e-mail, telefone comercial e credenciais criptografadas para criação do ambiente isolado (execução de contrato — Art. 7º, V da LGPD).
              </li>
              <li>
                <strong>Faturamento:</strong> CPF/CNPJ e dados necessários à emissão de cobranças via Pix, Boleto ou Cartão de Crédito (execução de contrato e obrigação legal/fiscal — Art. 7º, II e V).
              </li>
              <li>
                <strong>Atendimento Automatizado:</strong> nome de perfil público, número telefônico e conteúdo das mensagens (texto, áudio ou imagem enviados pelo contato) estritamente para gerar respostas contextuais e exibir o histórico no painel do Contratante.
              </li>
              <li>
                <strong>Registros Técnicos e Segurança:</strong> endereço IP e logs técnicos para prevenção a fraudes, controle de abuso e diagnóstico de falhas (legítimo interesse e segurança — Art. 7º, IX).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">3. Suboperadores e Compartilhamento Técnico</h2>
            <p>
              Não comercializamos dados pessoais em nenhuma hipótese. Para a execução técnica do serviço, utilizamos provedores de infraestrutura de padrão internacional:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Supabase Inc.:</strong> banco de dados gerenciado e autenticação segura com isolamento por empresa (Row Level Security).</li>
              <li><strong>Google Cloud / Google Gemini API:</strong> processamento de linguagem natural e compreensão de áudio/imagem das mensagens recebidas.</li>
              <li><strong>Asaas Gestão Financeira Instituição de Pagamento S.A.:</strong> processamento de assinaturas, Pix, boletos e cartões (dados de cartão não transitam nem são armazenados em nossos servidores).</li>
              <li><strong>Vercel Inc.:</strong> hospedagem em nuvem com criptografia TLS/HTTPS em trânsito.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">4. Segurança da Informação e Isolamento Multi-Tenant</h2>
            <p>
              Adotamos criptografia em trânsito (HTTPS/TLS), senhas protegidas por hash criptográfico, autenticação baseada em tokens JWT verificados no servidor, políticas de isolamento de linha no banco de dados (RLS) que impedem que uma empresa acesse dados de outra, e rotinas diárias de backup com acesso restrito.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">5. Retenção e Exclusão de Dados</h2>
            <p>
              Os dados permanecem armazenados enquanto a conta do Contratante estiver ativa ou pelo prazo necessário ao cumprimento de obrigações legais, fiscais e regulatórias (Marco Civil da Internet — Lei nº 12.965/2014). Mediante encerramento da conta e solicitação formal do titular ou Contratante, os dados operacionais e históricos de conversas são eliminados de forma segura, ressalvadas as hipóteses legais de guarda obrigatória.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">6. Direitos dos Titulares e Contato do Encarregado (DPO)</h2>
            <p>
              Nos termos do Art. 18 da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, portabilidade ou eliminação de seus dados pessoais entrando em contato com nosso canal de Privacidade e Proteção de Dados pelo e-mail:{' '}
              <a href="mailto:er.systems.br@gmail.com" className="text-emerald-400 hover:underline">
                er.systems.br@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
