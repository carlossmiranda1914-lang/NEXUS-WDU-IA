import type { CanonicalFinancialDocumentPresentation } from './financial-document-presentation.ts';
import { formatFinanceMoney } from './money-presentation.ts';

export type FinancialDocumentRenderInput = Readonly<{ presentation: CanonicalFinancialDocumentPresentation }>;
const pdfText = (value: unknown) => String(value ?? '').replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');

/** Renders customer-facing canonical presentation, never source/provenance or storage metadata. */
export function renderFinancialDocumentPdf(input: FinancialDocumentRenderInput): Buffer {
  const view = input.presentation;
  const lines = [view.issuer.legalName, ...(view.issuer.taxIdentifier ? [`NIF: ${view.issuer.taxIdentifier}`] : []), view.document.typeLabel, `Numero: ${view.document.officialNumber}`, `Emitido: ${view.document.issueDate}`, ...(view.document.dueDate ? [`Vencimento: ${view.document.dueDate}`] : []), `Destinatario: ${view.recipient.name}`, ...view.issuer.addressLines, ...(view.operation.reference ? [`Referencia: ${view.operation.reference}`] : []), ...view.operation.lines.flatMap(line => [`Linha: ${line.label}`, `Valor da linha: ${formatFinanceMoney({ amount: line.amount, currency: view.totals.currency })}`]), ...(view.payment ? [`Pagamento: ${view.payment.reference} - ${formatFinanceMoney(view.payment)}`] : []), `Total: ${formatFinanceMoney({ amount: view.totals.documentTotal, currency: view.totals.currency })}`, ...view.legalMentions];
  const content = ['BT', '/F1 12 Tf', '54 780 Td', ...lines.flatMap((line, index) => [index === 0 ? `(${pdfText(line)}) Tj` : `0 -22 Td (${pdfText(line)}) Tj`]), 'ET'].join('\n');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}
