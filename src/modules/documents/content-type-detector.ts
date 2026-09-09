/**
 * Non-Executing, Bounded Content-Type and Container Detector
 * Mission: DOCUMENTS-FOUNDATION-I4
 */

export interface ContentTypeDetectorConfig {
  maxPrefixInspectionBytes: number;
  zipMetadataInspectionLimit: number;
  maxContainerEntryCount: number;
  maxContainerMetadataBytes: number;
}

export interface DetectedContentType {
  mimeType: string;
  canonicalExtension: string;
  isContainer: boolean;
  containerType?: 'opc_docx' | 'opc_xlsx' | 'opc_pptx' | 'plain_zip' | 'corrupted_zip';
  isKnown: boolean;
  details?: Record<string, unknown>;
}

export interface MimeCompatibilityResult {
  isCompatible: boolean;
  isDangerousMismatch: boolean;
  reason?: string;
}

/**
 * Pure deterministic byte inspector for document formats.
 * Non-executing, non-extracting-to-disk, bounded inspection.
 */
export class ContentTypeDetector {
  constructor(private readonly config: ContentTypeDetectorConfig) {}

  public detect(buffer: Buffer): DetectedContentType {
    if (!buffer || buffer.length === 0) {
      return {
        mimeType: 'application/x-empty',
        canonicalExtension: '',
        isContainer: false,
        isKnown: false,
      };
    }

    const inspectionLimit = Math.min(buffer.length, this.config.maxPrefixInspectionBytes);
    const prefix = buffer.subarray(0, inspectionLimit);

    // 1. PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (prefix.length >= 5 && prefix[0] === 0x25 && prefix[1] === 0x50 && prefix[2] === 0x44 && prefix[3] === 0x46 && prefix[4] === 0x2d) {
      return {
        mimeType: 'application/pdf',
        canonicalExtension: '.pdf',
        isContainer: false,
        isKnown: true,
      };
    }

