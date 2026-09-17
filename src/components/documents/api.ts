import { auth } from '../../lib/firebase.ts';
import type {
  DocumentDto,
  DocumentListFilterState,
  DocumentListResponse,
  ActivityDto,
  UploadSessionDto,
  DocumentVersionDto,
  HoldDto,
  DocumentTaxonomyDto,
} from './types.ts';

export type { DocumentTaxonomyDto };

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Inicie sessão para aceder ao arquivo documental.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function generateIdempotencyKey(prefix = 'idem'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function fetchDocuments(
  filters: Partial<DocumentListFilterState>,
  signal?: AbortSignal,
): Promise<DocumentListResponse> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();

  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.category?.trim() && filters.category !== 'all') query.set('category', filters.category.trim());
  if (filters.technicalStatus?.trim() && filters.technicalStatus !== 'all') query.set('technicalStatus', filters.technicalStatus.trim());
  if (filters.retentionStatus?.trim() && filters.retentionStatus !== 'all') query.set('retentionStatus', filters.retentionStatus.trim());
  if (filters.holdStatus && filters.holdStatus !== 'all') query.set('holdStatus', filters.holdStatus);
  if (filters.associationDomain?.trim() && filters.associationDomain !== 'all') query.set('associationDomain', filters.associationDomain.trim());
  if (filters.updatedFrom) query.set('updatedFrom', filters.updatedFrom);
  if (filters.updatedTo) query.set('updatedTo', filters.updatedTo);

  const res = await fetch(`/api/documents?${query.toString()}`, {
    method: 'GET',
    headers,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível listar os documentos.');
  }
  return data as DocumentListResponse;
}

export async function fetchDocumentDetail(
  documentId: string,
  signal?: AbortSignal,
): Promise<DocumentDto> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}`, {
    method: 'GET',
    headers,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Documento não encontrado.');
  }
  return data as DocumentDto;
}

export async function fetchDocumentActivity(
  documentId: string,
  signal?: AbortSignal,
): Promise<ActivityDto[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/activity`, {
    method: 'GET',
    headers,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível obter o histórico de atividade.');
  }
  return Array.isArray(data.items) ? data.items : [];
}


export async function fetchDocumentTaxonomy(signal?: AbortSignal): Promise<DocumentTaxonomyDto> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/documents/metadata', {
    method: 'GET',
    headers,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível obter a taxonomia documental.');
  }
  return data as DocumentTaxonomyDto;
}

export async function fetchDocumentVersions(
  documentId: string,
  signal?: AbortSignal,
): Promise<DocumentVersionDto[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/versions`, {
    method: 'GET',
    headers,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível obter o histórico de versões.');
  }
  return Array.isArray(data.items) ? data.items : [];
}

export interface CreateUploadSessionInput {
  documentId?: string;
  category?: string;
  classification?: string | null;
  declaredFilename: string;
  declaredMimeType: string;
  declaredByteSize: number;
  targetVersionNumber?: number;
}

export interface CreateUploadSessionResponse {
  documentId: string;
  sessionId: string;
  session: UploadSessionDto;
  rawToken: string;
  effectiveLimit: { maxByteSize: number };
  replayed: boolean;
}

export async function createUploadSession(
  input: CreateUploadSessionInput,
  idempotencyKey: string,
): Promise<CreateUploadSessionResponse> {
  const headers = await getAuthHeaders();
  const endpoint = input.documentId
    ? `/api/documents/${input.documentId}/versions/upload-sessions`
    : '/api/documents/upload-sessions';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível autorizar a sessão de upload.');
  }
  return data as CreateUploadSessionResponse;
}

/**
 * Perform canonical byte transfer to the authorized storage provider or bridge.
 * If transport bridge endpoint is missing, reports UPLOAD_TRANSPORT_API_GAP error.
 */
export async function transferSessionBytes(
  sessionId: string,
  rawToken: string,
  file: File,
  signal?: AbortSignal,
  onProgress?: (bytesUploaded: number, totalBytes: number) => void,
): Promise<void> {
  const headers = await getAuthHeaders();

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/documents/upload-sessions/${sessionId}/transfer`, true);
    xhr.setRequestHeader('Authorization', headers.Authorization);
    xhr.setRequestHeader('X-Upload-Token', rawToken);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Transferência cancelada.'));
      });
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else if (xhr.status === 404 || xhr.status === 405) {
        // Transport bridge endpoint is not exposed on this server version
        reject(
          new Error(
            'UPLOAD_TRANSPORT_API_GAP: O endpoint HTTP de transferência direta de bytes para a sessão de upload não está exposto na API I8A.',
          ),
        );
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body.error || `Falha na transferência de bytes (${xhr.status}).`));
        } catch {
          reject(new Error(`Falha na transferência de bytes (${xhr.status}).`));
        }
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          'UPLOAD_TRANSPORT_API_GAP: Não foi possível estabelecer ligação ao endpoint de transporte de bytes.',
        ),
      );
    };

    xhr.send(file);
  });
}

