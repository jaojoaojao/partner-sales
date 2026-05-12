import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
  Plus, Trash2, GripVertical, Save, Download, FileSpreadsheet,
  FileText, Copy, History, Moon, Sun, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Sparkles, Layers, Settings2,
  ChevronDown, ChevronRight, X, Search, BarChart3, Youtube,
  ArrowUpRight, ArrowDownRight, Percent, DollarSign, Hash,
  Wand2, GitCompare, BookmarkPlus, Lock
} from 'lucide-react';

/* ============================================================
   TYPES & CORE FINANCIAL LOGIC
   Modular calculation engine — pure functions, no side effects
   ============================================================ */

// CategoryType: 'percentage' | 'fixed' | 'hybrid'
// Position: 'before_taxes' | 'after_taxes'
// Each category applies sequentially over the running subtotal.

const CATEGORY_KINDS = {
  CREATOR: { id: 'creator', label: 'Criador de Conteúdo', color: '#ef4444' },
  AGENCY: { id: 'agency', label: 'Agência', color: '#f97316' },
  SALES: { id: 'sales', label: 'Comercial / Vendedor', color: '#eab308' },
  TAX: { id: 'tax', label: 'Impostos', color: '#a855f7' },
  OPERATIONAL: { id: 'operational', label: 'Operacional', color: '#06b6d4' },
  MARGIN: { id: 'margin', label: 'Margem Empresa', color: '#10b981' },
  CUSTOM: { id: 'custom', label: 'Custo Customizado', color: '#64748b' },
  INVENTORY: { id: 'inventory', label: 'Inventário / Mídia', color: '#3b82f6' }
};

/**
 * Calcula o breakdown financeiro em cascata sequencial.
 * Cada categoria reduz o subtotal corrente conforme sua ordem.
 * Suporta valores fixos, percentuais e híbridos (% + valor fixo).
 */
function calculateBreakdown(grossRevenue, categories) {
  const sorted = [...categories];
  let runningSubtotal = grossRevenue;
  const breakdown = [];

  for (const cat of sorted) {
    const base = runningSubtotal;
    let amount = 0;

    if (cat.kind === 'percentage') {
      amount = base * (cat.percentage / 100);
    } else if (cat.kind === 'fixed') {
      amount = cat.fixedValue;
    } else if (cat.kind === 'hybrid') {
      amount = base * (cat.percentage / 100) + cat.fixedValue;
    }

    // Apenas categorias de "ganho da empresa" não são deduzidas — todas as outras são custos
    const isCost = cat.role !== 'profit';
    const newSubtotal = isCost ? base - amount : base;

    breakdown.push({
      ...cat,
      baseAmount: base,
      computedAmount: amount,
      subtotalAfter: newSubtotal,
      percentOfGross: grossRevenue > 0 ? (amount / grossRevenue) * 100 : 0
    });

    runningSubtotal = newSubtotal;
  }

  const totalCosts = breakdown
    .filter(b => b.role !== 'profit')
    .reduce((sum, b) => sum + b.computedAmount, 0);
  const finalProfit = runningSubtotal;
  const finalMargin = grossRevenue > 0 ? (finalProfit / grossRevenue) * 100 : 0;

  return {
    breakdown,
    grossRevenue,
    totalCosts,
    finalProfit,
    finalMargin,
    netRevenue: runningSubtotal
  };
}

/**
 * Gera insights automáticos baseados no breakdown calculado.
 * Heurísticas baseadas em benchmarks do mercado de mídia digital.
 */
function generateInsights(result) {
  const insights = [];
  const { breakdown, finalMargin, grossRevenue } = result;

  const findCat = (id) => breakdown.find(b => b.categoryType === id);

  const creator = findCat('creator');
  if (creator && creator.percentOfGross > 50) {
    insights.push({
      type: 'warning',
      title: 'Criador acima da média do mercado',
      detail: `O criador está recebendo ${creator.percentOfGross.toFixed(1)}% do bruto. Média de mercado: 35-45%.`
    });
  }

  const operational = findCat('operational');
  if (operational && operational.percentOfGross > 20) {
    insights.push({
      type: 'warning',
      title: 'Custo operacional elevado',
      detail: `Operacional em ${operational.percentOfGross.toFixed(1)}% — acima do benchmark de 20%.`
    });
  }

  if (finalMargin >= 25) {
    insights.push({
      type: 'success',
      title: 'Margem saudável',
      detail: `${finalMargin.toFixed(1)}% de margem final. Acima do benchmark do setor (20%).`
    });
  } else if (finalMargin >= 10 && finalMargin < 25) {
    insights.push({
      type: 'neutral',
      title: 'Margem dentro do esperado',
      detail: `${finalMargin.toFixed(1)}% — margem operacional padrão para o setor.`
    });
  } else if (finalMargin < 10 && finalMargin >= 0) {
    insights.push({
      type: 'warning',
      title: 'Margem apertada',
      detail: `Apenas ${finalMargin.toFixed(1)}% de margem. Revise custos ou renegocie o pedido.`
    });
  } else if (finalMargin < 0) {
    insights.push({
      type: 'danger',
      title: 'Campanha no prejuízo',
      detail: `Margem negativa de ${finalMargin.toFixed(1)}%. Esta operação está dando prejuízo.`
    });
  }

  const tax = findCat('tax');
  if (tax && tax.percentOfGross > 0 && tax.percentOfGross < 10) {
    insights.push({
      type: 'neutral',
      title: 'Carga tributária baixa',
      detail: `Impostos representam ${tax.percentOfGross.toFixed(1)}% — confirme o regime tributário.`
    });
  }

  if (grossRevenue < 5000) {
    insights.push({
      type: 'neutral',
      title: 'Ticket baixo para o setor',
      detail: 'Campanhas abaixo de R$ 5.000 tendem a ter custos fixos proporcionalmente altos.'
    });
  }

  return insights;
}

/* ============================================================
   PRESETS — modelos pré-configurados baseados na planilha real
   ============================================================ */

const DEFAULT_PRESETS = {
  partner_sales: {
    id: 'partner_sales',
    name: 'Partner Sales (Modelo Padrão)',
    description: 'Baseado na planilha de inserção em canais YouTube',
    locked: true,
    categories: [
      { id: '1', label: 'Comissão Vendedor', kind: 'percentage', percentage: 10, fixedValue: 0, categoryType: 'sales', color: '#eab308', role: 'cost' },
      { id: '2', label: 'Custo de Operação', kind: 'percentage', percentage: 10, fixedValue: 0, categoryType: 'agency', color: '#f97316', role: 'cost' },
      { id: '3', label: 'Comissão 1 Big Media', kind: 'percentage', percentage: 15, fixedValue: 0, categoryType: 'agency', color: '#d946ef', role: 'cost' },
      { id: '4', label: 'Imposto 1 Big Media', kind: 'percentage', percentage: 18, fixedValue: 0, categoryType: 'tax', color: '#a855f7', role: 'cost' },
      { id: '5', label: 'Custo de Internalização USA', kind: 'percentage', percentage: 15, fixedValue: 0, categoryType: 'operational', color: '#06b6d4', role: 'cost' }
    ]
  },
  influencer: {
    id: 'influencer',
    name: 'Modelo Influencer',
    description: 'Para campanhas de branded content com influenciadores',
    locked: false,
    categories: [
      { id: 'i1', label: 'Cachê do Influenciador', kind: 'percentage', percentage: 45, fixedValue: 0, categoryType: 'creator', color: '#ef4444', role: 'cost' },
      { id: 'i2', label: 'Comissão Agência', kind: 'percentage', percentage: 15, fixedValue: 0, categoryType: 'agency', color: '#f97316', role: 'cost' },
      { id: 'i3', label: 'Comissão Vendedor', kind: 'percentage', percentage: 8, fixedValue: 0, categoryType: 'sales', color: '#eab308', role: 'cost' },
      { id: 'i4', label: 'Impostos', kind: 'percentage', percentage: 12, fixedValue: 0, categoryType: 'tax', color: '#a855f7', role: 'cost' },
      { id: 'i5', label: 'Operacional', kind: 'percentage', percentage: 10, fixedValue: 0, categoryType: 'operational', color: '#06b6d4', role: 'cost' }
    ]
  },
  podcast: {
    id: 'podcast',
    name: 'Modelo Podcast',
    description: 'Para mídia spot em podcasts',
    locked: false,
    categories: [
      { id: 'p1', label: 'Pagamento ao Apresentador', kind: 'percentage', percentage: 40, fixedValue: 0, categoryType: 'creator', color: '#ef4444', role: 'cost' },
      { id: 'p2', label: 'Produção e Edição', kind: 'fixed', percentage: 0, fixedValue: 1500, categoryType: 'operational', color: '#06b6d4', role: 'cost' },
      { id: 'p3', label: 'Comissão Comercial', kind: 'percentage', percentage: 12, fixedValue: 0, categoryType: 'sales', color: '#eab308', role: 'cost' },
      { id: 'p4', label: 'Impostos', kind: 'percentage', percentage: 16, fixedValue: 0, categoryType: 'tax', color: '#a855f7', role: 'cost' },
      { id: 'p5', label: 'Distribuição em Plataformas', kind: 'percentage', percentage: 8, fixedValue: 0, categoryType: 'operational', color: '#0ea5e9', role: 'cost' }
    ]
  },
  tv: {
    id: 'tv',
    name: 'Modelo TV / Branded',
    description: 'Para campanhas tradicionais com produção pesada',
    locked: false,
    categories: [
      { id: 't1', label: 'Produção Audiovisual', kind: 'hybrid', percentage: 20, fixedValue: 15000, categoryType: 'operational', color: '#06b6d4', role: 'cost' },
      { id: 't2', label: 'Veiculação / Mídia', kind: 'percentage', percentage: 30, fixedValue: 0, categoryType: 'inventory', color: '#3b82f6', role: 'cost' },
      { id: 't3', label: 'Agência Criativa', kind: 'percentage', percentage: 15, fixedValue: 0, categoryType: 'agency', color: '#f97316', role: 'cost' },
      { id: 't4', label: 'Comissão Comercial', kind: 'percentage', percentage: 10, fixedValue: 0, categoryType: 'sales', color: '#eab308', role: 'cost' },
      { id: 't5', label: 'Impostos', kind: 'percentage', percentage: 18, fixedValue: 0, categoryType: 'tax', color: '#a855f7', role: 'cost' }
    ]
  }
};

