/**
 * QRCodeID - Complete TypeScript library for UUID to QR Code conversion
 * Supports multiple encoding strategies and QR code generation
 * 
 * @author Irfannur Diah (irfnrdh)
 * @version 1.0.0
 */

import { v4 as uuidv4, parse as uuidParse, stringify as uuidStringify } from 'uuid';

// ==================== TYPES & INTERFACES ====================

export interface QRCodeOptions {
  size?: number;
  baseUrl?: string;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  format?: 'png' | 'svg';
  color?: {
    dark?: string;
    light?: string;
  };
}

export interface QRServiceOptions extends Pick<QRCodeOptions, 'size' | 'baseUrl'> {
  service?: 'qr-server' | 'google' | 'qr-code-generator';
}

export interface GeneratedQRIdentifier {
  uuid: string;
  shortCode: string;
  qrCodeDataUrl: string;
  qrCodeUrl: string;
  scanUrl: string;
  createdAt: Date;
}

export interface ParsedQRData {
  shortCode: string;
  uuid: string;
  isUrl: boolean;
  baseUrl?: string;
}

export interface BatchQRResult {
  uuid: string;
  shortCode: string;
  qrCode: string;
  success: boolean;
  error?: string;
}

export interface CodeVariants {
  uuid: string;
  shortCode: string;
  displayCode: string;
  secureCode: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    length: boolean;
    format: boolean;
    checksum?: boolean;
  };
}

export type DatabaseLookupFunction = (code: string) => Promise<string | null> | string | null;

// ==================== CONSTANTS ====================

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHORT_CODE_LENGTH = 22;
const DISPLAY_CODE_LENGTH = 11;
const SECURE_CODE_LENGTH = 12;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Encode buffer to base62 string
 */
function encodeBase62(buffer: Uint8Array): string {
  if (buffer.length === 0) return '';
  
  let num = 0n;
  for (let i = 0; i < buffer.length; i++) {
    num = (num << 8n) + BigInt(buffer[i]);
  }
  
  if (num === 0n) return '0';
  
  let result = '';
  while (num > 0n) {
    const remainder = num % 62n;
    result = BASE62_CHARS[Number(remainder)] + result;
    num = num / 62n;
  }
  
  return result;
}

/**
 * Decode base62 string to buffer
 */
