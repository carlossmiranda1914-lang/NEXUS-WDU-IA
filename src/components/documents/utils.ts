import type { DocumentStatus, DocumentVersionStatus } from '../../modules/documents/document-model.ts';
import type { Theme } from './types.ts';

export function formatByteSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—';
  const trimmed = category.trim();
  const lower = trimmed.toLowerCase();
  switch (lower) {
    case 'academic':
    case 'academico':
    case 'académico':
      return 'Académico';
    case 'administrative':
    case 'administrativo':
    case 'administrativos':
      return 'Administrativo';
    case 'administrative_financial':
      return 'Administrativo / Financeiro';
    case 'financial':
    case 'financeiro':
    case 'financeiros':
      return 'Financeiro';
    case 'identity_enrollment':
      return 'Identidade / Matrícula';
    case 'absence_justification':
      return 'Justificação de Faltas';
    case 'identification':
    case 'identificacao':
    case 'identificação':
      return 'Identificação';
    case 'general':
    case 'geral':
      return 'Geral';
    case 'enrollment':
    case 'matricula':
    case 'matrícula':
      return 'Matrícula';
    default:
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/_/g, ' ');
  }
}

export function getClassificationLabel(classification: string | null | undefined): string {
  if (!classification) return '—';
  const trimmed = classification.trim();
  const lower = trimmed.toLowerCase();
  switch (lower) {
    case 'internal':
    case 'uso_interno':
    case 'uso interno':
      return 'Uso interno';
    case 'standard':
    case 'padrao':
    case 'padrão':
      return 'Padrão';
    case 'confidential':
    case 'confidencial':
      return 'Confidencial';
    case 'restricted':
    case 'restrito':
      return 'Restrito';
    case 'public':
    case 'publico':
    case 'público':
      return 'Público';
    default:
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/_/g, ' ');
  }
}

export interface StatusPresentation {
  label: string;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'zinc';
  description: string;
}

export function getTechnicalStatusPresentation(
  status: DocumentVersionStatus | DocumentStatus | string | null | undefined,
): StatusPresentation {
  switch (status) {
    case 'available':
      return {
        label: 'Disponível',
        tone: 'emerald',
        description: 'Documento verificado e disponível com integridade assegurada.',
      };
    case 'content_received':
    case 'pending_verification':
      return {
        label: 'Verificação pendente',
        tone: 'amber',
        description: 'Conteúdo recebido e em processo de validação técnica.',
      };
    case 'quarantined':
      return {
        label: 'Em quarentena',
        tone: 'rose',
        description: 'Documento retido para verificação de segurança adicional.',
      };
    case 'deletion_in_progress':
      return {
        label: 'Eliminação em curso',
        tone: 'amber',
        description: 'Processo de expurgo governado em execução.',
      };
    case 'deleted':
      return {
        label: 'Eliminado',
        tone: 'zinc',
        description: 'Versão eliminada conforme governança institucional.',
      };
    case 'superseded':
      return {
        label: 'Substituído',
        tone: 'zinc',
        description: 'Substituído por uma versão mais recente.',
      };
    case 'withdrawn':
      return {
        label: 'Retirado',
        tone: 'zinc',
        description: 'Documento retirado do circuito ativo.',
      };
    case 'active':
      return {
        label: 'Ativo',
        tone: 'emerald',
        description: 'Documento ativo no arquivo.',
      };
    case 'archived':
      return {
        label: 'Arquivado',
        tone: 'zinc',
        description: 'Documento arquivado permanentemente.',
      };
    case 'restricted':
      return {
        label: 'Restrito',
        tone: 'amber',
        description: 'Documento com restrição de acesso.',
      };
    case 'deprecating':
      return {
        label: 'Em descontinuação',
        tone: 'amber',
        description: 'Documento em fase de expiração ou descontinuação.',
      };
    default:
      return {
        label: status || 'Não iniciado',
        tone: 'zinc',
        description: 'Estado não inicializado.',
      };
  }
}

export function getRetentionStatusPresentation(
  retentionStatus: string | null | undefined,
  retainUntil?: string | null,
): StatusPresentation {
  if (!retentionStatus) {
    return {
      label: 'Sem Política Atribuída',
      tone: 'zinc',
      description: 'Nenhuma regra de retenção automática em vigor.',
    };
  }

  switch (retentionStatus.toLowerCase()) {
    case 'retention_active':
    case 'active':
    case 'in_force':
      return {
        label: retainUntil ? `Retenção até ${formatDate(retainUntil)}` : 'Retenção Ativa',
        tone: 'emerald',
        description: 'Prazo legal de conservação em vigor.',
      };
    case 'retention_expired':
    case 'expired':
      return {
        label: 'Prazo Expirado',
        tone: 'amber',
        description: 'Período legal de retenção concluído. Elegível para revisão ou eliminação.',
      };
    case 'eligible_for_deletion':
      return {
        label: 'Elegível para Eliminação',
        tone: 'amber',
        description: 'Retenção concluída e elegível para autorização de eliminação governada.',
      };
    case 'deletion_authorized':
      return {
        label: 'Eliminação Autorizada',
        tone: 'rose',
        description: 'Eliminação autorizada por custodiante governado.',
      };
    case 'deleted':
    case 'disposed':
      return {
        label: 'Eliminado',
        tone: 'zinc',
        description: 'Conteúdo eliminado com base no calendário de retenção.',
      };
    case 'permanent':
      return {
        label: 'Conservação Permanente',
        tone: 'blue',
        description: 'Documento de arquivo institucional perpétuo.',
      };
    default:
      return {
        label: retentionStatus,
        tone: 'zinc',
        description: 'Estado de retenção atribuído.',
      };
  }
}

export function getBadgeClasses(tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'zinc', theme: Theme): string {
  const isLight = theme === 'light';

  switch (tone) {
    case 'emerald':
      return isLight
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'amber':
      return isLight
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'rose':
      return isLight
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    case 'blue':
      return isLight
        ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case 'zinc':
    default:
      return isLight
        ? 'border-zinc-200 bg-zinc-100 text-zinc-700'
        : 'border-white/10 bg-zinc-800 text-zinc-300';
  }
}

export function getClassificationBadgeClass(classification: string | null | undefined, theme: Theme): string {
  const isLight = theme === 'light';
  const lower = (classification || '').toLowerCase();
  switch (lower) {
    case 'confidential':
    case 'confidencial':
    case 'restricted':
    case 'restrito':
      return isLight
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'public':
    case 'publico':
    case 'público':
      return isLight
        ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    default:
      return isLight
        ? 'border-zinc-200 bg-zinc-100 text-zinc-700'
        : 'border-white/10 bg-zinc-800 text-zinc-300';
  }
}
