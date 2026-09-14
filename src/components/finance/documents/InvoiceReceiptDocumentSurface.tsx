import React from 'react';
import { Money } from '../../../modules/finance/money.ts';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';

type Amount = Readonly<{ amount: string; currency: string }>;
export type InvoiceReceiptDocumentSurfaceModel = Readonly<{
  issuer: { legalName: string; taxIdentifier: string | null; address: string | null } | null;
  recipient: { name: string; taxIdentifier: string | null; address: string | null } | null;
  payer: string | null;
  obligation: { reference: string; dueAt: string | null };
  lines: readonly { description: string; quantity: string; unitPrice: string; discount: string; totalAmount: string; currency: string }[];
  totals: { documentTotal: string; currency: string };
  payment: { reference: string; date: string; amount: string; currency: string };
  allocations: readonly { before: Amount; movement: Amount; after: Amount }[];
  unallocated: Amount | null;
}>;

const display = (value: Amount) => formatFinanceMoney(value);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('pt-PT') : 'Não disponível';
const aggregate = (allocations: readonly { movement: Amount }[], currency: string) => {
  try { return allocations.reduce((total, allocation) => total.add(Money.parse(allocation.movement.amount, allocation.movement.currency)), Money.parse('0', currency)).serialize(); } catch { return null; }
};

/** One non-official Factura-Recibo preview. Readiness deliberately stays outside this factual body. */
export function InvoiceReceiptDocumentSurface({ model }: { model: InvoiceReceiptDocumentSurfaceModel }) {
  const applied = aggregate(model.allocations, model.payment.currency);
  return <article data-testid="invoice-receipt-document-surface" className="mx-auto w-full max-w-5xl rounded-sm border border-zinc-300 bg-white p-6 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 sm:p-9">
    <header className="grid gap-6 border-b border-zinc-300 pb-6 sm:grid-cols-2 dark:border-zinc-700"><section><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Emitente</p><h2 className="mt-2 text-lg font-bold">{model.issuer?.legalName ?? 'Dados do emitente incompletos'}</h2>{model.issuer?.taxIdentifier && <p className="text-sm">NIF: {model.issuer.taxIdentifier}</p>}{model.issuer?.address && <p className="text-sm text-zinc-600 dark:text-zinc-300">{model.issuer.address}</p>}</section><section className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pré-visualização — ainda não emitida</p><h1 className="mt-2 text-2xl font-bold">Factura-Recibo</h1><p className="mt-2 text-sm">Vencimento da obrigação: {date(model.obligation.dueAt)}</p></section></header>
    <section className="border-b border-zinc-300 py-5 dark:border-zinc-700"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Destinatário</p><p className="mt-2 font-semibold">{model.recipient?.name ?? 'Dados do destinatário incompletos'}</p>{model.recipient?.taxIdentifier && <p className="text-sm">NIF: {model.recipient.taxIdentifier}</p>}</section>
    <section className="border-b border-zinc-300 py-5 dark:border-zinc-700"><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fatura</h3><p className="mt-2 text-sm">Referência da obrigação: <span className="font-semibold">{model.obligation.reference}</span></p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-y border-zinc-300 text-xs uppercase text-zinc-500 dark:border-zinc-700"><th className="py-2">Descrição</th><th className="py-2 text-right">Qtd.</th><th className="py-2 text-right">Unitário</th><th className="py-2 text-right">Desconto</th><th className="py-2 text-right">Total</th></tr></thead><tbody>{model.lines.map((line, index) => <tr key={`${line.description}-${index}`} className="border-b border-zinc-200 dark:border-zinc-800"><td className="py-2">{line.description}</td><td className="py-2 text-right">{line.quantity}</td><td className="py-2 text-right">{display({ amount: line.unitPrice, currency: line.currency })}</td><td className="py-2 text-right">{display({ amount: line.discount, currency: line.currency })}</td><td className="py-2 text-right font-semibold">{display({ amount: line.totalAmount, currency: line.currency })}</td></tr>)}</tbody></table></div><p className="mt-3 text-right text-base font-bold">Total comercial: {display({ amount: model.totals.documentTotal, currency: model.totals.currency })}</p></section>
    <section className="py-5"><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recebimento</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-zinc-500">Pagador</dt><dd className="font-semibold">{model.payer ?? 'Não identificado'}</dd></div><div><dt className="text-zinc-500">Pagamento</dt><dd className="font-semibold">{model.payment.reference}</dd><dd>{date(model.payment.date)}</dd></div><div><dt className="text-zinc-500">Montante recebido</dt><dd className="text-base font-bold">{display({ amount: model.payment.amount, currency: model.payment.currency })}</dd></div></dl>{model.allocations.map((allocation, index) => <dl key={index} className="mt-3 grid gap-2 rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800 sm:grid-cols-3"><div><dt className="text-zinc-500">Antes</dt><dd>{display(allocation.before)}</dd></div><div><dt className="text-zinc-500">Valor aplicado</dt><dd className="font-semibold">{display(allocation.movement)}</dd></div><div><dt className="text-zinc-500">Após</dt><dd>{display(allocation.after)}</dd></div></dl>)}<dl className="mt-4 grid gap-3 border-t border-zinc-300 pt-4 text-sm dark:border-zinc-700 sm:grid-cols-2"><div><dt className="text-zinc-500">Total aplicado</dt><dd className="text-base font-bold">{applied ? display(applied) : 'Não agregado — moedas diferentes'}</dd></div><div><dt className="text-zinc-500">Valor não aplicado</dt><dd className="text-base font-bold">{model.unallocated ? display(model.unallocated) : 'Não aplicável'}</dd></div></dl></section>
  </article>;
}