function decodeBase62(str: string, targetLength: number): Uint8Array {
  if (!str) return new Uint8Array(targetLength);
  
  let num = 0n;
  for (const char of str) {
    const val = BASE62_CHARS.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid base62 character: ${char}`);
    }
    num = num * 62n + BigInt(val);
  }
  
  const result = new Uint8Array(targetLength);
  for (let i = targetLength - 1; i >= 0; i--) {
    result[i] = Number(num & 0xFFn);
    num = num >> 8n;
  }
  
  return result;
}

/**
 * Validate UUID format
 */
function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ==================== CORE ENCODING FUNCTIONS ====================

/**
 * Encode UUID to fully reversible short code (22 characters)
 * Perfect for QR codes and sharing
 */
export function uuidToShortCode(uuid: string): string {
  if (!validateUUID(uuid)) {
    throw new Error('Invalid UUID format');
  }
  
  const bytes = uuidParse(uuid);
  const encoded = encodeBase62(bytes);
  return encoded.padStart(SHORT_CODE_LENGTH, '0');
}

/**
 * Decode short code back to UUID (fully reversible)
 */
export function shortCodeToUuid(shortCode: string): string {
  if (shortCode.length !== SHORT_CODE_LENGTH) {
    throw new Error(`Invalid short code length. Expected ${SHORT_CODE_LENGTH} characters.`);
  }
  
  const bytes = decodeBase62(shortCode, 16);
  return uuidStringify(bytes);
}

/**
 * Encode UUID to display code (11 characters, requires database lookup)
 * Perfect for customer-facing codes
 */
export function uuidToDisplayCode(uuid: string): string {
  if (!validateUUID(uuid)) {
    throw new Error('Invalid UUID format');
  }
  
  const bytes = uuidParse(uuid);
  const truncated = bytes.slice(0, 8);
  const encoded = encodeBase62(truncated);
  return encoded.padStart(DISPLAY_CODE_LENGTH, '0');
}

/**
 * Encode UUID to secure code with checksum (12 characters)
 * Includes error detection capabilities
 */
export function uuidToSecureCode(uuid: string): string {
  if (!validateUUID(uuid)) {
    throw new Error('Invalid UUID format');
  }
  
  const bytes = uuidParse(uuid);
  const data = bytes.slice(0, 7);
  
  // Calculate checksum
  const checksum = bytes.reduce((sum, byte) => sum ^ byte, 0);
  
  const combined = new Uint8Array([...data, checksum]);
  const encoded = encodeBase62(combined);
  return encoded.padStart(SECURE_CODE_LENGTH, '0');
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate short code format and reversibility
 */
export function validateShortCode(shortCode: string): ValidationResult {
  const result: ValidationResult = {
    isValid: false,
    details: {
      length: shortCode.length === SHORT_CODE_LENGTH,
      format: /^[0-9a-zA-Z]+$/.test(shortCode)
    }
  };
  
  if (!result.details.length) {
    result.error = `Invalid length. Expected ${SHORT_CODE_LENGTH} characters.`;
    return result;
  }
  
  if (!result.details.format) {
    result.error = 'Invalid format. Only alphanumeric characters allowed.';
    return result;
  }
  
  try {
    const uuid = shortCodeToUuid(shortCode);
    const backToCode = uuidToShortCode(uuid);
    result.isValid = backToCode === shortCode;
    
    if (!result.isValid) {
      result.error = 'Code validation failed during round-trip conversion.';
    }
  } catch (error) {
    result.error = `Decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
  
  return result;
}

/**
 * Validate secure code with checksum verification
 */
export function validateSecureCode(secureCode: string, uuid: string): ValidationResult {
  const result: ValidationResult = {
    isValid: false,
    details: {
      length: secureCode.length === SECURE_CODE_LENGTH,
      format: /^[0-9a-zA-Z]+$/.test(secureCode),
      checksum: false
    }
  };
  
  if (!result.details.length || !result.details.format) {
    result.error = 'Invalid secure code format.';
    return result;
  }
  
  try {
    const bytes = decodeBase62(secureCode, 8);
    const originalBytes = uuidParse(uuid);
    
    const expectedChecksum = originalBytes.reduce((sum, byte) => sum ^ byte, 0);
    result.details.checksum = bytes[7] === expectedChecksum;
    result.isValid = result.details.checksum;
    
    if (!result.isValid) {
      result.error = 'Checksum validation failed.';
    }
  } catch (error) {
    result.error = `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
  
  return result;
}

// ==================== QR CODE GENERATION ====================

/**
 * Generate QR Code using external library (requires 'qrcode' package)
 */
export async function generateQRCode(
  uuid: string, 
  options: QRCodeOptions = {}
): Promise<string> {
  const {
    size = 200,
    baseUrl = '',
    margin = 2,
    errorCorrectionLevel = 'M',
    format = 'png',
    color = { dark: '#000000', light: '#FFFFFF' }
  } = options;

  if (!validateUUID(uuid)) {
    throw new Error('Invalid UUID format');
  }

  const shortCode = uuidToShortCode(uuid);
  const qrData = baseUrl ? `${baseUrl}/${shortCode}` : shortCode;

  try {
    // Dynamic import to avoid bundling issues
    const QRCode = await import('qrcode');
    
    const qrOptions = {
      width: size,
      margin: margin,
      errorCorrectionLevel: errorCorrectionLevel,
      color: color
    };

    if (format === 'svg') {
      return await QRCode.toString(qrData, { ...qrOptions, type: 'svg' });
    } else {
      return await QRCode.toDataURL(qrData, qrOptions);
    }
  } catch (error) {
    throw new Error(`QR Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate QR Code URL using online services (no external dependencies)
 */
export function generateQRCodeUrl(
  uuid: string,
  options: QRServiceOptions = {}
): string {
  const { size = 200, baseUrl = '', service = 'qr-server' } = options;
  
  if (!validateUUID(uuid)) {
    throw new Error('Invalid UUID format');
  }
  
  const shortCode = uuidToShortCode(uuid);
  const qrData = baseUrl ? `${baseUrl}/${shortCode}` : shortCode;
  const encodedData = encodeURIComponent(qrData);

  switch (service) {
    case 'google':
      return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodedData}`;
    case 'qr-code-generator':
      return `https://qr-code-generator.com/api/qr-code/${size}x${size}/?data=${encodedData}`;
    case 'qr-server':
    default:
      return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;
  }
}

/**
 * Batch generate QR codes with error handling
 */
export async function batchGenerateQRCodes(
  uuids: string[],
  options: QRCodeOptions = {}
): Promise<BatchQRResult[]> {
  const results = await Promise.allSettled(
    uuids.map(async (uuid): Promise<BatchQRResult> => {
      try {
        const shortCode = uuidToShortCode(uuid);
        const qrCode = await generateQRCode(uuid, options);
        return {
          uuid,
          shortCode,
          qrCode,
          success: true
        };
      } catch (error) {
        return {
          uuid,
          shortCode: '',
          qrCode: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    })
  );

  return results.map(result => 
    result.status === 'fulfilled' ? result.value : {
      uuid: '',
      shortCode: '',
      qrCode: '',
      success: false,
      error: 'Promise rejected'
    }
  );
}

// ==================== QR PARSING FUNCTIONS ====================

/**
 * Parse QR code data to extract UUID information
 */
export function parseQRData(qrData: string): ParsedQRData {
  if (!qrData) {
    throw new Error('QR data cannot be empty');
  }

  let shortCode: string;
  let isUrl = false;
  let baseUrl: string | undefined;

  // Check if it's a URL
  if (qrData.includes('/')) {
    isUrl = true;
    const parts = qrData.split('/');
    shortCode = parts.pop() || '';
    baseUrl = parts.join('/');
  } else {
    shortCode = qrData.trim();
  }

  // Validate short code format
  const validation = validateShortCode(shortCode);
  if (!validation.isValid) {
    throw new Error(`Invalid QR code format: ${validation.error}`);
  }

  const uuid = shortCodeToUuid(shortCode);
  
  return {
    shortCode,
    uuid,
    isUrl,
    baseUrl
  };
}

/**
 * Validate QR code data format
 */
export function validateQRData(qrData: string): ValidationResult {
  try {
    parseQRData(qrData);
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

// ==================== WORKFLOW FUNCTIONS ====================

/**
 * Complete QR workflow: Generate UUID + all codes + QR
 */
export async function createQRIdentifier(options: {
  baseUrl?: string;
  qrOptions?: QRCodeOptions;
} = {}): Promise<GeneratedQRIdentifier> {
  const { baseUrl = '', qrOptions = {} } = options;
  
  const uuid = uuidv4();
  const shortCode = uuidToShortCode(uuid);
  const scanUrl = baseUrl ? `${baseUrl}/${shortCode}` : shortCode;
  
  const [qrCodeDataUrl, qrCodeUrl] = await Promise.all([
    generateQRCode(uuid, { ...qrOptions, baseUrl }).catch(() => ''),
    Promise.resolve(generateQRCodeUrl(uuid, { baseUrl, size: qrOptions.size }))
  ]);

  return {
    uuid,
    shortCode,
    qrCodeDataUrl,
    qrCodeUrl,
    scanUrl,
    createdAt: new Date()
  };
}

/**
 * Generate all code variants for a UUID
 */
export function generateCodeVariants(uuid: string): CodeVariants {
  if (!validateUUID(uuid)) {
    throw new Error('Invalid UUID format');
  }

  return {
    uuid,
    shortCode: uuidToShortCode(uuid),
    displayCode: uuidToDisplayCode(uuid),
    secureCode: uuidToSecureCode(uuid)
  };
}

/**
 * Batch generate code variants
 */
export function batchGenerateCodeVariants(uuids: string[]): CodeVariants[] {
  return uuids.map(uuid => generateCodeVariants(uuid));
}

// ==================== DATABASE HELPER FUNCTIONS ====================

/**
 * Helper for database lookup operations
 */
export async function lookupUUIDByDisplayCode(
  displayCode: string, 
  dbLookup: DatabaseLookupFunction
): Promise<string> {
  if (displayCode.length !== DISPLAY_CODE_LENGTH) {
    throw new Error(`Invalid display code length. Expected ${DISPLAY_CODE_LENGTH} characters.`);
  }

  const result = await dbLookup(displayCode);
  
  if (!result) {
    throw new Error(`UUID not found for display code: ${displayCode}`);
  }
  
  if (!validateUUID(result)) {
    throw new Error('Invalid UUID returned from database lookup');
  }
  
  return result;
}

/**
 * Helper for secure code lookup with validation
 */
export async function lookupUUIDBySecureCode(
  secureCode: string,
  dbLookup: DatabaseLookupFunction
): Promise<string> {
  if (secureCode.length !== SECURE_CODE_LENGTH) {
    throw new Error(`Invalid secure code length. Expected ${SECURE_CODE_LENGTH} characters.`);
  }

  const uuid = await dbLookup(secureCode);
  
  if (!uuid) {
    throw new Error(`UUID not found for secure code: ${secureCode}`);
  }
  
  // Validate checksum
  const validation = validateSecureCode(secureCode, uuid);
  if (!validation.isValid) {
    throw new Error(`Secure code validation failed: ${validation.error}`);
  }
  
  return uuid;
}

// ==================== UTILITY EXPORTS ====================

export {
  BASE62_CHARS,
  SHORT_CODE_LENGTH,
  DISPLAY_CODE_LENGTH,
  SECURE_CODE_LENGTH,
  validateUUID
};

// ==================== DEFAULT EXPORT ====================

export default {
  // Core functions
  uuidToShortCode,
  shortCodeToUuid,
  uuidToDisplayCode,
  uuidToSecureCode,
  
  // Validation
  validateShortCode,
  validateSecureCode,
  validateQRData,
  
  // QR Generation
  generateQRCode,
  generateQRCodeUrl,
  batchGenerateQRCodes,
  
  // QR Parsing
  parseQRData,
  
  // Workflows
  createQRIdentifier,
  generateCodeVariants,
  batchGenerateCodeVariants,
  
  // Database helpers
  lookupUUIDByDisplayCode,
  lookupUUIDBySecureCode,
  
  // Utilities
  validateUUID
};
