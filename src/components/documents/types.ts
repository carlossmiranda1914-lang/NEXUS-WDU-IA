import type { DocumentStatus, DocumentVersionStatus } from '../../modules/documents/document-model.ts';

export type Theme = 'light' | 'dark';

export interface DocumentVersionDto {
  id: string;
  versionNumber: number;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
  status: DocumentVersionStatus;
  createdAt: string;
}

export interface AssociationDto {
  id: string;
  targetDomain: string;
  targetResourceType: string;
  targetResourceId: string;
  purpose: string;
  status: string;
  pinnedVersionId: string | null;
  createdAt: string;
}

export interface RetentionDto {
  id: string;
  policyId: string;
  policyVersion: string;
  jurisdictionProfileId: string;
  category: string;
  purpose: string | null;
  clockTriggerType: string;
  clockTriggerEventAt: string;
  retainUntil: string;
  retentionStatus: string;
  assignedAt: string;
}

export interface HoldDto {
  id: string;
  versionId: string;
  holdType: 'legal' | 'administrative';
  authority: string;
  reason: string;
  effectiveAt: string;
  releasedAt: string | null;
  releaseReason: string | null;
  holdStatus: 'active' | 'released';
}

export interface DocumentCapabilities {
  canOpen: boolean;
  canDownload: boolean;
  canUploadVersion: boolean;
  canPlaceHold: boolean;
  canReleaseHold: boolean;
  canAuthorizeDeletion: boolean;
  canExecuteDeletion: boolean;
}

export interface DocumentDto {
  id: string;
  institutionId: string;
  category: string;
  classification: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  currentVersion: DocumentVersionDto | null;
  versionCount: number;
  associations: AssociationDto[];
  retention: RetentionDto | null;
  activeHolds: HoldDto[];
  capabilities: DocumentCapabilities;
}

export interface ActivityDto {
  id: string;
  occurredAt: string;
  eventType: string;
  title: string;
  description: string;
  actorKind: 'person' | 'system';
  actorName: string | null;
}

export interface UploadSessionDto {
  id: string;
  documentId: string;
  targetVersionNumber: number | null;
  declaredFilename: string;
  declaredMimeType: string;
  declaredByteSize: number;
  status: string;
  authorizedUntil: string;
  expiresAt: string;
  createdAt: string;
}

export interface DocumentListFilterState {
  search: string;
  category: string;
  technicalStatus: string;
  retentionStatus: string;
  holdStatus: 'all' | 'active' | 'released' | 'none';
  associationDomain: string;
  updatedFrom: string;
  updatedTo: string;
  page: number;
  limit: number;
}

export interface DocumentListResponse {
  items: DocumentDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export type DetailDrawerTab = 'info' | 'versions' | 'associations' | 'activity';
