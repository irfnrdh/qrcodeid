# qrcodeid
UUID QRCODE


### **1. Full TypeScript Support**
- ✅ Comprehensive interfaces & types
- ✅ Strict type checking
- ✅ Proper error handling with typed errors
- ✅ JSDoc documentation
- ✅ Export/import ready

### **2. Multiple Encoding Strategies**
```typescript
// Fully reversible (22 chars) - Perfect for QR
const shortCode = uuidToShortCode(uuid);
const backToUuid = shortCodeToUuid(shortCode);

// Display friendly (11 chars) - Needs DB lookup
const displayCode = uuidToDisplayCode(uuid);

// Secure with checksum (12 chars) - Error detection
const secureCode = uuidToSecureCode(uuid);
```

### **3. Advanced QR Code Generation**
```typescript
// With external library
const qrDataUrl = await generateQRCode(uuid, {
  size: 300,
  errorCorrectionLevel: 'H',
  format: 'png',
  color: { dark: '#FF0000', light: '#FFFFFF' }
});

// With online service (no dependencies)
const qrUrl = generateQRCodeUrl(uuid, {
  service: 'qr-server',
  size: 200
});
```

### **4. Comprehensive Validation**
```typescript
// Validate codes
const validation = validateShortCode(code);
if (!validation.isValid) {
  console.log(validation.error);
  console.log(validation.details); // detailed breakdown
}
```

### **5. Complete Workflow Functions**
```typescript
// Generate everything at once
const qrIdentifier = await createQRIdentifier({
  baseUrl: 'https://myapp.com/scan',
  qrOptions: { size: 250, errorCorrectionLevel: 'M' }
});

// Get all code variants
const variants = generateCodeVariants(uuid);
// Returns: { uuid, shortCode, displayCode, secureCode }
```

## **📦 Installation & Usage:**

### **1. Dependencies:**
```bash
npm install uuid
npm install @types/uuid

# Optional (for QR generation)
npm install qrcode
npm install @types/qrcode
```

### **2. Import:**
```typescript
// Named imports
import { 
  uuidToShortCode, 
  generateQRCode, 
  createQRIdentifier 
} from './qrcodeid';

// Default import
import QRCodeID from './qrcodeid';

// Type imports
import type { 
  QRCodeOptions, 
  GeneratedQRIdentifier,
  ValidationResult 
} from './qrcodeid';
```

### **3. Usage Examples:**
```typescript
// Quick start
const uuid = uuidv4();
const qrId = await createQRIdentifier({
  baseUrl: 'https://myapp.com/scan'
});

// Parse scanned QR
const parsed = parseQRData(scannedData);
console.log(`UUID: ${parsed.uuid}`);

// Batch processing
const results = await batchGenerateQRCodes(uuids, {
  size: 200,
  baseUrl: 'https://myapp.com/scan'
});
```

## **🛡️ Error Handling:**
- Comprehensive validation untuk semua input
- Proper TypeScript error types
- Detailed error messages
- Graceful fallbacks untuk batch operations

## **🎯 Use Cases:**
- **E-commerce**: Product tracking QR codes
- **Events**: Ticket verification
- **Auth**: Secure login QR codes  
- **Inventory**: Asset management
- **Marketing**: Campaign tracking
