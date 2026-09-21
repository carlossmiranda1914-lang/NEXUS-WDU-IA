import React from 'react';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';

export type InvoiceDocumentSurfaceModel = Readonly<{
  mode: 'preview' | 'issued';
  status: string;
  seriesNumber: string;
  issueDate: string | null;
  dueDate: string | null;
  issuer: { legalName: string; taxIdentifier: string | null; address: string | null } | null;
  recipient: { name: string; taxIdentifier: string | null; address: string | null } | null;
  reference: string | null;
  lines: readonly Readonly<{ description: string; quantity: string; unitPrice: string; discount: string; tax: string | null; totalAmount: string; currency: string }>[];
  totals: { subtotal: string | null; discountTotal: string | null; taxTotal: string | null; documentTotal: string; currency: string } | null;
  taxTreatment: string | null;
  legalMentions: readonly string[];
}>;

const date = (value: string | null) => value ? new Date(value).toLocaleDateString('pt-PT') : 'Ainda não emitida';
const amount = (value: string | null, currency: string) => value === null ? 'Por determinar' : formatFinanceMoney({ amount: value, currency });

/** Shared document hierarchy for the non-official preview and immutable issued invoice detail. */
export function InvoiceDocumentSurface({ model }: { model: InvoiceDocumentSurfaceModel }) {
  const currency = model.totals?.currency ?? model.lines[0]?.currency ?? 'AOA';
  return <article data-testid="invoice-document-surface" className="mx-auto w-full max-w-5xl rounded-sm border border-zinc-300 bg-white p-6 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 sm:p-9">
    <header className="grid gap-6 border-b border-zinc-300 pb-6 sm:grid-cols-2 dark:border-zinc-700">
      <section><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Emitente</p>{model.issuer ? <><h3 className="mt-2 text-lg font-bold">{model.issuer.legalName}</h3>{model.issuer.taxIdentifier && <p className="text-sm">NIF: {model.issuer.taxIdentifier}</p>}{model.issuer.address && <p className="text-sm text-zinc-600 dark:text-zinc-300">{model.issuer.address}</p>}</> : <p className="mt-2 text-sm font-medium">Dados do emitente ainda incompletos</p>}</section>
      <section className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{model.mode === 'preview' ? 'Pré-visualização — ainda não emitida' : model.status}</p><h2 className="mt-2 text-2xl font-bold">Fatura</h2><dl className="mt-2 space-y-1 text-sm"><div><dt className="inline text-zinc-500">Série / número: </dt><dd className="inline font-semibold">{model.seriesNumber}</dd></div><div><dt className="inline text-zinc-500">Emissão: </dt><dd className="inline">{date(model.issueDate)}</dd></div><div><dt className="inline text-zinc-500">Vencimento: </dt><dd className="inline">{date(model.dueDate)}</dd></div></dl></section>
    </header>
    <section className="border-b border-zinc-300 py-5 dark:border-zinc-700"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Destinatário</p>{model.recipient ? <><p className="mt-2 font-semibold">{model.recipient.name}</p>{model.recipient.taxIdentifier && <p className="text-sm">NIF: {model.recipient.taxIdentifier}</p>}{model.recipient.address && <p className="text-sm text-zinc-600 dark:text-zinc-300">{model.recipient.address}</p>}</> : <p className="mt-2 text-sm font-medium">Dados do destinatário ainda incompletos</p>}</section>
    <section className="py-5"><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Linhas</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-zinc-300 text-xs uppercase text-zinc-500 dark:border-zinc-700"><tr><th className="py-3 pr-3">Descrição</th><th className="py-3 pr-3 text-right">Qtd.</th><th className="py-3 pr-3 text-right">Unitário</th><th className="py-3 pr-3 text-right">Desc.</th><th className="py-3 pr-3 text-right">Imposto</th><th className="py-3 text-right">Total</th></tr></thead><tbody>{model.lines.map((line, index) => <tr key={`${line.description}-${index}`} className="border-b border-zinc-200 dark:border-zinc-800"><td className="py-3 pr-3 font-medium">{line.description}</td><td className="py-3 pr-3 text-right">{line.quantity}</td><td className="py-3 pr-3 text-right">{amount(line.unitPrice, line.currency)}</td><td className="py-3 pr-3 text-right">{amount(line.discount, line.currency)}</td><td className="py-3 pr-3 text-right">{amount(line.tax, line.currency)}</td><td className="py-3 text-right font-semibold">{amount(line.totalAmount, line.currency)}</td></tr>)}</tbody></table></div></section>
    <section className="grid gap-6 border-y border-zinc-300 py-5 sm:grid-cols-[1fr_260px] dark:border-zinc-700"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Informação documental</h3>{model.reference && <p className="mt-2 text-sm">Referência da obrigação: <span className="font-medium">{model.reference}</span></p>}{model.taxTreatment && <p className="mt-1 text-sm">Tratamento fiscal: {model.taxTreatment}</p>}{model.legalMentions.map(mention => <p key={mention} className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{mention}</p>)}</div><dl className="space-y-2 text-sm"><div className="flex justify-between gap-4"><dt>Subtotal</dt><dd>{amount(model.totals?.subtotal ?? null, currency)}</dd></div><div className="flex justify-between gap-4"><dt>Desconto</dt><dd>{amount(model.totals?.discountTotal ?? null, currency)}</dd></div><div className="flex justify-between gap-4"><dt>Imposto</dt><dd>{amount(model.totals?.taxTotal ?? null, currency)}</dd></div><div className="flex justify-between gap-4 border-t border-zinc-300 pt-2 text-base font-bold dark:border-zinc-700"><dt>Total</dt><dd>{model.totals ? amount(model.totals.documentTotal, currency) : 'Por determinar'}</dd></div></dl></section>
  </article>;
}