/* ============================================================
   FORMATTERS
   ============================================================ */

const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v ?? 0);

const fmtPct = (v) => `${(v ?? 0).toFixed(2)}%`;

/* ============================================================
   PERSISTENT STORAGE HOOK
   Usa o storage API persistente (cross-session)
   ============================================================ */

function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [value, key]);

  return [value, setValue, true];
}

/* ============================================================
   UI PRIMITIVES — shadcn-style components inline
   ============================================================ */

const cn = (...classes) => classes.filter(Boolean).join(' ');

function Button({ variant = 'default', size = 'md', className, children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
  const variants = {
    default: 'bg-white text-black hover:bg-neutral-100 focus:ring-white/30 shadow-sm',
    primary: 'bg-gradient-to-b from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 shadow-lg shadow-red-500/20 focus:ring-red-500/40',
    ghost: 'text-neutral-300 hover:bg-white/5 hover:text-white',
    outline: 'border border-white/10 bg-white/[0.02] text-neutral-200 hover:bg-white/[0.05] hover:border-white/20',
    danger: 'text-red-400 hover:bg-red-500/10',
    subtle: 'bg-white/5 text-neutral-200 hover:bg-white/10'
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-6 text-base',
    icon: 'h-9 w-9'
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function Input({ className, prefix, ...props }) {
  return (
    <div className="relative">
      {prefix && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none">
          {prefix}
        </div>
      )}
      <input
        className={cn(
          'w-full h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-neutral-600',
          'focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-colors',
          prefix ? 'pl-8' : 'px-3',
          prefix && 'pr-3',
          className
        )}
        {...props}
      />
    </div>
  );
}

function Badge({ variant = 'default', children, className }) {
  const variants = {
    default: 'bg-white/5 text-neutral-300 border-white/10',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border tracking-wide uppercase', variants[variant], className)}>
      {children}
    </span>
  );
}

/* ============================================================
   MODAL
   ============================================================ */

function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className={cn('relative w-full', maxWidth)} onClick={(e) => e.stopPropagation()}>
        <Card className="bg-neutral-950/95 border-white/10">
          <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
            <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
            <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   CATEGORY ROW — editável, reordenável, com tipo de cálculo
   ============================================================ */

function CategoryRow({ category, index, breakdown, onChange, onDelete, onMove, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const result = breakdown?.find(b => b.id === category.id);

  const update = (field, value) => onChange({ ...category, [field]: value });

  return (
    <div
      className="group rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all"
    >
      <div className="flex items-center gap-2 p-3">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMove(index, index - 1)}
            disabled={isFirst}
            className="text-neutral-600 hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={12} className="rotate-[-90deg]" />
          </button>
          <button
            onClick={() => onMove(index, index + 1)}
            disabled={isLast}
            className="text-neutral-600 hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={12} className="rotate-90" />
          </button>
        </div>

        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />

        <input
          value={category.label}
          onChange={(e) => update('label', e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white focus:outline-none placeholder:text-neutral-600"
          placeholder="Nome da categoria"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-md p-0.5 border border-white/[0.04]">
            <button
              onClick={() => update('kind', 'percentage')}
              title="Percentual"
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-all',
                category.kind === 'percentage' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              <Percent size={11} />
            </button>
            <button
              onClick={() => update('kind', 'fixed')}
              title="Valor fixo"
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-all',
                category.kind === 'fixed' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              <DollarSign size={11} />
            </button>
            <button
              onClick={() => update('kind', 'hybrid')}
              title="Híbrido (% + valor)"
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-all',
                category.kind === 'hybrid' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              <Hash size={11} />
            </button>
          </div>

          {(category.kind === 'percentage' || category.kind === 'hybrid') && (
            <div className="relative w-20">
              <input
                type="number"
                step="0.01"
                value={category.percentage}
                onChange={(e) => update('percentage', parseFloat(e.target.value) || 0)}
                className="w-full h-8 px-2 pr-6 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs text-right text-white focus:outline-none focus:border-white/20"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">%</span>
            </div>
          )}

          {(category.kind === 'fixed' || category.kind === 'hybrid') && (
            <div className="relative w-28">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">R$</span>
              <input
                type="number"
                step="0.01"
                value={category.fixedValue}
                onChange={(e) => update('fixedValue', parseFloat(e.target.value) || 0)}
                className="w-full h-8 pl-7 pr-2 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs text-right text-white focus:outline-none focus:border-white/20"
              />
            </div>
          )}

          <div className="w-28 text-right">
            <div className="text-sm font-mono text-white tabular-nums">
              {result ? fmtBRL(result.computedAmount) : '—'}
            </div>
            {result && (
              <div className="text-[10px] text-neutral-500 tabular-nums">
                {result.percentOfGross.toFixed(1)}% do bruto
              </div>
            )}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-neutral-600 hover:text-white p-1 transition-colors"
          >
            <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
          </button>
          <button
            onClick={onDelete}
            className="text-neutral-600 hover:text-red-400 p-1 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.04] grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1 block">Tipo da categoria</label>
            <select
              value={category.categoryType}
              onChange={(e) => update('categoryType', e.target.value)}
              className="w-full h-8 px-2 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs text-white focus:outline-none focus:border-white/20"
            >
              {Object.values(CATEGORY_KINDS).map(k => (
                <option key={k.id} value={k.id} className="bg-neutral-900">{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1 block">Papel financeiro</label>
            <select
              value={category.role}
              onChange={(e) => update('role', e.target.value)}
              className="w-full h-8 px-2 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs text-white focus:outline-none focus:border-white/20"
            >
              <option value="cost" className="bg-neutral-900">Custo (deduz do subtotal)</option>
              <option value="profit" className="bg-neutral-900">Lucro (mantém no subtotal)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1 block">Cor do indicador</label>
            <div className="flex gap-1 flex-wrap">
              {['#ef4444','#f97316','#eab308','#10b981','#06b6d4','#3b82f6','#a855f7','#d946ef','#64748b','#84cc16'].map(c => (
                <button
                  key={c}
                  onClick={() => update('color', c)}
                  className={cn(
                    'w-6 h-6 rounded-md border-2 transition-all',
                    category.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {result && (
            <div className="col-span-2 text-[11px] text-neutral-400 bg-white/[0.02] rounded-md p-2 font-mono">
              Subtotal antes: {fmtBRL(result.baseAmount)} → após: <span className="text-white">{fmtBRL(result.subtotalAfter)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   KPI CARD
   ============================================================ */

function KPI({ label, value, sub, accent, icon: Icon, trend }) {
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: accent }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">{label}</span>
          {Icon && <Icon size={14} className="text-neutral-600" />}
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight tabular-nums" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
          {value}
        </div>
        {sub && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {trend === 'up' && <ArrowUpRight size={12} className="text-emerald-400" />}
            {trend === 'down' && <ArrowDownRight size={12} className="text-red-400" />}
            <span className="text-xs text-neutral-500 tabular-nums">{sub}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ============================================================
   CUSTOM TOOLTIP for charts
   ============================================================ */

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-neutral-950/95 border border-white/10 rounded-lg p-3 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
        <span className="text-xs font-medium text-white">{d.name}</span>
      </div>
      <div className="text-sm font-mono text-white">{fmtBRL(d.value)}</div>
      <div className="text-[10px] text-neutral-500">{d.percent.toFixed(1)}% do bruto</div>
    </div>
  );
}

/* ============================================================
   INSIGHTS PANEL
   ============================================================ */

function InsightsPanel({ insights }) {
  const iconMap = {
    success: <CheckCircle2 size={14} className="text-emerald-400" />,
    warning: <AlertTriangle size={14} className="text-amber-400" />,
    danger: <AlertTriangle size={14} className="text-red-400" />,
    neutral: <Sparkles size={14} className="text-blue-400" />
  };
  const bgMap = {
    success: 'border-emerald-500/20 bg-emerald-500/[0.03]',
    warning: 'border-amber-500/20 bg-amber-500/[0.03]',
    danger: 'border-red-500/20 bg-red-500/[0.03]',
    neutral: 'border-blue-500/20 bg-blue-500/[0.03]'
  };
  return (
    <div className="space-y-2">
      {insights.length === 0 && (
        <div className="text-xs text-neutral-500 italic">Aguardando dados para gerar insights.</div>
      )}
      {insights.map((ins, i) => (
        <div key={i} className={cn('rounded-lg border p-3 flex items-start gap-2.5', bgMap[ins.type])}>
          <div className="mt-0.5 flex-shrink-0">{iconMap[ins.type]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white mb-0.5">{ins.title}</div>
            <div className="text-[11px] text-neutral-400 leading-relaxed">{ins.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   EXPORT FUNCTIONS
   ============================================================ */

function exportToCSV(result, campaignName = 'Campanha') {
  const rows = [
    ['YouTube Ad Revenue Calculator — Breakdown'],
    ['Campanha', campaignName],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    [],
    ['Item', 'Tipo', 'Percentual', 'Valor Fixo', 'Base de Cálculo', 'Valor Calculado', 'Subtotal Após', '% do Bruto'],
    ['Receita Bruta', '—', '—', '—', '—', result.grossRevenue.toFixed(2), result.grossRevenue.toFixed(2), '100.00%']
  ];
  result.breakdown.forEach(b => {
    rows.push([
      b.label,
      b.kind,
      b.kind !== 'fixed' ? `${b.percentage}%` : '—',
      b.kind !== 'percentage' ? b.fixedValue.toFixed(2) : '—',
      b.baseAmount.toFixed(2),
      b.computedAmount.toFixed(2),
      b.subtotalAfter.toFixed(2),
      `${b.percentOfGross.toFixed(2)}%`
    ]);
  });
  rows.push([]);
  rows.push(['Total de Custos', '', '', '', '', result.totalCosts.toFixed(2)]);
  rows.push(['Lucro Final', '', '', '', '', result.finalProfit.toFixed(2)]);
  rows.push(['Margem Final', '', '', '', '', `${result.finalMargin.toFixed(2)}%`]);

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${campaignName.replace(/\s+/g,'_')}_breakdown.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(result, campaignName = 'Campanha') {
  const win = window.open('', '_blank');
  if (!win) return;

  const rows = result.breakdown.map(b => `
    <tr>
      <td>${b.label}</td>
      <td style="text-align:center;">${b.kind === 'percentage' ? `${b.percentage}%` : b.kind === 'fixed' ? 'Fixo' : `${b.percentage}% + fixo`}</td>
      <td style="text-align:right; font-family: monospace;">${fmtBRL(b.baseAmount)}</td>
      <td style="text-align:right; font-family: monospace; color: #c00;">${fmtBRL(b.computedAmount)}</td>
      <td style="text-align:right; font-family: monospace;">${fmtBRL(b.subtotalAfter)}</td>
      <td style="text-align:right; font-size:11px; color:#666;">${b.percentOfGross.toFixed(2)}%</td>
    </tr>
  `).join('');

  win.document.write(`
    <html><head><title>Breakdown — ${campaignName}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; color: #111; max-width: 820px; margin: 0 auto; }
      h1 { font-size: 22px; letter-spacing: -0.02em; margin-bottom: 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 32px; }
      .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
      .kpi { padding: 14px; border: 1px solid #e5e5e5; border-radius: 8px; }
      .kpi .label { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; margin-bottom: 6px; }
      .kpi .value { font-family: monospace; font-size: 18px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #111; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
      td { padding: 10px 8px; border-bottom: 1px solid #eee; }
      tr.gross { font-weight: 600; background: #f5f5f5; }
      tr.final { font-weight: 600; border-top: 2px solid #111; background: #fff7ed; }
      .footer { margin-top: 40px; font-size: 10px; color: #999; text-align: center; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <h1>${campaignName}</h1>
    <div class="sub">Breakdown financeiro · ${new Date().toLocaleString('pt-BR')}</div>
    <div class="kpis">
      <div class="kpi"><div class="label">Receita Bruta</div><div class="value">${fmtBRL(result.grossRevenue)}</div></div>
      <div class="kpi"><div class="label">Total Custos</div><div class="value">${fmtBRL(result.totalCosts)}</div></div>
      <div class="kpi"><div class="label">Lucro Final</div><div class="value">${fmtBRL(result.finalProfit)}</div></div>
      <div class="kpi"><div class="label">Margem</div><div class="value">${result.finalMargin.toFixed(2)}%</div></div>
    </div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center;">Tipo</th><th style="text-align:right;">Base</th><th style="text-align:right;">Valor</th><th style="text-align:right;">Subtotal Após</th><th style="text-align:right;">% Bruto</th></tr></thead>
      <tbody>
        <tr class="gross"><td>Receita Bruta</td><td></td><td></td><td></td><td style="text-align:right; font-family:monospace;">${fmtBRL(result.grossRevenue)}</td><td style="text-align:right;">100.00%</td></tr>
        ${rows}
        <tr class="final"><td colspan="4">Lucro Final</td><td style="text-align:right; font-family:monospace;">${fmtBRL(result.finalProfit)}</td><td style="text-align:right;">${result.finalMargin.toFixed(2)}%</td></tr>
      </tbody>
    </table>
    <div class="footer">Gerado por YouTube Ad Revenue Calculator</div>
    <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  win.document.close();
}

/* ============================================================
   MAIN APP
   ============================================================ */

export default function App() {
  // Estado principal
  const [grossRevenue, setGrossRevenue] = useState(10000);
  const [campaignName, setCampaignName] = useState('');
  const [categories, setCategories] = useState(DEFAULT_PRESETS.partner_sales.categories);

  // Etapa 1 — Inventário YouTube
  const [cpm, setCpm] = useState(12);

  // Estados persistentes
  const [presets, setPresets, presetsLoaded] = useStoredState('yt_calc:presets_v1', DEFAULT_PRESETS);
  const [history, setHistory, historyLoaded] = useStoredState('yt_calc:history_v1', []);
  const [scenarios, setScenarios, scenariosLoaded] = useStoredState('yt_calc:scenarios_v1', []);

  // UI state
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Cálculo principal — useMemo garante atualização em tempo real
  const result = useMemo(() => calculateBreakdown(grossRevenue, categories), [grossRevenue, categories]);
  const insights = useMemo(() => generateInsights(result), [result]);

  // Etapa 1: views é resultado — quantas impressões o PI compra a esse CPM
  const views = useMemo(() => (cpm > 0 ? (grossRevenue / cpm) * 1000 : 0), [grossRevenue, cpm]);
  // Inventário = PI inteiro (views × CPM / 1000 = PI — é o que o YouTube recebe pelo media buy)
  // Mostrado como referência no resultado, não subtraído (as comissões já saem do PI)
  const inventoryCost = grossRevenue; // alias semântico: o PI É o custo do inventário

  // Crédito ao canal = o que sobra depois de todas as comissões da cascata
  const finalCredit = useMemo(() => result.finalProfit, [result.finalProfit]);

  // Calculadora reversa: dado o crédito líquido desejado, qual PI cobrar?
  // PI = desejado / fator_cascata  (fator_cascata = finalProfit / grossRevenue)
  // Para cascatas com custos fixos: PI = (desejado + fixos) / (fator_proporcional)
  const [reverseTarget, setReverseTarget] = useStoredState('yt_calc:reverse_target', 0);
  const reversedPI = useMemo(() => {
    if (!reverseTarget || reverseTarget <= 0 || !grossRevenue) return 0;
    const fixedCosts = result.breakdown
      .filter(b => b.kind === 'fixed' && b.role !== 'profit')
      .reduce((s, b) => s + b.fixedValue, 0);
    // fator proporcional = (crédito + custos fixos) / PI corrente
    const propFactor = grossRevenue > 0
      ? (result.finalProfit + fixedCosts) / grossRevenue
      : 0;
    if (propFactor <= 0) return 0;
    return (reverseTarget + fixedCosts) / propFactor;
  }, [reverseTarget, result, grossRevenue]);

  // Calculadora AdSense vs Venda Direta
  const [adsenseRpm, setAdsenseRpm] = useStoredState('yt_calc:adsense_rpm', 10);
  const adsenseRevenue = useMemo(() => (views / 1000) * adsenseRpm, [views, adsenseRpm]);
  const adsenseDiff = useMemo(() => finalCredit - adsenseRevenue, [finalCredit, adsenseRevenue]);
  const adsenseUpliftPct = useMemo(
    () => (adsenseRevenue > 0 ? (adsenseDiff / adsenseRevenue) * 100 : 0),
    [adsenseDiff, adsenseRevenue]
  );
  const adsenseMultiplier = useMemo(
    () => (adsenseRevenue > 0 ? finalCredit / adsenseRevenue : 0),
    [finalCredit, adsenseRevenue]
  );

  // Handlers de categorias
  const updateCategory = useCallback((updated) => {
    setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
  }, []);

  const deleteCategory = useCallback((id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  const moveCategory = useCallback((from, to) => {
    if (to < 0 || to >= categories.length) return;
    setCategories(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }, [categories.length]);

  const addCategory = useCallback(() => {
    const newId = `c_${Date.now()}`;
    setCategories(prev => [...prev, {
      id: newId,
      label: 'Nova Categoria',
      kind: 'percentage',
      percentage: 10,
      fixedValue: 0,
      categoryType: 'custom',
      color: '#64748b',
      role: 'cost'
    }]);
  }, []);

  // Presets
  const loadPreset = useCallback((preset) => {
    const fresh = preset.categories.map(c => ({ ...c, id: `${c.id}_${Date.now()}` }));
    setCategories(fresh);
    setShowPresetsModal(false);
  }, []);

  const saveAsPreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    const id = `custom_${Date.now()}`;
    setPresets(prev => ({
      ...prev,
      [id]: {
        id,
        name: newPresetName,
        description: 'Preset personalizado',
        locked: false,
        categories: categories.map(c => ({ ...c }))
      }
    }));
    setNewPresetName('');
    setShowSavePresetModal(false);
  }, [newPresetName, categories, setPresets]);

  const deletePreset = useCallback((id) => {
    setPresets(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setPresets]);

  // Histórico
  const saveToHistory = useCallback(() => {
    const entry = {
      id: `h_${Date.now()}`,
      name: campaignName,
      timestamp: Date.now(),
      grossRevenue,
      categories: categories.map(c => ({ ...c })),
      finalProfit: result.finalProfit,
      finalMargin: result.finalMargin
    };
    setHistory(prev => [entry, ...prev].slice(0, 50));
  }, [campaignName, grossRevenue, categories, result, setHistory]);

  const loadFromHistory = useCallback((entry) => {
    setCampaignName(entry.name);
    setGrossRevenue(entry.grossRevenue);
    setCategories(entry.categories);
    setShowHistoryModal(false);
  }, []);

  // Duplicar / cenários
  const duplicateAsScenario = useCallback(() => {
    const scenario = {
      id: `s_${Date.now()}`,
      name: `${campaignName} (Cenário ${scenarios.length + 1})`,
      grossRevenue,
      categories: categories.map(c => ({ ...c })),
      finalProfit: result.finalProfit,
      finalMargin: result.finalMargin
    };
    setScenarios(prev => [...prev, scenario]);
  }, [campaignName, grossRevenue, categories, result, scenarios.length, setScenarios]);

  const removeScenario = useCallback((id) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  }, [setScenarios]);

  // Dados para gráficos
  const pieData = useMemo(() => {
    const data = result.breakdown
      .filter(b => b.computedAmount > 0)
      .map(b => ({
        name: b.label,
        value: b.computedAmount,
        percent: b.percentOfGross,
        color: b.color
      }));
    if (result.finalProfit > 0) {
      data.push({
        name: 'Lucro Final',
        value: result.finalProfit,
        percent: result.finalMargin,
        color: '#10b981'
      });
    }
    return data;
  }, [result]);

  const compareData = useMemo(() => {
    const all = [
      { name: 'Atual', bruto: grossRevenue, lucro: result.finalProfit, margem: result.finalMargin },
      ...scenarios.map(s => ({
        name: s.name.length > 18 ? s.name.slice(0, 18) + '…' : s.name,
        bruto: s.grossRevenue,
        lucro: s.finalProfit,
        margem: s.finalMargin
      }))
    ];
    return all;
  }, [grossRevenue, result, scenarios]);

  return (
    <div className="min-h-screen w-full text-white antialiased" style={{
      background: 'radial-gradient(ellipse 1200px 800px at 20% -10%, rgba(239, 68, 68, 0.08), transparent 50%), radial-gradient(ellipse 1000px 600px at 100% 0%, rgba(168, 85, 247, 0.06), transparent 50%), #0a0a0a',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {/* Font + global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif&display=swap');
        body { background: #0a0a0a; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 200ms ease-out; }
      `}</style>

      <div className="grid-bg min-h-screen">
        {/* ============== HEADER ============== */}
        <header className="border-b border-white/[0.05] backdrop-blur-xl bg-black/30 sticky top-0 z-40">
          <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
                <Youtube size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-white tracking-tight">Partner Sales Calculator</h1>
                <div className="text-[11px] text-neutral-500">Cascata financeira · eMotion Studios</div>
              </div>
              <Badge variant="info" className="ml-2 hidden md:inline-flex">v1.0</Badge>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowPresetsModal(true)}>
                <Layers size={14} /> Presets
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowHistoryModal(true)}>
                <History size={14} /> Histórico
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCompareModal(true)}>
                <GitCompare size={14} /> Cenários
                {scenarios.length > 0 && <Badge variant="info" className="ml-1">{scenarios.length}</Badge>}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowArchitectureModal(true)}>
                <Settings2 size={14} /> Arquitetura
              </Button>
              <div className="w-px h-6 bg-white/10 mx-1" />
              <Button variant="outline" size="sm" onClick={() => exportToCSV(result, campaignName)}>
                <FileSpreadsheet size={14} /> Excel
              </Button>
              <Button variant="primary" size="sm" onClick={() => exportToPDF(result, campaignName)}>
                <FileText size={14} /> PDF
              </Button>
            </div>
          </div>
        </header>

        {/* ============== MAIN GRID ============== */}
        <main className="max-w-[1600px] mx-auto px-6 py-8">
          {/* Hero / título de campanha */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="default">Partner Sales</Badge>
              <Badge variant="warning">Tempo real</Badge>
            </div>
            <label className="text-[11px] uppercase tracking-wider text-neutral-600 block mb-1">Nome da campanha</label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Campanha Verão 2025 — Nike"
              className="w-full bg-transparent text-3xl md:text-4xl text-white tracking-tight focus:outline-none border-b border-white/10 focus:border-white/30 pb-2 transition-colors placeholder:text-neutral-700"
              style={{ fontFamily: '"Instrument Serif", "Inter", serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            />
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KPI
              label="PI Bruto"
              value={fmtBRL(result.grossRevenue)}
              sub="Valor total do pedido"
              accent="#ef4444"
              icon={DollarSign}
            />
            <KPI
              label="Visualizações Entregues"
              value={views >= 1_000_000 ? `${(views/1_000_000).toFixed(2)}M` : views >= 1_000 ? `${(views/1_000).toFixed(1)}K` : Math.round(views).toLocaleString('pt-BR')}
              sub={`CPM R$${cpm} · ${fmtBRL(grossRevenue)} de verba`}
              accent="#3b82f6"
              icon={Youtube}
            />
            <KPI
              label="Comissões + Impostos"
              value={fmtBRL(result.totalCosts)}
              sub={`${(result.grossRevenue > 0 ? (result.totalCosts/result.grossRevenue)*100 : 0).toFixed(1)}% do bruto`}
              accent="#f97316"
              icon={TrendingDown}
              trend="down"
            />
            <KPI
              label="Crédito Efetivo ao Canal"
              value={fmtBRL(finalCredit)}
              sub={`${(result.grossRevenue > 0 ? (finalCredit/result.grossRevenue)*100 : 0).toFixed(1)}% do bruto`}
              accent={finalCredit > 0 ? '#10b981' : '#ef4444'}
              icon={TrendingUp}
              trend={finalCredit > 0 ? 'up' : 'down'}
            />
          </div>

          {/* Layout principal: input + categorias | gráficos + insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUNA ESQUERDA — Etapa 1 + Etapa 2 + Tabela */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── ETAPA 1: Custo do Inventário ── */}
              <Card className="p-5 border-blue-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">Custo do Inventário YouTube</div>
                    <h2 className="text-base font-semibold text-white">Impressões × CPM</h2>
                  </div>
                  <Badge variant="info" className="ml-auto">R$ {cpm}/mil views</Badge>
                </div>

                {/* PI Bruto + CPM lado a lado */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-neutral-500 block mb-1.5">Valor do PI (verba da campanha)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={grossRevenue}
                        onChange={(e) => setGrossRevenue(parseFloat(e.target.value) || 0)}
                        className="w-full h-12 pl-9 pr-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-lg font-semibold text-white focus:outline-none focus:border-red-500/40 focus:bg-red-500/[0.02] transition-all tabular-nums"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[5000, 10000, 25000, 50000, 100000].map(v => (
                        <button key={v} onClick={() => setGrossRevenue(v)}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors tabular-nums">
                          {fmtBRL(v)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-neutral-500 block mb-1.5">CPM (R$ por mil impressões)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">R$</span>
                      <input
                        type="number"
                        step="0.5"
                        value={cpm}
                        onChange={(e) => setCpm(parseFloat(e.target.value) || 0)}
                        className="w-full h-12 pl-8 pr-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-lg font-semibold text-white focus:outline-none focus:border-blue-500/40 transition-all tabular-nums"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Formatos de mídia disponíveis */}
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Espaços de mídia disponíveis</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Bumper', desc: '6s não pulável', cpm: 8 },
                      { label: "Pre-roll 30''", desc: 'Skippable', cpm: 10 },
                      { label: "Pre-roll 30''", desc: 'Non-Skippable', cpm: 16 },
                      { label: "Pre-roll 15''", desc: 'Non-Skippable', cpm: 12 },
                    ].map((fmt) => (
                      <button
                        key={fmt.label + fmt.cpm}
                        onClick={() => setCpm(fmt.cpm)}
                        className={cn(
                          'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all',
                          cpm === fmt.cpm
                            ? 'bg-blue-500/15 border-blue-500/40'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]'
                        )}
                      >
                        <div>
                          <div className={cn('text-xs font-medium', cpm === fmt.cpm ? 'text-blue-300' : 'text-neutral-200')}>
                            {fmt.label}
                          </div>
                          <div className="text-[10px] text-neutral-500">{fmt.desc}</div>
                        </div>
                        <div className={cn('text-sm font-bold font-mono tabular-nums', cpm === fmt.cpm ? 'text-blue-300' : 'text-neutral-400')}>
                          R${fmt.cpm}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resultado Etapa 1 — views é o OUTPUT */}
                <div className="rounded-lg bg-blue-500/[0.06] border border-blue-500/20 p-4">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Resultado · Alcance da campanha</div>
                  <div className="flex items-end justify-between">
                    <div className="text-sm text-neutral-400 leading-relaxed">
                      <span className="font-mono text-white tabular-nums">{fmtBRL(grossRevenue)}</span>
                      <span className="mx-1.5">÷</span>
                      <span className="font-mono text-white tabular-nums">R${cpm}</span>
                      <span className="mx-1.5">× 1.000 =</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-300 font-mono tabular-nums">
                        {views >= 1_000_000
                          ? `${(views / 1_000_000).toFixed(2)}M`
                          : views >= 1_000
                          ? `${(views / 1_000).toFixed(1)}K`
                          : Math.round(views).toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-neutral-500">visualizações entregues</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* ── ETAPA 2: Cascata de Comissões ── */}
              <Card className="p-5 border-amber-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">Custo paralelo ao inventário</div>
                    <h2 className="text-base font-semibold text-white">Cascata de Comissões</h2>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSavePresetModal(true)}>
                      <BookmarkPlus size={14} /> Salvar preset
                    </Button>
                    <Button variant="subtle" size="sm" onClick={addCategory}>
                      <Plus size={14} /> Adicionar
                    </Button>
                  </div>
                </div>

                {/* Vínculo explícito com o PI */}
                <div className="flex items-center justify-between text-xs rounded-md bg-white/[0.02] border border-white/[0.05] px-3 py-2 mb-3">
                  <span className="text-neutral-500">Aplicando sobre o PI da Etapa 1</span>
                  <span className="font-mono font-semibold text-white tabular-nums">{fmtBRL(grossRevenue)}</span>
                </div>

                <div className="text-[11px] text-neutral-500 mb-3 flex items-center gap-2 bg-amber-500/[0.04] border border-amber-500/[0.1] rounded-md p-2">
                  <Sparkles size={12} className="text-amber-400 flex-shrink-0" />
                  <span>Cada categoria reduz o subtotal corrente — a ordem importa. Reordene com as setas.</span>
                </div>

                <div className="space-y-2">
                  {categories.map((cat, i) => (
                    <CategoryRow
                      key={cat.id}
                      category={cat}
                      index={i}
                      breakdown={result.breakdown}
                      onChange={updateCategory}
                      onDelete={() => deleteCategory(cat.id)}
                      onMove={moveCategory}
                      isFirst={i === 0}
                      isLast={i === categories.length - 1}
                    />
                  ))}
                </div>

                {categories.length === 0 && (
                  <div className="text-center py-12 text-neutral-500 text-sm">
                    Nenhuma categoria configurada. Clique em "Adicionar" para começar.
                  </div>
                )}

                {/* Resultado Etapa 2 */}
                <div className="flex items-center justify-between rounded-lg bg-amber-500/[0.06] border border-amber-500/20 p-3 mt-3">
                  <div className="text-sm text-neutral-400">Líquido após cascata de comissões</div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-amber-300 font-mono tabular-nums">{fmtBRL(result.finalProfit)}</div>
                    <div className="text-[10px] text-neutral-500">{result.finalMargin.toFixed(1)}% do PI bruto</div>
                  </div>
                </div>
              </Card>

              {/* ── RESULTADO FINAL ── */}
              <Card className="p-5 border-emerald-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={14} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">Resultado final</div>
                    <h2 className="text-base font-semibold text-white">Distribuição do PI</h2>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm font-mono">
                  {/* PI Bruto */}
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
                    <span className="text-neutral-300 font-sans font-medium">PI Bruto</span>
                    <span className="text-white tabular-nums">{fmtBRL(grossRevenue)}</span>
                  </div>
                  {/* Custo do inventário YouTube */}
                  <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04] bg-blue-500/[0.02] px-2 rounded-md">
                    <div className="flex items-center gap-2 font-sans min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-400" />
                      <div className="min-w-0">
                        <span className="text-neutral-300 text-xs">Custo Inventário YouTube</span>
                        <span className="text-neutral-600 text-[10px] ml-1.5 tabular-nums">
                          {views >= 1_000_000 ? `${(views/1_000_000).toFixed(2)}M` : `${(views/1_000).toFixed(1)}K`} views × R${cpm}/mil
                        </span>
                      </div>
                    </div>
                    <span className="text-blue-400 tabular-nums text-xs flex-shrink-0 ml-2">{fmtBRL(inventoryCost)}</span>
                  </div>
                  {/* Comissões em cascata */}
                  {result.breakdown.map(b => (
                    <div key={b.id} className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
                      <div className="flex items-center gap-2 font-sans text-neutral-400 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                        <span className="truncate text-xs">{b.label}</span>
                      </div>
                      <span className="text-red-400 tabular-nums text-xs flex-shrink-0 ml-2">- {fmtBRL(b.computedAmount)}</span>
                    </div>
                  ))}
                  {/* Crédito final */}
                  <div className="flex justify-between items-center py-2.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 px-3 mt-2">
                    <span className="text-emerald-300 font-sans font-semibold">= Crédito ao canal</span>
                    <div className="text-right">
                      <div className={cn('text-xl font-bold tabular-nums', finalCredit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {fmtBRL(finalCredit)}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {(result.grossRevenue > 0 ? (finalCredit/result.grossRevenue)*100 : 0).toFixed(1)}% do PI bruto
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* ── CALCULADORA REVERSA ── */}
              <Card className="p-5 border-violet-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0">
                    <ArrowUpRight size={14} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">Conta reversa</div>
                    <h2 className="text-base font-semibold text-white">Qual PI cobrar?</h2>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-[11px] uppercase tracking-wider text-neutral-500 block mb-1.5">
                    Crédito líquido desejado ao canal (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">R$</span>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={reverseTarget || ''}
                      onChange={(e) => setReverseTarget(parseFloat(e.target.value) || 0)}
                      placeholder="Ex: 5.000"
                      className="w-full h-12 pl-9 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-lg font-semibold text-white focus:outline-none focus:border-violet-500/40 transition-all tabular-nums placeholder:text-neutral-700"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[1000, 2500, 5000, 10000, 20000].map(v => (
                      <button key={v} onClick={() => setReverseTarget(v)}
                        className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors tabular-nums',
                          reverseTarget === v
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                            : 'bg-white/[0.03] border-white/[0.05] text-neutral-500 hover:text-white hover:bg-white/[0.06]')}>
                        {fmtBRL(v)}
                      </button>
                    ))}
                  </div>
                </div>

                {reverseTarget > 0 && reversedPI > 0 ? (
                  <div className="space-y-2">
                    {/* PI calculado */}
                    <div className="rounded-lg bg-violet-500/[0.08] border border-violet-500/25 p-4">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">PI a cobrar do anunciante</div>
                      <div className="text-2xl font-bold text-violet-300 font-mono tabular-nums">{fmtBRL(reversedPI)}</div>
                      <div className="text-[10px] text-neutral-500 mt-1">
                        {(reverseTarget / reversedPI * 100).toFixed(1)}% do PI · fator cascata: {(result.finalProfit / grossRevenue * 100).toFixed(1)}%
                      </div>
                    </div>
                    {/* Views correspondentes */}
                    <div className="rounded-lg bg-blue-500/[0.05] border border-blue-500/15 p-3 flex items-center justify-between">
                      <span className="text-xs text-neutral-400">Views entregues para esse PI</span>
                      <span className="font-mono text-blue-300 tabular-nums text-sm font-semibold">
                        {cpm > 0
                          ? (() => {
                              const v = (reversedPI / cpm) * 1000;
                              return v >= 1_000_000 ? `${(v/1_000_000).toFixed(2)}M` : `${(v/1_000).toFixed(1)}K`;
                            })()
                          : '—'
                        } views
                      </span>
                    </div>
                    {/* Checklist */}
                    <div className="text-[11px] text-neutral-500 space-y-1 pt-1">
                      <div className="flex justify-between">
                        <span>Comissões + impostos</span>
                        <span className="text-neutral-400 tabular-nums">- {fmtBRL(reversedPI - reverseTarget)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-neutral-300">Crédito ao canal</span>
                        <span className="text-emerald-400 tabular-nums">{fmtBRL(reverseTarget)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-neutral-600 text-xs">
                    Digite o crédito desejado para calcular o PI necessário
                  </div>
                )}
              </Card>

              {/* Configuração de custos — HIDDEN, mantida para referência no breakdown */}
              <Card className="overflow-hidden">
                <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Tabela de breakdown</div>
                    <h2 className="text-base font-semibold text-white">Visão Detalhada</h2>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={saveToHistory}>
                      <Save size={14} /> Salvar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={duplicateAsScenario}>
                      <Copy size={14} /> Duplicar
                    </Button>
                  </div>
                </div>

                {/* ORIGINAL BREAKDOWN TABLE PLACEHOLDER — replaced below */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                        <th className="text-left p-3 font-medium">Item</th>
                        <th className="text-right p-3 font-medium">Base</th>
                        <th className="text-right p-3 font-medium">Cálculo</th>
                        <th className="text-right p-3 font-medium">Valor</th>
                        <th className="text-right p-3 font-medium">Subtotal</th>
                        <th className="text-right p-3 font-medium">% Bruto</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      <tr className="border-t border-white/[0.05] bg-white/[0.015]">
                        <td className="p-3 font-sans text-white font-semibold">PI Bruto</td>
                        <td className="p-3 text-right text-neutral-600">—</td>
                        <td className="p-3 text-right text-neutral-600">—</td>
                        <td className="p-3 text-right text-white font-semibold">{fmtBRL(result.grossRevenue)}</td>
                        <td className="p-3 text-right text-white font-semibold">{fmtBRL(result.grossRevenue)}</td>
                        <td className="p-3 text-right text-neutral-400">100.00%</td>
                      </tr>
                      {/* Etapa 1 row — alcance calculado */}
                      <tr className="border-t border-white/[0.04] bg-blue-500/[0.03]">
                        <td className="p-3 font-sans">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="text-neutral-200">Alcance (Inventário YouTube)</span>
                            <Badge variant="info" className="text-[9px]">Etapa 1</Badge>
                          </div>
                        </td>
                        <td className="p-3 text-right text-neutral-500 tabular-nums">{fmtBRL(grossRevenue)}</td>
                        <td className="p-3 text-right text-neutral-500">÷ R${cpm}/mil</td>
                        <td className="p-3 text-right text-blue-400 tabular-nums font-mono">
                          {views >= 1_000_000 ? `${(views/1_000_000).toFixed(2)}M` : `${(views/1_000).toFixed(1)}K`} views
                        </td>
                        <td className="p-3 text-right text-neutral-500 tabular-nums">—</td>
                        <td className="p-3 text-right text-neutral-500 tabular-nums">—</td>
                      </tr>
                      {/* Etapa 2 rows */}
                      {result.breakdown.map(b => (
                        <tr key={b.id} className="border-t border-white/[0.04] hover:bg-white/[0.015]">
                          <td className="p-3 font-sans">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                              <span className="text-neutral-200">{b.label}</span>
                              <Badge variant="warning" className="text-[9px]">Etapa 2</Badge>
                            </div>
                          </td>
                          <td className="p-3 text-right text-neutral-500 tabular-nums">{fmtBRL(b.baseAmount)}</td>
                          <td className="p-3 text-right text-neutral-500">
                            {b.kind === 'percentage' && `${b.percentage}%`}
                            {b.kind === 'fixed' && 'fixo'}
                            {b.kind === 'hybrid' && `${b.percentage}% +`}
                          </td>
                          <td className="p-3 text-right text-red-400 tabular-nums">{fmtBRL(b.computedAmount)}</td>
                          <td className="p-3 text-right text-white tabular-nums">{fmtBRL(b.subtotalAfter)}</td>
                          <td className="p-3 text-right text-neutral-500 tabular-nums">{b.percentOfGross.toFixed(2)}%</td>
                        </tr>
                      ))}
                      {/* Final row */}
                      <tr className="border-t-2 border-emerald-500/30 bg-emerald-500/[0.04]">
                        <td className="p-3 font-sans font-semibold text-emerald-400" colSpan={4}>Crédito Efetivo ao Canal</td>
                        <td className="p-3 text-right tabular-nums font-semibold" style={{ color: finalCredit >= 0 ? '#34d399' : '#f87171' }}>
                          {fmtBRL(finalCredit)}
                        </td>
                        <td className="p-3 text-right tabular-nums font-semibold" style={{ color: finalCredit >= 0 ? '#34d399' : '#f87171' }}>
                          {(result.grossRevenue > 0 ? (finalCredit/result.grossRevenue)*100 : 0).toFixed(2)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* COLUNA DIREITA — Gráficos + Insights */}
            <div className="space-y-6">
              {/* Pie chart */}
              <Card className="p-5">
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Visualização</div>
                  <h2 className="text-base font-semibold text-white">Divisão Financeira</h2>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-neutral-300 truncate">{d.name}</span>
                      </div>
                      <span className="text-neutral-500 tabular-nums flex-shrink-0 ml-2">{d.percent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Distribuição horizontal (barra) */}
              <Card className="p-5">
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Distribuição</div>
                  <h2 className="text-base font-semibold text-white">Receita por Categoria</h2>
                </div>
                <div className="flex h-6 rounded-md overflow-hidden border border-white/[0.06]">
                  {pieData.map((d, i) => (
                    <div
                      key={i}
                      className="h-full transition-all hover:brightness-125 cursor-default"
                      style={{
                        width: `${(d.value / result.grossRevenue) * 100}%`,
                        backgroundColor: d.color
                      }}
                      title={`${d.name}: ${fmtBRL(d.value)} (${d.percent.toFixed(1)}%)`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-neutral-500 tabular-nums">
                  <span>R$ 0</span>
                  <span>{fmtBRL(result.grossRevenue)}</span>
                </div>
              </Card>

              {/* Insights */}
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Análise</div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Wand2 size={14} className="text-amber-400" />
                      Insights Automáticos
                    </h2>
                  </div>
                </div>
                <InsightsPanel insights={insights} />
              </Card>

              {/* ── AdSense vs Venda Direta ── */}
              <Card className="p-5 border-purple-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                    <GitCompare size={14} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">Comparativo</div>
                    <h2 className="text-base font-semibold text-white">Venda Direta vs AdSense</h2>
                  </div>
                </div>

                {/* Views (leitura da Etapa 1) */}
                <div className="flex items-center justify-between text-xs text-neutral-500 bg-white/[0.02] rounded-md px-3 py-2 mb-3 border border-white/[0.05]">
                  <span>Visualizações (da Etapa 1)</span>
                  <span className="font-mono text-neutral-300 tabular-nums">{views.toLocaleString('pt-BR')}</span>
                </div>

                {/* RPM AdSense input */}
                <div className="mb-4">
                  <label className="text-[11px] uppercase tracking-wider text-neutral-500 block mb-1.5">
                    Seu RPM médio no AdSense (R$ por 1.000 views)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">R$</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={adsenseRpm}
                      onChange={(e) => setAdsenseRpm(parseFloat(e.target.value) || 0)}
                      className="w-full h-12 pl-9 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xl font-semibold text-white focus:outline-none focus:border-purple-500/40 transition-all tabular-nums"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[5, 8, 10, 15, 20, 30].map(v => (
                      <button key={v} onClick={() => setAdsenseRpm(v)}
                        className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors tabular-nums',
                          adsenseRpm === v
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                            : 'bg-white/[0.03] border-white/[0.05] text-neutral-500 hover:text-white hover:bg-white/[0.06]')}>
                        R${v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resultado lado a lado */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className={cn(
                    'rounded-lg p-3 border text-center',
                    finalCredit >= adsenseRevenue
                      ? 'bg-emerald-500/[0.08] border-emerald-500/30'
                      : 'bg-white/[0.02] border-white/[0.06]'
                  )}>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Venda Direta</div>
                    <div className={cn('text-lg font-bold font-mono tabular-nums', finalCredit >= adsenseRevenue ? 'text-emerald-400' : 'text-white')}>
                      {fmtBRL(finalCredit)}
                    </div>
                    {finalCredit >= adsenseRevenue && (
                      <div className="text-[10px] text-emerald-500 mt-1 font-medium">MELHOR OPÇÃO</div>
                    )}
                  </div>
                  <div className={cn(
                    'rounded-lg p-3 border text-center',
                    adsenseRevenue > finalCredit
                      ? 'bg-emerald-500/[0.08] border-emerald-500/30'
                      : 'bg-white/[0.02] border-white/[0.06]'
                  )}>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">AdSense</div>
                    <div className={cn('text-lg font-bold font-mono tabular-nums', adsenseRevenue > finalCredit ? 'text-emerald-400' : 'text-white')}>
                      {fmtBRL(adsenseRevenue)}
                    </div>
                    {adsenseRevenue > finalCredit && (
                      <div className="text-[10px] text-emerald-500 mt-1 font-medium">MELHOR OPÇÃO</div>
                    )}
                  </div>
                </div>

                {/* Uplift / diferença */}
                <div className={cn(
                  'rounded-lg p-3 border flex items-center justify-between',
                  adsenseDiff > 0 ? 'bg-emerald-500/[0.05] border-emerald-500/20' :
                  adsenseDiff < 0 ? 'bg-red-500/[0.05] border-red-500/20' :
                  'bg-white/[0.02] border-white/[0.06]'
                )}>
                  <div className="text-sm text-neutral-300">
                    {adsenseDiff > 0
                      ? 'Venda direta rende mais'
                      : adsenseDiff < 0
                      ? 'AdSense rende mais'
                      : 'Resultado equivalente'}
                  </div>
                  <div className="text-right">
                    <div className={cn('text-base font-bold font-mono tabular-nums',
                      adsenseDiff > 0 ? 'text-emerald-400' : adsenseDiff < 0 ? 'text-red-400' : 'text-neutral-400')}>
                      {adsenseDiff > 0 ? '+' : ''}{fmtBRL(adsenseDiff)}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {adsenseDiff > 0 ? '+' : ''}{adsenseUpliftPct.toFixed(1)}% · {adsenseMultiplier.toFixed(2)}×
                    </div>
                  </div>
                </div>

                {/* Recomendação contextual */}
                <div className="mt-3 text-[11px] leading-relaxed text-neutral-500 bg-white/[0.02] rounded-md p-2.5 border border-white/[0.04]">
                  {adsenseUpliftPct >= 50
                    ? '✦ Venda direta justifica claramente o esforço comercial (+50% de ganho).'
                    : adsenseUpliftPct >= 10
                    ? '◈ Vale combinar venda direta com AdSense. Diferença moderada.'
                    : adsenseUpliftPct >= -10
                    ? '◇ Resultado praticamente equivalente. AdSense pode ser mais eficiente sem custo comercial.'
                    : '▲ AdSense supera a venda direta neste cenário. Revise a estrutura de custos.'}
                </div>
              </Card>
            </div>
          </div>

          {/* Cenários (se houver) */}
          {scenarios.length > 0 && (
            <Card className="mt-6 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Comparador</div>
                  <h2 className="text-base font-semibold text-white">Simulador de Múltiplos Cenários</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setScenarios([])}>
                  Limpar todos
                </Button>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#666" fontSize={11} />
                    <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => fmtBRL(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="bruto" fill="#3b82f6" name="Bruto" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lucro" fill="#10b981" name="Lucro" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {scenarios.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-md bg-white/[0.02] border border-white/[0.05]">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{s.name}</div>
                      <div className="text-[11px] text-neutral-500 tabular-nums">
                        {fmtBRL(s.grossRevenue)} → {fmtBRL(s.finalProfit)} ({s.finalMargin.toFixed(1)}%)
                      </div>
                    </div>
                    <button onClick={() => removeScenario(s.id)} className="text-neutral-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-white/[0.05] flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs text-neutral-500">
            <div>
              YouTube Ad Revenue Calculator · Arquitetura modular · Hooks reutilizáveis · Lógica financeira pura
            </div>
            <div className="flex items-center gap-4">
              <span className="tabular-nums">{categories.length} categorias</span>
              <span className="tabular-nums">{history.length} no histórico</span>
              <span className="tabular-nums">{Object.keys(presets).length} presets</span>
            </div>
          </footer>
        </main>
      </div>

      {/* ============== MODAIS ============== */}

      <Modal open={showPresetsModal} onClose={() => setShowPresetsModal(false)} title="Presets de Modelo" maxWidth="max-w-2xl">
        <div className="space-y-2">
          {Object.values(presets).map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white">{p.name}</span>
                  {p.locked && <Lock size={11} className="text-neutral-500" />}
                </div>
                <div className="text-[11px] text-neutral-500">{p.description} · {p.categories.length} categorias</div>
              </div>
              <div className="flex gap-2">
                <Button variant="subtle" size="sm" onClick={() => loadPreset(p)}>Carregar</Button>
                {!p.locked && (
                  <Button variant="danger" size="icon" onClick={() => deletePreset(p.id)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={showSavePresetModal} onClose={() => setShowSavePresetModal(false)} title="Salvar como preset">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">Nome do preset</label>
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Ex.: Modelo Black Friday"
              autoFocus
            />
          </div>
          <div className="text-[11px] text-neutral-500">
            Salvará {categories.length} categorias com os percentuais e valores atuais.
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowSavePresetModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveAsPreset} disabled={!newPresetName.trim()}>
              <Save size={14} /> Salvar preset
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Histórico de Cálculos" maxWidth="max-w-2xl">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {history.length === 0 && (
            <div className="text-center py-12 text-sm text-neutral-500">Nenhum cálculo salvo ainda.</div>
          )}
          {history.map(h => (
            <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">{h.name}</div>
                <div className="text-[11px] text-neutral-500 tabular-nums">
                  {new Date(h.timestamp).toLocaleString('pt-BR')} · {fmtBRL(h.grossRevenue)} → {fmtBRL(h.finalProfit)} ({h.finalMargin.toFixed(1)}%)
                </div>
              </div>
              <Button variant="subtle" size="sm" onClick={() => loadFromHistory(h)}>Carregar</Button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={showCompareModal} onClose={() => setShowCompareModal(false)} title="Gerenciar Cenários" maxWidth="max-w-xl">
        <div className="space-y-3">
          <Button variant="primary" onClick={() => { duplicateAsScenario(); }}>
            <Copy size={14} /> Duplicar campanha atual como cenário
          </Button>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {scenarios.length === 0 && (
              <div className="text-center py-8 text-sm text-neutral-500">Nenhum cenário salvo. Duplique a campanha atual para comparar.</div>
            )}
            {scenarios.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{s.name}</div>
                  <div className="text-[11px] text-neutral-500 tabular-nums">
                    {fmtBRL(s.grossRevenue)} → {fmtBRL(s.finalProfit)} ({s.finalMargin.toFixed(1)}%)
                  </div>
                </div>
                <button onClick={() => removeScenario(s.id)} className="text-neutral-600 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={showArchitectureModal} onClose={() => setShowArchitectureModal(false)} title="Arquitetura & Roadmap SaaS" maxWidth="max-w-3xl">
        <div className="space-y-5 text-sm text-neutral-300 max-h-[70vh] overflow-y-auto">
          <section>
            <h4 className="text-white font-semibold mb-2 text-xs uppercase tracking-wider text-neutral-500">📁 Estrutura de pastas (Next.js)</h4>
            <pre className="text-[11px] bg-black/40 rounded-md p-3 overflow-x-auto font-mono text-neutral-400 leading-relaxed">{`src/
├── app/
│   ├── (auth)/ login/ signup/
│   ├── (dashboard)/
│   │   ├── calculator/
│   │   ├── campaigns/
│   │   ├── presets/
│   │   ├── reports/
│   │   └── settings/
│   ├── api/ trpc/ webhooks/
│   └── layout.tsx
├── components/
│   ├── ui/         (shadcn/ui)
│   ├── calculator/ (CategoryRow, KPI, Charts)
│   ├── charts/
│   └── layout/
├── lib/
│   ├── calc/       (calculateBreakdown, insights — pure funcs)
│   ├── exporters/  (pdf, xlsx)
│   ├── presets/
│   └── db/         (Drizzle/Prisma schemas)
├── hooks/
│   ├── useCalculator.ts
│   ├── useStoredState.ts
│   └── useExport.ts
├── types/
└── server/         (tRPC routers, auth)`}</pre>
          </section>

          <section>
            <h4 className="text-white font-semibold mb-2 text-xs uppercase tracking-wider text-neutral-500">🗄️ Banco de dados sugerido</h4>
            <div className="space-y-2 text-xs">
              <div className="bg-white/[0.02] rounded-md p-3 border border-white/[0.05]">
                <strong className="text-white">PostgreSQL (Supabase ou Neon)</strong> com Drizzle ORM para tipagem ponta-a-ponta.
                <br />Tabelas: <code className="text-amber-400">users, organizations, campaigns, categories, presets, history, scenarios, audit_log</code>
              </div>
              <div className="bg-white/[0.02] rounded-md p-3 border border-white/[0.05]">
                <strong className="text-white">Redis (Upstash)</strong> para cache de cálculos pesados e rate-limiting.
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-white font-semibold mb-2 text-xs uppercase tracking-wider text-neutral-500">🔐 Autenticação</h4>
            <p className="text-xs leading-relaxed">
              <strong className="text-white">Auth.js (NextAuth v5)</strong> com providers Google/Microsoft + magic link. Sessões via JWT + refresh tokens. Para SaaS B2B: SSO via SAML (WorkOS).
            </p>
          </section>

          <section>
            <h4 className="text-white font-semibold mb-2 text-xs uppercase tracking-wider text-neutral-500">🏢 Multi-tenant SaaS</h4>
            <p className="text-xs leading-relaxed mb-2">
              Modelo <strong className="text-white">organization-based</strong>: cada usuário pertence a uma ou mais organizações. Row Level Security (RLS) no Postgres garante isolamento. Stripe Billing para assinaturas (Free / Pro / Enterprise).
            </p>
          </section>

          <section>
            <h4 className="text-white font-semibold mb-2 text-xs uppercase tracking-wider text-neutral-500">👤 Permissões (RBAC)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="bg-purple-500/[0.05] border border-purple-500/20 rounded-md p-3">
                <strong className="text-purple-300">Admin</strong>
                <ul className="text-[11px] text-neutral-400 mt-1 space-y-0.5">
                  <li>• CRUD presets globais</li>
                  <li>• Gerencia membros</li>
                  <li>• Billing</li>
                  <li>• Audit log</li>
                </ul>
              </div>
              <div className="bg-blue-500/[0.05] border border-blue-500/20 rounded-md p-3">
                <strong className="text-blue-300">Financeiro</strong>
                <ul className="text-[11px] text-neutral-400 mt-1 space-y-0.5">
                  <li>• Vê todos os cálculos</li>
                  <li>• Edita custos/impostos</li>
                  <li>• Exporta relatórios</li>
                </ul>
              </div>
              <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-md p-3">
                <strong className="text-emerald-300">Vendedor</strong>
                <ul className="text-[11px] text-neutral-400 mt-1 space-y-0.5">
                  <li>• Cria campanhas</li>
                  <li>• Vê suas comissões</li>
                  <li>• Usa presets</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-white font-semibold mb-2 text-xs uppercase tracking-wider text-neutral-500">⚡ Stack recomendada</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              {[
                ['Next.js 15', 'App Router + RSC'],
                ['TypeScript', 'Tipagem estrita'],
                ['Tailwind v4', 'CSS utilitário'],
                ['shadcn/ui', 'Componentes'],
                ['Recharts', 'Gráficos'],
                ['Framer Motion', 'Animações'],
                ['tRPC', 'API tipada'],
                ['Drizzle ORM', 'SQL tipado'],
                ['PostgreSQL', 'Banco principal'],
                ['Redis (Upstash)', 'Cache'],
                ['Auth.js v5', 'Autenticação'],
                ['Stripe', 'Billing']
              ].map(([t, s]) => (
                <div key={t} className="bg-white/[0.02] rounded-md p-2 border border-white/[0.04]">
                  <div className="text-white font-medium">{t}</div>
                  <div className="text-neutral-500">{s}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
