export interface MerchantConfig {
  id: string;
  name: string;
  vpa: string;
  apiKey: string;
  primaryColor: string;
  logoUrl: string;
  supportEmail: string;
  supportPhone: string;
  customDomain: string;
  domainVerified: boolean;
  maxConcurrentPayments: number;
  paymentTimeoutSeconds: number;
  mockMode: boolean;
  webhookSecret: string;
  webhookUrl?: string;
}

export type PaymentStatus = 
  | 'QUEUED'
  | 'ACTIVE'
  | 'PAID'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod = 'UPI_QR' | 'UPI_INTENT' | 'CASH' | 'CARD_EDC' | 'COD';

export interface PaymentSession {
  id: string;
  orderId: string;
  merchantId: string;
  amount: number;
  currency: string;
  customerName?: string;
  customerPhone?: string;
  isPhoneVerified: boolean;
  status: PaymentStatus;
  method: PaymentMethod;
  upiUri: string;
  qrDataUrl: string;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
  queuePosition?: number;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  observedByCompanion?: boolean;
  companionObservationNote?: string;
  refundedAmount?: number;
  refunds?: RefundRecord[];
}

export interface RefundRecord {
  id: string;
  sessionId: string;
  merchantId: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'PROCESSED' | 'FAILED';
  idempotencyKey?: string;
  createdAt: number;
  rrn?: string;
}

export interface QueueStatus {
  totalInQueue: number;
  activeProcessing: number;
  maxConcurrency: number;
  availableSlots: number;
  averageWaitTimeMs: number;
}

export interface AndroidDevice {
  deviceId: string;
  deviceName: string;
  model: string;
  enrollmentDate: string;
  status: 'ONLINE' | 'STANDBY' | 'OFFLINE';
  batteryPercent: number;
  isCharging: boolean;
  batteryTempC: number;
  networkType: 'WIFI' | 'CELLULAR_5G' | 'CELLULAR_4G';
  lastHeartbeat: number;
  publicKey: string;
  firmwareVersion: string;
  permissionsGranted: string[];
}

export interface CompanionObservation {
  id: string;
  deviceId: string;
  timestamp: number;
  rawSender: string;
  detectedAmount: number;
  referenceId: string;
  signature: string;
  signatureValid: boolean;
  settlementStatus: 'OBSERVED_UNVERIFIED' | 'MATCHED_PENDING_SETTLEMENT' | 'MANUALLY_DISMISSED';
  disclaimer: string;
}

export type CODStatus = 
  | 'PENDING_VERIFICATION'
  | 'AWAITING_MERCHANT_APPROVAL'
  | 'MERCHANT_APPROVED'
  | 'DISPATCHED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED_CASH_COLLECTED'
  | 'REJECTED_RETURNED';

export interface CODOrder {
  id: string;
  orderId: string;
  merchantId: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  pincode: string;
  items: { name: string; quantity: number; price: number }[];
  itemTotal: number;
  codFee: number;
  totalAmount: number;
  status: CODStatus;
  createdAt: number;
  approvedAt?: number;
  dispatchedAt?: number;
  deliveredAt?: number;
  courierPartner?: string;
  trackingNumber?: string;
}

export interface POSTransaction {
  id: string;
  receiptNumber: string;
  merchantId: string;
  cashierName: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
  splitTender: {
    cashAmount: number;
    cashTendered: number;
    changeReturned: number;
    cardAmount: number;
    cardAuthCode?: string;
    cardRRN?: string;
    upiAmount: number;
    upiRefId?: string;
  };
  timestamp: number;
  status: 'COMPLETED' | 'VOIDED';
}

export interface EDCTerminalState {
  terminalId: string;
  status: 'IDLE' | 'AWAITING_CARD' | 'PROCESSING_CHIP' | 'APPROVED' | 'DECLINED';
  amount: number;
  authCode?: string;
  rrn?: string;
  message: string;
}

export interface TestResult {
  module: string;
  testName: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

export interface SystemHealthState {
  application: {
    status: 'HEALTHY' | 'DEGRADED';
    version: string;
    nodeVersion: string;
    uptimeSeconds: number;
    activeSessions: number;
  };
  database: {
    status: 'CONNECTED';
    engine: 'IN_MEMORY_PERSISTENT_STORE';
    integrityCheck: 'PASSED';
    totalRecords: number;
  };
  redis: {
    status: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
    mode: string;
    latencyMs: number;
    totalKeys: number;
  };
  workers: {
    queueWatchdog: 'RUNNING';
    webhookDispatcher: 'IDLE' | 'ACTIVE';
    lastHeartbeat: string;
  };
  paymentProvider: {
    name: 'NPCI UPI Sandbox / Mock Gateway';
    status: 'ONLINE';
    circuitBreaker: 'CLOSED';
  };
}

export interface SecurityAuditItem {
  id: string;
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  affectedFile: string;
  explanation: string;
  fixApplied: string;
  testPerformed: string;
  status: 'RESOLVED' | 'VERIFIED';
}
