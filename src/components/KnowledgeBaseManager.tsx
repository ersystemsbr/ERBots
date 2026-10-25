'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import { SEGMENT_TEMPLATES, DEFAULT_TEMPLATES, KnowledgeTemplateItem } from '@/lib/segment-templates';
import { BookOpen, Plus, Trash2, Edit2, Sparkles, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  is_active: boolean;
}

interface KnowledgeBaseManagerProps {
  tenantId: string;
  tenantSegment?: string;
}

export default function KnowledgeBaseManager({ tenantId, tenantSegment }: KnowledgeBaseManagerProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Form state
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('faq');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Modal de Modelos por Segmento
  const segmentKeys = Object.keys(SEGMENT_TEMPLATES);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [selectedSegment, setSelectedSegment] = useState<string>(
    tenantSegment && SEGMENT_TEMPLATES[tenantSegment] ? tenantSegment : segmentKeys[0]
  );

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchItems = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/tenant/knowledge-base?tenant_id=${encodeURIComponent(tenantId)}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.items)) {
        setItems(json.items);
      }
    } catch (err) {
      console.error('Erro ao carregar base de conhecimento:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (tenantSegment && SEGMENT_TEMPLATES[tenantSegment]) {
      setSelectedSegment(tenantSegment);
    }
  }, [tenantSegment]);

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
      const res = await authFetch(
        `/api/tenant/knowledge-base?tenant_id=${encodeURIComponent(tenantId)}&id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Erro ao excluir item.');
      }
      setItems(items.filter((i) => i.id !== id));
      showNotice('success', 'Item removido da Base de Conhecimento.');
    } catch (err: any) {
      showNotice('error', err?.message || 'Erro ao excluir item.');
    }
  };

  const handleToggleActive = async (item: KnowledgeItem) => {
    try {
      const nextState = !item.is_active;
      const res = await authFetch('/api/tenant/knowledge-base', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          id: item.id,
          is_active: nextState,
        }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar status.');

      setItems(items.map((i) => (i.id === item.id ? { ...i, is_active: nextState } : i)));
    } catch (err) {
      console.error('Erro ao alternar status:', err);
      showNotice('error', 'Não foi possível alterar o status deste item.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);

    try {
      const res = await authFetch('/api/tenant/knowledge-base', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? {
                tenant_id: tenantId,
                id: editingId,
                category,
                title: title.trim(),
                content: content.trim(),
              }
            : {
                tenant_id: tenantId,
                category,
                title: title.trim(),
                content: content.trim(),
              }
        ),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Não foi possível salvar a informação.');

      setShowForm(false);
      await fetchItems();
      showNotice('success', editingId ? 'Informação atualizada com sucesso!' : 'Nova informação adicionada à IA!');
    } catch (err: any) {
      showNotice('error', `Erro ao salvar: ${err?.message || 'tente novamente'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleImportSegmentTemplates = async (templates: KnowledgeTemplateItem[]) => {
    setSaving(true);
    try {
      const existingTitles = new Set(items.map((i) => i.title.trim().toLowerCase()));
      const newOnes = templates.filter((t) => !existingTitles.has(t.title.trim().toLowerCase()));

      if (newOnes.length === 0) {
        showNotice('error', 'Todos os itens deste modelo já estão cadastrados na sua base.');
        setShowTemplatesModal(false);
        return;
      }

      const res = await authFetch('/api/tenant/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          items: newOnes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao importar modelos.');

      setShowTemplatesModal(false);
      await fetchItems();
      showNotice('success', `${newOnes.length} modelo(s) importado(s)! Personalize os textos com seus dados reais.`);
    } catch (err: any) {
      showNotice('error', `Erro ao importar modelos: ${err?.message || 'tente novamente'}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.category === activeFilter;
  });

  const previewTemplates = SEGMENT_TEMPLATES[selectedSegment] || DEFAULT_TEMPLATES;

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center gap-2.5 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowTemplatesModal(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Modelos por Segmento
            </button>

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
            Adicione respostas para as perguntas mais comuns dos seus clientes ou importe modelos prontos do seu ramo.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-700 transition"
            >
              <Sparkles className="w-3.5 h-3.5" /> Importar Modelos Prontos
            </button>
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold hover:bg-emerald-500/20 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Manualmente
            </button>
          </div>
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

      {/* Modal de Modelos por Segmento */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Modelos Prontos por Segmento
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Escolha seu ramo para importar cartões prontos e depois edite apenas seus preços e endereço.
                </p>
              </div>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Selecione o Segmento
              </label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {segmentKeys.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {previewTemplates.map((tpl, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{tpl.title}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {tpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{tpl.content}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleImportSegmentTemplates(previewTemplates)}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
              >
                {saving ? 'Importando...' : `Importar ${previewTemplates.length} Modelos`}
              </button>
            </div>
          </div>
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
                  maxLength={160}
                  placeholder="Ex: Como funciona a garantia? / Limpeza de Pele"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Resposta ou Descrição Detalhada</span>
                  <span className="text-[11px] font-normal text-slate-500">{content.length}/3000</span>
                </label>
                <textarea
                  rows={5}
                  maxLength={3000}
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
