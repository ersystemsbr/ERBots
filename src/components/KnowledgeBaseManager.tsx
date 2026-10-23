'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Plus, Trash2, Edit2, CheckCircle2, Sparkles, Filter } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  is_active: boolean;
}

interface KnowledgeBaseManagerProps {
  tenantId: string;
}

export default function KnowledgeBaseManager({ tenantId }: KnowledgeBaseManagerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Modal / Form state
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('faq');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const fetchItems = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (data) setItems(data);
    } catch (err) {
      console.error('Erro ao carregar base de conhecimento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [tenantId]);

  const handleOpenNew = () => {
    setEditingId(null);
    setCategory('faq');
    setTitle('');
    setContent('');
    setShowForm(true);
  };

  const handleOpenEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setCategory(item.category || 'faq');
    setTitle(item.title);
    setContent(item.content);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta informação da base de conhecimento?')) return;
    try {
      await supabase.from('knowledge_base').delete().eq('id', id);
      setItems(items.filter((i) => i.id !== id));
    } catch (err) {
      alert('Erro ao excluir item.');
    }
  };

  const handleToggleActive = async (item: KnowledgeItem) => {
    try {
      const nextState = !item.is_active;
      await supabase
        .from('knowledge_base')
        .update({ is_active: nextState })
        .eq('id', item.id);

      setItems(items.map((i) => (i.id === item.id ? { ...i, is_active: nextState } : i)));
    } catch (err) {
      console.error('Erro ao alternar status:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('knowledge_base')
          .update({
            category,
            title,
            content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('knowledge_base').insert({
          tenant_id: tenantId,
          category,
          title,
          content,
          is_active: true,
        });

        if (error) throw error;
      }

      setShowForm(false);
      fetchItems();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDefaults = async () => {
    if (!confirm('Deseja carregar perguntas frequentes padrão (Endereço, Pagamento, Horários)?')) return;
    setSaving(true);
    try {
      const defaultData = [
        {
          tenant_id: tenantId,
          category: 'faq',
          title: 'Formas de Pagamento Aceitas',
          content: 'Aceitamos Pix com desconto de 5%, Cartão de Crédito em até 3x sem juros, Cartão de Débito e Dinheiro.',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          category: 'faq',
          title: 'Endereço e Estacionamento',
          content: 'Nosso endereço é Avenida Principal, nº 1000 - Centro. Possuímos estacionamento gratuito conveniado no local.',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          category: 'service',
          title: 'Como agendar ou contratar',
          content: 'Para agendar um atendimento ou solicitar orçamento, basta enviar seu nome e a data desejada que nossa equipe confirmará.',
          is_active: true,
        },
      ];

      await supabase.from('knowledge_base').insert(defaultData);
      fetchItems();
    } catch (err) {
      alert('Erro ao carregar exemplos.');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.category === activeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-400" />
              Base de Conhecimento da Empresa
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Ensine a IA sobre seus produtos, preços, perguntas frequentes e políticas. Quanto mais detalhes aqui, mais inteligente o robô fica!
            </p>
          </div>

          <div className="flex items-center gap-2">
            {items.length === 0 && (
              <button
                onClick={handleLoadDefaults}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Carregar Exemplos
              </button>
            )}

            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              Adicionar Informação
            </button>
          </div>
        </div>

        {/* Filtros por categoria */}
        <div className="flex items-center gap-2 pt-6 overflow-x-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'faq', label: 'Dúvidas / FAQ' },
            { id: 'service', label: 'Serviços & Preços' },
            { id: 'product', label: 'Produtos' },
            { id: 'policy', label: 'Políticas & Regras' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeFilter === cat.id
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Itens */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          Carregando informações...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-md font-bold text-white">Nenhum item cadastrado nesta categoria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Adicione respostas para as perguntas mais comuns dos seus clientes para a IA responder na hora.
          </p>
          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold hover:bg-emerald-500/20 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Primeira Informação
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-lg transition flex flex-col justify-between ${
                item.is_active ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {item.category}
                  </span>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400">
                    <span>{item.is_active ? 'Ativo' : 'Pausado'}</span>
                    <input
                      type="checkbox"
                      checked={item.is_active}
                      onChange={() => handleToggleActive(item)}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                  </label>
                </div>

                <h4 className="text-base font-bold text-white mb-2">{item.title}</h4>
                <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                  {item.content}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-800">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Formulário de Edição */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingId ? 'Editar Informação' : 'Nova Informação para a IA'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="faq">Dúvidas Frequentes (FAQ)</option>
                  <option value="service">Serviços & Preços</option>
                  <option value="product">Produtos</option>
                  <option value="policy">Políticas & Regras</option>
                  <option value="general">Geral / Institucional</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pergunta ou Título
                </label>
                <input
                  type="text"
                  placeholder="Ex: Como funciona a garantia? / Limpeza de Pele"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Resposta ou Descrição Detalhada
                </label>
                <textarea
                  rows={5}
                  placeholder="Explique os detalhes, valores, condições e orientações para o cliente..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Informação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
