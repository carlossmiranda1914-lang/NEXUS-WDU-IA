export type FinancialDocumentRenderInput = {
  documentId: string;
  documentType: string;
  seriesCode: string;
  sequenceNumber: number;
  issuedAt: Date;
  sourceSnapshot: Record<string, unknown>;
  sources: Array<{ type: string; id: string; snapshot: Record<string, unknown> }>;
  correctsDocumentId: string | null;
  renderVersion: string;
  templateVersion: string;
};

const pdfText = (value: unknown) => String(value ?? '').replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');

/** Formats immutable documentary values; it never reads or derives live Finance truth. */
export function renderFinancialDocumentPdf(input: FinancialDocumentRenderInput): Buffer {
  const snapshot = input.sourceSnapshot;
  const lines = [
    'NEXUS EDU IA - OFFICIAL FINANCIAL DOCUMENT',
    `Document: ${input.seriesCode}/${input.sequenceNumber} (${input.documentType})`,
    `Issued: ${input.issuedAt.toISOString()}`,
    `Document id: ${input.documentId}`,
    `Source reference: ${snapshot.paymentReference ?? snapshot.sourceId ?? 'persisted documentary source'}`,
    `Amount: ${snapshot.amount ?? 'not represented in issued snapshot'} ${snapshot.currency ?? ''}`.trim(),
    `Provenance: ${input.sources.map(source => `${source.type}:${source.id}`).join(', ') || 'none'}`,
    `Corrects: ${input.correctsDocumentId ?? 'none'}`,
    `Renderer: ${input.renderVersion}; template: ${input.templateVersion}`,
  ];
  const content = ['BT', '/F1 12 Tf', '54 780 Td', ...lines.flatMap((line, index) => [index === 0 ? `(${pdfText(line)}) Tj` : `0 -22 Td (${pdfText(line)}) Tj`]), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}
