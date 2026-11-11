import {
  MerchantConfig,
  PaymentSession,
  AndroidDevice,
  CompanionObservation,
  CODOrder,
  POSTransaction,
  EDCTerminalState,
  RefundRecord,
} from '../src/types/index.ts';

class DatabaseStore {
  // Multi-Tenant Merchant Registry
  public merchants: Map<string, MerchantConfig> = new Map();

  public sessions: Map<string, PaymentSession> = new Map();
  public queue: string[] = []; // Session IDs waiting for slot
  public activeProcessing: Set<string> = new Set(); // Session IDs actively occupying concurrency slot
  public idempotencyKeys: Map<string, string> = new Map(); // key -> sessionId

  // Refunds store
  public refunds: Map<string, RefundRecord> = new Map();

  // Auth: Customer Phone Challenges (Strictly Server-Side)
  public phoneChallenges: Map<
    string,
    {
      phone: string;
      rawOtp: string;
      expiresAt: number;
      verified: boolean;
      attempts: number;
    }
  > = new Map();

  // Android Companion Store
  public androidDevices: Map<string, AndroidDevice> = new Map();
  public companionObservations: CompanionObservation[] = [];

  // Cash On Delivery (COD) Store
  public codOrders: Map<string, CODOrder> = new Map();

  // Offline POS Store
  public posTransactions: POSTransaction[] = [];
  public cashRegister = {
    openingFloat: 2500,
    currentCash: 5350,
    currentShiftCashier: 'Aarav Sharma (Counter 02)',
    openedAt: Date.now() - 14400000,
  };

  public edcTerminal: EDCTerminalState = {
    terminalId: 'EDC-PINE-9842',
    status: 'IDLE',
    amount: 0,
    message: 'Ready for transaction',
  };

  // Webhooks
  public webhookLogs: Array<{
    id: string;
    merchantId: string;
    event: string;
    payload: any;
    status: number;
    timestamp: number;
    signature: string;
  }> = [];

  // Failed Requests & Webhook Errors for Developer Debugging
  public failedPayments: Array<{
    id: string;
    orderId: string;
    merchantId: string;
    amount: number;
    reason: string;
    timestamp: number;
    requestId?: string;
  }> = [];

  public failedWebhooks: Array<{
    id: string;
    event: string;
    merchantId: string;
    url: string;
    error: string;
    timestamp: number;
    retryCount: number;
    payload: any;
  }> = [];

  constructor() {
    this.seedInitialData();
  }

  // Active default merchant getter (for backwards-compatibility in single-merchant views)
  public get merchant(): MerchantConfig {
    return this.merchants.get('mer_openupi_01')!;
  }

  public set merchant(config: MerchantConfig) {
    this.merchants.set(config.id, config);
  }

