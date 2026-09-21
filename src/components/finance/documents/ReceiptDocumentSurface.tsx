import React from 'react';
import { Money } from '../../../modules/finance/money.ts';
import { formatFinanceMoney } from '../../../modules/finance/money-presentation.ts';

type MoneyValue = Readonly<{ amount: string; currency: string }>;

export type ReceiptDocumentSurfaceModel = Readonly<{
  mode: 'preview' | 'issued';
  status: string;
  officialNumber?: string | null;
  payment: { reference: string; date: string; amount: string; currency: string };
  issuer: { legalName: string; taxIdentifier: string | null; address: string | null } | null;
  payer: string | null;
  recipient: string | null;
  settlement: { sourceDocuments: readonly { reference: string }[]; allocations: readonly { before: MoneyValue; movement: MoneyValue; after: MoneyValue }[]; unallocated: MoneyValue | null } | null;
}>;

const date = (value: string) => new Date(value).toLocaleDateString('pt-PT');
const money = (value: MoneyValue) => formatFinanceMoney(value);

/** Presentation aggregation of server-provided allocation facts; cross-currency values are never converted or summed. */
export function aggregateReceiptAllocationMovements(movements: readonly MoneyValue[], expectedCurrency: string): MoneyValue | null {
  try {
    return movements.reduce((total, movement) => total.add(Money.parse(movement.amount, movement.currency)), Money.parse('0', expectedCurrency)).serialize();
  } catch {
    return null;
  }
}

/** Payment and settlement facts only. Issuance readiness stays outside this document surface. */
export function ReceiptDocumentSurface({ model }: { model: ReceiptDocumentSurfaceModel }) {
  const applied = model.settlement ? aggregateReceiptAllocationMovements(model.settlement.allocations.map(allocation => allocation.movement), model.payment.currency) : null;
  return <article data-testid="receipt-document-surface" className="mx-auto w-full max-w-5xl rounded-sm border border-zinc-300 bg-white p-6 text-zinc-900 shadow-sm sm:p-9">
    <header className="grid gap-6 border-b border-zinc-300 pb-6 sm:grid-cols-2">
      <section><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Emitente</p>{model.issuer ? <><h2 className="mt-2 text-lg font-bold">{model.issuer.legalName}</h2>{model.issuer.taxIdentifier && <p className="text-sm">NIF: {model.issuer.taxIdentifier}</p>}{model.issuer.address && <p className="text-sm text-zinc-600">{model.issuer.address}</p>}</> : <p className="mt-2 text-sm font-medium">Dados do emitente ainda incompletos</p>}</section>
      <section className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{model.mode === 'preview' ? 'Pré-visualização — ainda não emitido' : model.status}</p><h1 className="mt-2 text-2xl font-bold">Recibo</h1><dl className="mt-2 space-y-1 text-sm"><div><dt className="inline text-zinc-500">Número do recibo: </dt><dd className="inline font-semibold">{model.mode === 'issued' && model.officialNumber ? model.officialNumber : 'ainda não atribuído'}</dd></div><div><dt className="inline text-zinc-500">Data do pagamento: </dt><dd className="inline">{date(model.payment.date)}</dd></div><div><dt className="inline text-zinc-500">Estado do pagamento: </dt><dd className="inline">{model.status}</dd></div></dl></section>
    </header>
    <section className="grid gap-6 border-b border-zinc-300 py-5 sm:grid-cols-2"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pagador</h3><p className="mt-2 font-semibold">{model.payer ?? 'Ainda não identificado'}</p></div><div><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Destinatário</h3><p className="mt-2 font-semibold">{model.recipient ?? 'Não aplicável ou ainda não identificado'}</p></div></section>
    <section className="border-b border-zinc-300 py-5"><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pagamento recebido</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-zinc-500">Referência</dt><dd className="font-semibold">{model.payment.reference}</dd></div><div><dt className="text-zinc-500">Data</dt><dd>{date(model.payment.date)}</dd></div><div><dt className="text-zinc-500">Montante recebido</dt><dd className="text-base font-bold">{formatFinanceMoney({ amount: model.payment.amount, currency: model.payment.currency })}</dd></div></dl></section>
    <section className="py-5"><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Liquidação e documentos relacionados</h3>{model.settlement ? <><div className="mt-3 space-y-2 text-sm">{model.settlement.sourceDocuments.map(source => <p key={source.reference}>Documento relacionado: <span className="font-medium">{source.reference}</span></p>)}{model.settlement.allocations.map((allocation, index) => <dl key={index} className="grid gap-2 rounded border border-zinc-200 p-3 sm:grid-cols-4"><div><dt className="text-zinc-500">Antes</dt><dd>{money(allocation.before)}</dd></div><div><dt className="text-zinc-500">Valor aplicado</dt><dd className="font-semibold">{money(allocation.movement)}</dd></div><div><dt className="text-zinc-500">Após</dt><dd>{money(allocation.after)}</dd></div><div><dt className="text-zinc-500">Aplicado neste recibo</dt><dd>{money(allocation.movement)}</dd></div></dl>)}</div><dl className="mt-4 grid gap-3 border-t border-zinc-300 pt-4 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Total aplicado</dt><dd className="text-base font-bold">{applied ? money(applied) : 'Não agregado — moedas diferentes'}</dd></div><div><dt className="text-zinc-500">Valor não aplicado</dt><dd className="text-base font-bold">{model.settlement.unallocated ? money(model.settlement.unallocated) : 'Não aplicável'}</dd></div></dl></> : <p className="mt-2 text-sm">Ainda não existem factos de liquidação autorizados para apresentar.</p>}</section>
  </article>;
}
