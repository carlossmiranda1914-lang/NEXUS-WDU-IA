import type { CanonicalFinancialDocumentPresentation } from './financial-document-presentation.ts';
import { formatFinanceMoney } from './money-presentation.ts';

export type FinancialDocumentRenderInput = Readonly<{ presentation: CanonicalFinancialDocumentPresentation }>;
const pdfText = (value: unknown) => String(value ?? '').replace(/[\\()]/g, '\\$&');
const money = (amount: string | null, currency: string) => amount === null ? '—' : formatFinanceMoney({ amount, currency });

/** Renders the immutable canonical presentation as a single A4 document. */
export function renderFinancialDocumentPdf(input: FinancialDocumentRenderInput): Buffer {
  const view = input.presentation;
  const c: string[] = ['BT', '/F1 10 Tf'];
  const write = (x: number, y: number, value: unknown, size = 10) => c.push(`/F1 ${size} Tf`, `1 0 0 1 ${x} ${y} Tm`, `(${pdfText(value)}) Tj`);
  const rule = (x1: number, y1: number, x2: number, y2: number) => c.push('ET', '0.45 w', `${x1} ${y1} m`, `${x2} ${y2} l`, 'S', 'BT');
  const currency = view.totals.currency;
  write(54, 790, view.issuer.legalName, 16);
  if (view.issuer.taxIdentifier) write(54, 772, `NIF: ${view.issuer.taxIdentifier}`);
  view.issuer.addressLines.forEach((line, index) => write(54, 756 - index * 14, line));
  write(385, 790, view.document.typeLabel.toUpperCase(), 18);
  write(385, 770, `Serie / numero: ${view.document.officialNumber}`);
  write(385, 754, `Emissao: ${view.document.issueDate}`);
  if (view.document.dueDate) write(385, 738, `Vencimento: ${view.document.dueDate}`);
  rule(54, 720, 541, 720);
  write(54, 698, 'DESTINATARIO', 11); write(54, 681, view.recipient.name);
  if (view.recipient.taxIdentifier) write(54, 665, `NIF: ${view.recipient.taxIdentifier}`);
  view.recipient.addressLines.forEach((line, index) => write(54, 649 - index * 14, line));
  rule(54, 625, 541, 625);
  write(54, 605, 'LINHAS', 11);
  const columns = [54, 268, 314, 368, 420, 476];
  ['Descricao', 'Qtd.', 'Unitario', 'Desc.', 'Imposto', 'Total'].forEach((label, index) => write(columns[index]!, 588, label, 8));
  rule(54, 582, 541, 582);
  let y = 564;
  for (const line of view.operation.lines) { write(columns[0]!, y, line.description, 9); write(columns[1]!, y, line.quantity, 9); write(columns[2]!, y, money(line.unitPrice, line.currency), 9); write(columns[3]!, y, money(line.discount, line.currency), 9); write(columns[4]!, y, money(line.tax, line.currency), 9); write(columns[5]!, y, money(line.totalAmount, line.currency), 9); y -= 22; }
  if (view.operation.lines.length === 0) write(54, y, 'Sem linhas documentais aplicaveis.', 9);
  rule(54, y - 8, 541, y - 8);
  const totalsY = Math.min(y - 34, 470);
  write(350, totalsY, 'TOTAIS', 11);
  write(350, totalsY - 18, 'Subtotal'); write(476, totalsY - 18, money(view.totals.subtotal, currency));
  write(350, totalsY - 34, 'Desconto'); write(476, totalsY - 34, money(view.totals.discountTotal, currency));
  write(350, totalsY - 50, 'Imposto'); write(476, totalsY - 50, money(view.totals.taxTotal, currency));
  rule(350, totalsY - 58, 541, totalsY - 58);
  write(350, totalsY - 76, 'TOTAL', 12); write(476, totalsY - 76, money(view.totals.documentTotal, currency), 12);
  const infoY = totalsY - 116;
  rule(54, infoY + 18, 541, infoY + 18); write(54, infoY, 'INFORMACAO DOCUMENTAL', 11);
  if (view.operation.reference) write(54, infoY - 18, `Referencia da obrigacao: ${view.operation.reference}`);
  if (view.policy.taxTreatment) write(54, infoY - 34, `Tratamento fiscal: ${view.policy.taxTreatment}`);
  if (view.policy.jurisdictionCode) write(54, infoY - 50, `Jurisdição: ${view.policy.jurisdictionCode}`);
  let mentionY = infoY - 70; for (const mention of view.legalMentions) { write(54, mentionY, mention, 9); mentionY -= 14; }
  rule(54, 54, 541, 54); write(54, 38, 'Documento apresentado a partir do registo documental imutavel.', 8); c.push('ET');
  const content = c.join('\n');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