export interface CompleteUploadSessionResponse {
  success: boolean;
  versionId: string;
  version: DocumentVersionDto;
  session: UploadSessionDto;
  replayed: boolean;
}

export async function completeUploadSession(
  sessionId: string,
  rawToken: string,
  idempotencyKey: string,
): Promise<CompleteUploadSessionResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/upload-sessions/${sessionId}/complete`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      rawToken,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível concluir o upload do ficheiro.');
  }
  return data as CompleteUploadSessionResponse;
}

export interface AuthorizeAccessResponse {
  grantId: string;
  rawAccessToken: string;
  expiresInSeconds: number;
  expiresAt: string;
  action: 'open' | 'download';
  replayed: boolean;
}

export async function authorizeAccess(
  documentId: string,
  versionId: string | undefined,
  action: 'open' | 'download',
  idempotencyKey: string,
): Promise<AuthorizeAccessResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/access`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      versionId,
      action,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível autorizar o acesso seguro ao documento.');
  }
  return data as AuthorizeAccessResponse;
}

export async function exchangeAccessForBlob(
  rawAccessToken: string,
  displayFilename?: string,
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/documents/access/exchange', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawAccessToken,
      displayFilename,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Não foi possível descarregar o fluxo seguro do documento.');
  }

  const mimeType = res.headers.get('Content-Type') || 'application/octet-stream';
  const disposition = res.headers.get('Content-Disposition') || '';
  let filename = displayFilename || 'documento';
  const match = disposition.match(/filename="?([^"]+)"?/);
  if (match && match[1]) {
    filename = match[1];
  }

  const blob = await res.blob();
  return { blob, mimeType, filename };
}

export async function revokeAccess(
  grantId: string,
  reason: string,
  idempotencyKey: string,
): Promise<{ success: boolean; grantId: string; status: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/access/${grantId}/revoke`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      reason,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível revogar a autorização de acesso.');
  }
  return data;
}

export async function placeHold(
  documentId: string,
  versionId: string | undefined,
  holdType: 'legal' | 'administrative',
  authority: string,
  reason: string,
  idempotencyKey: string,
): Promise<{ success: boolean; hold: HoldDto; replayed: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/holds`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      versionId,
      holdType,
      authority,
      reason,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível aplicar o bloqueio de retenção.');
  }
  return data;
}

export async function releaseHold(
  documentId: string,
  holdId: string,
  versionId: string | undefined,
  releaseReason: string,
  idempotencyKey: string,
): Promise<{ success: boolean; hold: HoldDto; replayed: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/holds/${holdId}/release`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      versionId,
      releaseReason,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível libertar o bloqueio de retenção.');
  }
  return data;
}

export async function authorizeDeletion(
  documentId: string,
  versionId: string | undefined,
  idempotencyKey: string,
): Promise<{ success: boolean; authorizationId: string; authorizationStatus: string; policyBasis: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/deletion/authorize`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      versionId,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível autorizar a eliminação governada.');
  }
  return data;
}

export async function executeDeletion(
  documentId: string,
  deletionAuthorizationId: string,
  idempotencyKey: string,
): Promise<{ success: boolean; reconciliationRequired: boolean; deletionRecord: unknown; replayed: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/deletion/execute`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      deletionAuthorizationId,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível executar a eliminação governada.');
  }
  return data;
}

export async function reconcileDeletion(
  documentId: string,
  deletionAuthorizationId: string,
): Promise<{ success: boolean; reconciliationRequired: boolean; deletionRecord: unknown }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/deletion/reconcile`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deletionAuthorizationId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível reconciliar o estado de eliminação.');
  }
  return data;
}

export interface AssociationTargetItem {
  id: string;
  name: string;
  domain: string;
  resourceType: string;
  detail?: string;
}

export async function searchAssociationTargets(
  domain: string,
  query = '',
  signal?: AbortSignal,
): Promise<AssociationTargetItem[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ domain, q: query });
  const res = await fetch(`/api/documents/association-targets/search?${params.toString()}`, {
    method: 'GET',
    headers,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível pesquisar entidades para associação.');
  }
  return Array.isArray(data.targets) ? data.targets : [];
}

export async function createDocumentAssociation(
  documentId: string,
  params: {
    targetDomain: string;
    targetResourceType: string;
    targetResourceId: string;
    purpose: string;
    pinnedVersionId?: string | null;
  },
  idempotencyKey: string,
): Promise<{ success: boolean; association: unknown; replayed: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/associations`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...params,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível associar o documento.');
  }
  return data;
}

export async function deleteDocumentAssociation(
  documentId: string,
  associationId: string,
  idempotencyKey: string,
  reason?: string,
): Promise<{ success: boolean; association: unknown; replayed: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/documents/${documentId}/associations/${associationId}`, {
    method: 'DELETE',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      reason,
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível retirar a associação.');
  }
  return data;
}
