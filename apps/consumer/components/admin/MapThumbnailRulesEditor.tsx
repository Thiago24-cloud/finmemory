'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_PASTE_IMAGE_BYTES = 2.5 * 1024 * 1024;

function approxDataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i === -1) return 0;
  return Math.floor((dataUrl.length - i - 1) * 0.75);
}

function isPreviewableImageRef(s: string): boolean {
  const t = s.trim();
  return /^https:\/\//i.test(t) || /^data:image\//i.test(t);
}

type RetailContext = 'supermarket' | 'fast_food' | 'any';

interface RuleRow {
  id: string;
  canonical_label: string;
  keywords: string[];
  retail_context: RetailContext;
  sort_order: number;
  active: boolean;
  notes: string | null;
  image_url: string | null;
}

const RC_LABEL: Record<RetailContext, string> = {
  supermarket: 'Supermercado',
  fast_food: 'Fast food / cardápio',
  any: 'Qualquer loja',
};

export default function MapThumbnailRulesEditor() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateInfo, setMigrateInfo] = useState<string | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const [formLabel, setFormLabel] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formRc, setFormRc] = useState<RetailContext>('supermarket');
  const [formOrder, setFormOrder] = useState('100');
  const [formNotes, setFormNotes] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Regra em edição (mesmo formulário que «Nova regra»); `null` = modo criar. */
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/map-thumbnail-rules', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setRules(Array.isArray(j.rules) ? j.rules : []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadDataUrlToStorageIfNeeded(dataUrl: string): Promise<string> {
    const t = dataUrl.trim();
    if (!/^data:image\//i.test(t)) return t;
    setUploadingThumb(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/map-thumbnail-rule-image-upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: t }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      const url = typeof j.url === 'string' ? j.url.trim() : '';
      if (!url) throw new Error('Resposta sem URL');
      return url;
    } finally {
      setUploadingThumb(false);
    }
  }

  function applyImageFromFile(file: File) {
    setErr('');
    if (!file.type.startsWith('image/')) {
      setErr('Escolhe um ficheiro de imagem (PNG, JPEG, WebP…).');
      return;
    }
    if (file.size > MAX_PASTE_IMAGE_BYTES) {
      setErr(
        `Imagem demasiado grande (${Math.round(file.size / 1024)} KB). Máximo ~${Math.round(MAX_PASTE_IMAGE_BYTES / 1024)} KB — reduz ou usa um link HTTPS.`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        const r = reader.result;
        if (typeof r !== 'string') return;
        try {
          if (approxDataUrlBytes(r) > MAX_PASTE_IMAGE_BYTES) {
            setErr(
              `Imagem em base64 demasiado grande (est. > ${Math.round(MAX_PASTE_IMAGE_BYTES / 1024)} KB). Usa uma imagem mais pequena ou um link HTTPS.`
            );
            return;
          }
          const url = await uploadDataUrlToStorageIfNeeded(r);
          setFormImageUrl(url);
        } catch (e: unknown) {
          setErr(e instanceof Error ? e.message : 'Falha ao enviar imagem para o Storage');
        }
      })();
    };
    reader.onerror = () => setErr('Não foi possível ler o ficheiro.');
    reader.readAsDataURL(file);
  }

  function onThumbnailPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        e.preventDefault();
        const f = it.getAsFile();
        if (f) applyImageFromFile(f);
        return;
      }
    }
  }

  function resetForm() {
    setEditingRuleId(null);
    setFormLabel('');
    setFormKeywords('');
    setFormRc('supermarket');
    setFormOrder('100');
    setFormNotes('');
    setFormImageUrl('');
  }

  function beginEdit(row: RuleRow) {
    setErr('');
    setEditingRuleId(row.id);
    setFormLabel(row.canonical_label);
    setFormKeywords((row.keywords || []).join('\n'));
    setFormRc(row.retail_context);
    setFormOrder(String(row.sort_order ?? 100));
    setFormNotes(row.notes ?? '');
    setFormImageUrl(row.image_url?.trim() || '');
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    const trimmedImg = formImageUrl.trim();
    if (trimmedImg.startsWith('data:image/')) {
      setErr('Ainda a processar imagem — espera o upload para o Storage ou cola um link https://…');
      setSaving(false);
      return;
    }
    try {
      const payload = {
        canonical_label: formLabel.trim(),
        keywords: formKeywords,
        retail_context: formRc,
        sort_order: Number.parseInt(formOrder, 10) || 100,
        notes: formNotes.trim() || null,
        image_url: formImageUrl.trim() || null,
      };
      const r = await fetch('/api/admin/map-thumbnail-rules', {
        method: editingRuleId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingRuleId ? { id: editingRuleId, ...payload } : payload
        ),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      resetForm();
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao gravar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: RuleRow) {
    setSaving(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/map-thumbnail-rules', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, active: !row.active }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  const dataUrlRuleCount = rules.filter((r) =>
    typeof r.image_url === 'string' ? /^data:image\//i.test(r.image_url.trim()) : false
  ).length;

  async function migrateBase64ThumbnailRules() {
    if (
      !confirm(
        'Enviar todas as miniaturas ainda em data:image/… para o bucket map-thumbnail-rules e substituir por URL HTTPS na base?'
      )
    ) {
      return;
    }
    setMigrating(true);
    setErr('');
    setMigrateInfo(null);
    try {
      const r = await fetch('/api/admin/migrate-thumbnail-rules-images', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      const parts = [`Migradas ${j.migratedCount} miniatura(s).`];
      if (j.failedCount) {
        parts.push(`${j.failedCount} falharam (base64 inválido ou truncado — edita a regra manualmente).`);
      }
      setMigrateInfo(parts.join(' '));
      if (Array.isArray(j.failed) && j.failed.length) {
        console.warn('migrate-thumbnail-rules-images', j.failed);
      }
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro na migração');
    } finally {
      setMigrating(false);
    }
  }

  async function removeRule(id: string) {
    if (!confirm('Apagar esta regra?')) return;
    if (editingRuleId === id) resetForm();
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`/api/admin/map-thumbnail-rules?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-gray-100">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-xs font-medium text-emerald-400/90 underline-offset-2 hover:underline"
            >
              ← Painel operacional
            </Link>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Categorias de miniatura (mapa)</h1>
            <p className="mt-1 text-sm text-gray-400">
              Palavras-chave no <strong className="text-gray-300">nome do produto</strong> → pode usar{' '}
              <strong className="text-gray-300">URL HTTPS da miniatura</strong> (prioridade máxima) ou o rótulo do{' '}
              <Link href="/admin/quick-add" className="text-emerald-400 underline-offset-2 hover:underline">
                repositório
              </Link>{' '}
              (<code className="text-gray-500">map_product_image_cache</code>). Depois: Open Food Facts / Google CSE.
              Regras na base (<code className="text-gray-500">map_thumbnail_match_rules</code>); fallback estático com{' '}
              <code className="text-gray-500">MAP_THUMBNAIL_STATIC_RULES=0</code> para desligar.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => migrateBase64ThumbnailRules()}
              disabled={loading || saving || migrating || uploadingThumb || dataUrlRuleCount === 0}
              title={
                dataUrlRuleCount === 0
                  ? 'Nenhuma regra com data:image/… na lista atual'
                  : 'Uma vez por lote até esvaziar; repete se necessário'
              }
              className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
            >
              {migrating ? 'A migrar…' : `Migrar base64 → Storage (${dataUrlRuleCount})`}
            </button>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading || saving || migrating || uploadingThumb}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-50"
            >
              Atualizar lista
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        {err ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}
        {migrateInfo ? (
          <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
            {migrateInfo}
          </div>
        ) : null}

        <section
          className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm"
          aria-label="Novidades do painel"
        >
          <p className="font-semibold text-amber-200/95">Treino visual — onde está a alteração</p>
          <p className="mt-1.5 text-gray-400">
            O <strong className="text-gray-200">mapa só usa miniaturas HTTPS</strong> (nunca data: no pin — evita travar o browser). Colar imagem/ficheiro envia <strong className="text-gray-200">já</strong> para o Storage e o campo fica com o link. Ou{' '}
            <strong className="text-gray-200">nome da chave no repositório</strong> (igual ao rótulo em{' '}
            <Link href="/admin/quick-add" className="text-emerald-400 underline-offset-2 hover:underline">
              Quick Add
            </Link>
            ) — o mapa lê aí a imagem e quando trocares no repositório, atualiza. Se deixares a miniatura{' '}
            <strong className="text-gray-200">vazia</strong>, usa o <strong className="text-gray-200">rótulo da regra</strong>{' '}
            no repositório. Migrações: <code className="text-gray-500">20260412210000…</code>,{' '}
            <code className="text-gray-500">20260412250000…</code>.
          </p>
        </section>

        <section
          ref={formSectionRef}
          id="thumbnail-rule-form"
          className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400/90">
              {editingRuleId ? 'Editar regra' : 'Nova regra'}
            </h2>
            {editingRuleId ? (
              <button
                type="button"
                onClick={() => resetForm()}
                disabled={saving || uploadingThumb}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
          <form onSubmit={saveRule} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500">Rótulo no repositório (ex. Arroz, Milk shake)</label>
              <input
                required
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
                placeholder="Arroz"
                disabled={saving || uploadingThumb}
              />
            </div>
            <div onPaste={onThumbnailPaste}>
              <label className="block text-xs text-gray-500">
                Miniatura (opcional) — <code className="text-gray-600">https://</code>, colar imagem/ficheiro, ou texto
                com o nome da entrada no repositório (ex. Sundae) para seguir a imagem que lá puseres.
              </label>
              <textarea
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                rows={formImageUrl.length > 200 ? 3 : 2}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-white focus:border-emerald-600 focus:outline-none"
                placeholder="https://… (colar imagem ou ficheiro — substitui por link do Storage)"
                disabled={saving || uploadingThumb}
                spellCheck={false}
              />
              {uploadingThumb ? (
                <p className="mt-1 text-xs font-medium text-amber-300/95">A enviar imagem para o Storage…</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) applyImageFromFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving || uploadingThumb}
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
                >
                  Escolher imagem…
                </button>
                {formImageUrl.trim() ? (
                  <button
                    type="button"
                    onClick={() => setFormImageUrl('')}
                    disabled={saving || uploadingThumb}
                    className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Limpar miniatura
                  </button>
                ) : null}
              </div>
              {isPreviewableImageRef(formImageUrl) ? (
                <div className="mt-3 flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formImageUrl.trim()}
                    alt="Pré-visualização"
                    className="h-20 w-20 shrink-0 rounded-md border border-white/10 object-cover"
                  />
                  <p className="text-xs text-gray-500">
                    Colar/ficheiro deve passar a mostrar aqui o link <code className="text-gray-600">https</code> do Storage
                    antes de gravares a regra. Regras antigas em base64: botão «Migrar base64 → Storage».
                  </p>
                </div>
              ) : null}
            </div>
            <div>
              <label className="block text-xs text-gray-500">
                Palavras-chave (uma por linha ou separadas por vírgula)
              </label>
              <textarea
                required
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
                placeholder={'arroz\nparboilizado\nintegral'}
                disabled={saving || uploadingThumb}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500">Contexto da loja</label>
                <select
                  value={formRc}
                  onChange={(e) => setFormRc(e.target.value as RetailContext)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  disabled={saving || uploadingThumb}
                >
                  <option value="supermarket">Supermercado (ou produto “de gôndola”)</option>
                  <option value="fast_food">Fast food / BK / Mc…</option>
                  <option value="any">Qualquer loja (se keyword bater)</option>
                </select>
                <p className="mt-1 text-xs text-gray-600">
                  Shake no BK/Mc é tratado como fast food no mapa: se a regra for só «Supermercado», não corre. Usa
                  «Qualquer loja» ou «Fast food».
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Ordem (menor = avaliado antes na lista)</label>
                <input
                  value={formOrder}
                  onChange={(e) => setFormOrder(e.target.value)}
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  disabled={saving || uploadingThumb}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Notas (opcional)</label>
              <input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                placeholder="Curadoria rede X"
                disabled={saving || uploadingThumb}
              />
            </div>
            <button
              type="submit"
              disabled={saving || uploadingThumb}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {saving
                ? 'A gravar…'
                : uploadingThumb
                  ? 'A processar imagem…'
                  : editingRuleId
                    ? 'Guardar alterações'
                    : 'Adicionar regra'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-300">Regras na base ({rules.length})</h2>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">A carregar…</p>
          ) : rules.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Ainda não há linhas na tabela. Após aplicares a migration no Supabase, cria regras aqui ou mantém só o
              fallback do código.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rules.map((row) => (
                <li
                  key={row.id}
                  className={`rounded-xl border px-4 py-3 ${
                    row.active ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-black/20 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-3">
                        {row.image_url ? (
                          /^data:image\//i.test(row.image_url.trim()) ? (
                            <div
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-amber-500/45 bg-amber-950/40 px-1 text-center text-[9px] font-medium leading-tight text-amber-100"
                              title="Base64 não aparece no mapa — usa «Migrar base64 → Storage»"
                            >
                              Migrar p/ Storage
                            </div>
                          ) : (
                            <img
                              src={row.image_url}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-lg border border-white/10 bg-black/40 object-cover"
                            />
                          )
                        ) : null}
                        <div className="min-w-0">
                          <p className="font-semibold text-emerald-300">{row.canonical_label}</p>
                          <p className="text-xs text-gray-500">
                            {RC_LABEL[row.retail_context] || row.retail_context} · ordem {row.sort_order}
                          </p>
                          {row.image_url ? (
                            <p
                              className="mt-1 truncate text-xs text-emerald-500/90"
                              title={row.image_url.length > 120 ? row.image_url.slice(0, 200) + '…' : row.image_url}
                            >
                              {/^data:image\//i.test(row.image_url.trim())
                                ? '(data:image… — migrar para HTTPS)'
                                : row.image_url}
                            </p>
                          ) : null}
                          <p className="mt-2 text-sm text-gray-400">
                            {(row.keywords || []).join(', ') || '(sem keywords)'}
                          </p>
                          {row.notes ? <p className="mt-1 text-xs text-gray-600">{row.notes}</p> : null}
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-start"
                      role="group"
                      aria-label="Ações da regra"
                    >
                      <button
                        type="button"
                        onClick={() => beginEdit(row)}
                        disabled={saving || uploadingThumb}
                        className="rounded-lg border border-emerald-500/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(row)}
                        disabled={saving || uploadingThumb}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
                      >
                        {row.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRule(row.id)}
                        disabled={saving || uploadingThumb}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                      >
                        Apagar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