  private seedInitialData() {
    // 1. Primary Merchant
    const m1: MerchantConfig = {
      id: 'mer_openupi_01',
      name: 'Acme Retail & Tech Ltd',
      vpa: 'acmeretail@upi',
      apiKey: 'oup_test_8f294ba713cd4109b8',
      webhookSecret: 'whsec_a891f7c239401829e1',
      primaryColor: '#0284c7',
      logoUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=128&auto=format&fit=crop&q=80',
      supportEmail: 'payments@acmeretail.in',
      supportPhone: '+91 80 4920 1200',
      customDomain: 'pay.acmeretail.in',
      domainVerified: true,
      maxConcurrentPayments: 3,
      paymentTimeoutSeconds: 300,
      mockMode: true,
      webhookUrl: 'https://merchant.example.com/api/webhooks',
    };
    this.merchants.set(m1.id, m1);

    // 2. Secondary Isolated Merchant (For multi-tenant isolation testing)
    const m2: MerchantConfig = {
      id: 'mer_isolated_02',
      name: 'Zenith Organic Botanicals',
      vpa: 'zenithbotanicals@upi',
      apiKey: 'oup_test_zenith_91b72a4805c31f',
      webhookSecret: 'whsec_zenith_5521b44781',
      primaryColor: '#059669',
      logoUrl: '',
      supportEmail: 'care@zenithbotanicals.in',
      supportPhone: '+91 80 8820 4400',
      customDomain: 'pay.zenithbotanicals.in',
      domainVerified: true,
      maxConcurrentPayments: 5,
      paymentTimeoutSeconds: 300,
      mockMode: true,
      webhookUrl: 'https://zenith.example.com/webhooks/upi',
    };
    this.merchants.set(m2.id, m2);

    // Seed initial Android Device
    const devId = 'AND-NODE-KOTLIN-01';
    this.androidDevices.set(devId, {
      deviceId: devId,
      deviceName: 'Pixel 8 Companion Node (Store Front)',
      model: 'Google Pixel 8 (Android 14)',
      enrollmentDate: '2026-11-01T10:00:00Z',
      status: 'ONLINE',
      batteryPercent: 88,
      isCharging: true,
      batteryTempC: 32.4,
      networkType: 'WIFI',
      lastHeartbeat: Date.now(),
      publicKey: '3059301306072a8648ce3d020106082a8648ce3d03010703420004b789e902',
      firmwareVersion: 'v2.4.1-companion',
      permissionsGranted: [
        'BIND_NOTIFICATION_LISTENER_SERVICE',
        'RECEIVE_BOOT_COMPLETED',
        'ACCESS_NETWORK_STATE',
      ],
    });

    // Seed Initial Observation
    this.companionObservations.push({
      id: 'obs_98124',
      deviceId: devId,
      timestamp: Date.now() - 3600000,
      rawSender: 'AXISBK-UPI',
      detectedAmount: 1499.0,
      referenceId: 'UPI-AXIS-99238471',
      signature: 'sha256_hmac_90bf39a1c6e18f2',
      signatureValid: true,
      settlementStatus: 'OBSERVED_UNVERIFIED',
      disclaimer:
        'Companion notification signals intent arrival. Settlement requires core bank webhook reconciliation.',
    });

    // Seed Sample COD Orders with merchantId
    const cod1Id = 'COD-ORD-101';
    this.codOrders.set(cod1Id, {
      id: 'cod_rec_101',
      orderId: cod1Id,
      merchantId: 'mer_openupi_01',
      customerName: 'Priya Mukherjee',
      phone: '+91 98201 44521',
      deliveryAddress: 'Flat 402, Green Glen Heights, Bellandur, Bengaluru',
      pincode: '560103',
      items: [
        { name: 'Organic Darjeeling Tea (250g)', quantity: 2, price: 450 },
        { name: 'Handcrafted Ceramic Teapot', quantity: 1, price: 899 },
      ],
      itemTotal: 1799,
      codFee: 50,
      totalAmount: 1849,
      status: 'AWAITING_MERCHANT_APPROVAL',
      createdAt: Date.now() - 7200000,
    });

    // Seed Sample POS Transaction
    this.posTransactions.push({
      id: 'pos_txn_401',
      receiptNumber: 'RCP-2026-00401',
      merchantId: 'mer_openupi_01',
      cashierName: 'Aarav Sharma (Counter 02)',
      items: [
        { name: 'Espresso Roast Beans 500g', qty: 1, price: 650 },
        { name: 'Oat Milk Barista Edition 1L', qty: 2, price: 320 },
      ],
      subtotal: 1290,
      tax: 64.5,
      total: 1354.5,
      splitTender: {
        cashAmount: 354.5,
        cashTendered: 500,
        changeReturned: 145.5,
        cardAmount: 1000,
        cardAuthCode: 'AUTH-9402',
        cardRRN: 'RRN-630291048',
        upiAmount: 0,
      },
      timestamp: Date.now() - 5400000,
      status: 'COMPLETED',
    });
  }

  // Merchant Lookup Methods
  public getMerchant(merchantId: string): MerchantConfig | undefined {
    return this.merchants.get(merchantId);
  }

  public getMerchantByApiKey(apiKey: string): MerchantConfig | undefined {
    const cleanKey = apiKey.replace(/^Bearer\s+/i, '').trim();
    for (const m of this.merchants.values()) {
      if (m.apiKey === cleanKey) {
        return m;
      }
    }
    return undefined;
  }

  // Session Helper Methods
  public createSession(session: PaymentSession): PaymentSession {
    this.sessions.set(session.id, session);
    if (session.idempotencyKey) {
      this.idempotencyKeys.set(session.idempotencyKey, session.id);
    }
    return session;
  }

  public getSession(id: string): PaymentSession | undefined {
    return this.sessions.get(id);
  }

  public updateSession(id: string, updates: Partial<PaymentSession>): PaymentSession | undefined {
    const existing = this.sessions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  public getSessionsByMerchant(merchantId: string): PaymentSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.merchantId === merchantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Refund Helper Methods
  public createRefund(refund: RefundRecord): RefundRecord {
    this.refunds.set(refund.id, refund);
    const session = this.sessions.get(refund.sessionId);
    if (session) {
      session.refundedAmount = (session.refundedAmount || 0) + refund.amount;
      session.refunds = session.refunds || [];
      session.refunds.push(refund);
      session.status = session.refundedAmount >= session.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      this.sessions.set(session.id, session);
    }
    return refund;
  }

  public getRefundsByMerchant(merchantId: string): RefundRecord[] {
    return Array.from(this.refunds.values())
      .filter((r) => r.merchantId === merchantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Failed Transaction Recording for Debugging
  public recordFailedPayment(entry: {
    orderId: string;
    merchantId: string;
    amount: number;
    reason: string;
    requestId?: string;
  }) {
    this.failedPayments.unshift({
      id: 'fail_' + Date.now().toString().slice(-6),
      ...entry,
      timestamp: Date.now(),
    });
    if (this.failedPayments.length > 100) this.failedPayments.pop();
  }

  public recordFailedWebhook(entry: {
    event: string;
    merchantId: string;
    url: string;
    error: string;
    payload: any;
  }) {
    this.failedWebhooks.unshift({
      id: 'wh_fail_' + Date.now().toString().slice(-6),
      ...entry,
      timestamp: Date.now(),
      retryCount: 0,
    });
    if (this.failedWebhooks.length > 100) this.failedWebhooks.pop();
  }
}

export const db = new DatabaseStore();