    // 2. PNG: \x89PNG\r\n\x1a\n (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    if (
      prefix.length >= 8 &&
      prefix[0] === 0x89 &&
      prefix[1] === 0x50 &&
      prefix[2] === 0x4e &&
      prefix[3] === 0x47 &&
      prefix[4] === 0x0d &&
      prefix[5] === 0x0a &&
      prefix[6] === 0x1a &&
      prefix[7] === 0x0a
    ) {
      return {
        mimeType: 'image/png',
        canonicalExtension: '.png',
        isContainer: false,
        isKnown: true,
      };
    }

    // 3. JPEG: 0xFF, 0xD8, 0xFF
    if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
      return {
        mimeType: 'image/jpeg',
        canonicalExtension: '.jpg',
        isContainer: false,
        isKnown: true,
      };
    }

    // 4. ZIP / OpenXML Container: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
    if (prefix.length >= 4 && prefix[0] === 0x50 && prefix[1] === 0x4b && prefix[2] === 0x03 && prefix[3] === 0x04) {
      return this.inspectZipContainer(buffer);
    }

    // 5. Plain text heuristic (UTF-8 / ASCII printable without control chars except tab/cr/lf)
    let isAsciiText = true;
    for (let i = 0; i < prefix.length; i++) {
      const b = prefix[i];
      if (b === 0x00 || (b < 0x09 && b !== 0x00) || (b > 0x0a && b < 0x0d) || (b > 0x0d && b < 0x20)) {
        isAsciiText = false;
        break;
      }
    }
    if (isAsciiText && prefix.length > 0) {
      return {
        mimeType: 'text/plain',
        canonicalExtension: '.txt',
        isContainer: false,
        isKnown: true,
      };
    }

    return {
      mimeType: 'application/octet-stream',
      canonicalExtension: '.bin',
      isContainer: false,
      isKnown: false,
    };
  }

  /**
   * Bounded non-executing inspection of ZIP local file headers and central directory.
   */
  private inspectZipContainer(buffer: Buffer): DetectedContentType {
    if (buffer.length < 30) {
      return {
        mimeType: 'application/x-corrupted-zip',
        canonicalExtension: '.zip',
        isContainer: true,
        containerType: 'corrupted_zip',
        isKnown: false,
        details: { reason: 'Truncated ZIP header (less than 30 bytes)' },
      };
    }

    const entryNames: string[] = [];
    let offset = 0;
    let entryCount = 0;
    let metadataBytesProcessed = 0;
    const maxBytes = Math.min(buffer.length, this.config.zipMetadataInspectionLimit, this.config.maxContainerMetadataBytes);

    try {
      while (offset + 30 <= maxBytes && entryCount < this.config.maxContainerEntryCount) {
        // Check local header signature: PK\x03\x04
        if (
          buffer[offset] !== 0x50 ||
          buffer[offset + 1] !== 0x4b ||
          buffer[offset + 2] !== 0x03 ||
          buffer[offset + 3] !== 0x04
        ) {
          // Stopped encountering local headers (could be central directory PK\x01\x02 or end of entries)
          break;
        }

        const filenameLength = buffer.readUInt16LE(offset + 26);
        const extraFieldLength = buffer.readUInt16LE(offset + 28);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const flags = buffer.readUInt16LE(offset + 6);

        offset += 30;
        metadataBytesProcessed += 30;

        if (offset + filenameLength > buffer.length) {
          // Truncated header
          return {
            mimeType: 'application/x-corrupted-zip',
            canonicalExtension: '.zip',
            isContainer: true,
            containerType: 'corrupted_zip',
            isKnown: false,
            details: { reason: 'Truncated ZIP filename entry' },
          };
        }

        const filename = buffer.toString('utf8', offset, offset + filenameLength);
        entryNames.push(filename);
        entryCount++;

        offset += filenameLength + extraFieldLength;
        metadataBytesProcessed += filenameLength + extraFieldLength;

        // Check if data descriptor flag (bit 3) is set: compressed size in header might be 0
        if ((flags & 0x08) !== 0 && compressedSize === 0) {
          // Bounded scan for next PK\x03\x04 or PK\x01\x02 signature
          let foundNext = false;
          for (let s = offset; s <= maxBytes - 4; s++) {
            if (
              buffer[s] === 0x50 &&
              buffer[s + 1] === 0x4b &&
              ((buffer[s + 2] === 0x03 && buffer[s + 3] === 0x04) ||
                (buffer[s + 2] === 0x01 && buffer[s + 3] === 0x02))
            ) {
              offset = s;
              foundNext = true;
              break;
            }
          }
          if (!foundNext) {
            break;
          }
        } else {
          offset += compressedSize;
        }
      }
    } catch {
      return {
        mimeType: 'application/x-corrupted-zip',
        canonicalExtension: '.zip',
        isContainer: true,
        containerType: 'corrupted_zip',
        isKnown: false,
        details: { reason: 'Malformed ZIP container parsing error' },
      };
    }

    // Also scan buffer within limits for central directory strings if local header parsing was partial
    const bufferSliceString = buffer.subarray(0, maxBytes).toString('utf8');
    const hasContentTypes = entryNames.some((n) => n === '[Content_Types].xml') || bufferSliceString.includes('[Content_Types].xml');
    const hasWord = entryNames.some((n) => n.startsWith('word/')) || bufferSliceString.includes('word/');
    const hasXl = entryNames.some((n) => n.startsWith('xl/')) || bufferSliceString.includes('xl/');
    const hasPpt = entryNames.some((n) => n.startsWith('ppt/')) || bufferSliceString.includes('ppt/');

    if (hasContentTypes && hasWord) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        canonicalExtension: '.docx',
        isContainer: true,
        containerType: 'opc_docx',
        isKnown: true,
        details: { entryCount, opcType: 'wordprocessingml' },
      };
    }

    if (hasContentTypes && hasXl) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        canonicalExtension: '.xlsx',
        isContainer: true,
        containerType: 'opc_xlsx',
        isKnown: true,
        details: { entryCount, opcType: 'spreadsheetml' },
      };
    }

    if (hasContentTypes && hasPpt) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        canonicalExtension: '.pptx',
        isContainer: true,
        containerType: 'opc_pptx',
        isKnown: true,
        details: { entryCount, opcType: 'presentationml' },
      };
    }

    // Plain ZIP
    return {
      mimeType: 'application/zip',
      canonicalExtension: '.zip',
      isContainer: true,
      containerType: 'plain_zip',
      isKnown: true,
      details: { entryCount, entries: entryNames.slice(0, 10) },
    };
  }

  public evaluateCompatibility(
    declaredMimeType: string,
    declaredFilename: string,
    detected: DetectedContentType,
  ): MimeCompatibilityResult {
    const ext = declaredFilename.toLowerCase().split('.').pop() || '';

    // If corrupted container
    if (detected.containerType === 'corrupted_zip') {
      return {
        isCompatible: false,
        isDangerousMismatch: true,
        reason: 'Corrupted or truncated container structure detected',
      };
    }

    // Exact match on MIME
    if (detected.mimeType === declaredMimeType) {
      return { isCompatible: true, isDangerousMismatch: false };
    }

    // Plain zip masquerading as docx/xlsx/pptx
    if (
      (ext === 'docx' || declaredMimeType.includes('wordprocessingml')) &&
      detected.containerType !== 'opc_docx'
    ) {
      return {
        isCompatible: false,
        isDangerousMismatch: true,
        reason: `Declared Word document (.docx) does not contain valid OpenXML OPC structure (detected: ${detected.mimeType})`,
      };
    }

    if (
      (ext === 'xlsx' || declaredMimeType.includes('spreadsheetml')) &&
      detected.containerType !== 'opc_xlsx'
    ) {
      return {
        isCompatible: false,
        isDangerousMismatch: true,
        reason: `Declared Excel spreadsheet (.xlsx) does not contain valid OpenXML OPC structure (detected: ${detected.mimeType})`,
      };
    }

    // PDF mismatch
    if (
      (ext === 'pdf' || declaredMimeType === 'application/pdf') &&
      detected.mimeType !== 'application/pdf'
    ) {
      return {
        isCompatible: false,
        isDangerousMismatch: true,
        reason: `Declared PDF does not match detected content type (${detected.mimeType})`,
      };
    }

    // Image mismatch
    if (declaredMimeType.startsWith('image/') && !detected.mimeType.startsWith('image/')) {
      return {
        isCompatible: false,
        isDangerousMismatch: true,
        reason: `Declared image does not match detected content type (${detected.mimeType})`,
      };
    }

    // Generic unknown/unrecognized
    if (!detected.isKnown) {
      return {
        isCompatible: false,
        isDangerousMismatch: true,
        reason: `Unrecognized or non-standard file signature for declared MIME type ${declaredMimeType}`,
      };
    }

    return {
      isCompatible: false,
      isDangerousMismatch: true,
      reason: `MIME mismatch: declared ${declaredMimeType}, detected ${detected.mimeType}`,
    };
  }
}
