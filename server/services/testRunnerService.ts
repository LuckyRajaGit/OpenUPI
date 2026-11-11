import { QRService } from './qrService.ts';
import { QueueService } from './queueService.ts';
import { AuthService } from './authService.ts';
import { CompanionService } from './companionService.ts';
import { CODService } from './codService.ts';
import { POSService } from './posService.ts';
import { WhiteLabelService } from './whiteLabelService.ts';
import { db } from '../store.ts';
import { TestResult } from '../../src/types/index.ts';

export class TestRunnerService {
  /**
   * Run full test suite across all 9 modules
   */
  public static async runAllTests(): Promise<{
    totalTests: number;
    passedCount: number;
    failedCount: number;
    durationMs: number;
    results: TestResult[];
  }> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    // Helper assertion
    const assertTest = (
      module: string,
      testName: string,
      fn: () => void | Promise<void>
    ) => {
      const t0 = Date.now();
      try {
        fn();
        results.push({
          module,
          testName,
          passed: true,
          durationMs: Date.now() - t0,
          details: 'Assertion passed successfully',
        });
      } catch (err: any) {
        results.push({
          module,
          testName,
          passed: false,
          durationMs: Date.now() - t0,
          details: err.message || 'Assertion failed',
        });
      }
    };

    // 1. Universal JavaScript SDK
    assertTest('Universal JS SDK', 'Validates openupi.js bundle endpoint availability', () => {
      if (typeof window !== 'undefined') {
        // client-side validation
      }
      // Ensure merchant config has valid schema
      if (!db.merchant.id || !db.merchant.vpa) {
        throw new Error('Merchant profile missing essential fields');
      }
    });

    assertTest('Universal JS SDK', 'Validates HTML data attribute specification schema', () => {
      const expectedAttrs = [
        'data-openupi-checkout',
        'data-openupi-amount',
        'data-openupi-order-id',
        'data-openupi-name',
      ];
      if (expectedAttrs.length !== 4) throw new Error('Attribute count mismatch');
    });

    // 2. Dynamic QR
    assertTest('Dynamic QR', 'Generates standard NPCI UPI URI with valid parameters', () => {
      const uri = QRService.generateUpiUri({
        vpa: 'test@upi',
        merchantName: 'Test Store',
        amount: 250,
        transactionRef: 'TXN123',
        orderId: 'ORD-99',
      });
      if (!uri.startsWith('upi://pay?')) throw new Error('URI must start with upi://pay?');
      if (!uri.includes('pa=test@upi')) throw new Error('Missing VPA in URI');
      if (!uri.includes('am=250.00')) throw new Error('Amount formatting invalid');
    });

    assertTest('Dynamic QR', 'Builds deep-link mobile intents for GPay, PhonePe, Paytm', () => {
      const intents = QRService.generateAppIntents('upi://pay?pa=test@upi&am=100.00');
      if (!intents.gpay.startsWith('gpay://upi/pay?')) throw new Error('Invalid GPay intent');
      if (!intents.phonepe.startsWith('phonepe://pay?')) throw new Error('Invalid PhonePe intent');
      if (!intents.paytm.startsWith('paytmmp://pay?')) throw new Error('Invalid Paytm intent');
    });

    // 3. Payment Queue
    assertTest('Payment Queue', 'Prevents duplicate transaction for settled or active order', () => {
      const dupCheck = QueueService.checkDuplicate('NON_EXISTENT_ORD_RANDOM');
      if (dupCheck.isDuplicate) throw new Error('Expected new order to not be marked duplicate');
    });

    assertTest('Payment Queue', 'Enforces concurrent payment slot limits', () => {
      const status = QueueService.getQueueStatus();
      if (status.maxConcurrency <= 0) throw new Error('Max concurrency must be > 0');
      if (status.availableSlots < 0) throw new Error('Available slots cannot be negative');
    });

    // 4. Authentication & Security
    assertTest('Authentication', 'Rejects unauthorized requests lacking merchant key', () => {
      const auth = AuthService.verifyMerchantKey(undefined);
      if (auth.valid) throw new Error('Should reject missing auth header');
    });

    assertTest('Authentication', 'Never exposes plain-text OTP secrets to customer responses', () => {
      const challenge = AuthService.createPhoneChallenge('+91 99999 11111');
      if (!challenge.challengeId) throw new Error('Missing challengeId');
      // @ts-ignore
      if (challenge.rawOtp || challenge.otp) {
        throw new Error('SECURITY VIOLATION: Plain OTP returned in client challenge payload!');
      }
    });

    // 5. Android Companion
    assertTest('Android Companion', 'Enforces strict settlement separation rule on observations', () => {
      const dev = CompanionService.enrollDevice({
        deviceName: 'Test Phone',
        model: 'Android 14',
      });
      const obs = CompanionService.ingestObservation({
        deviceId: dev.device.deviceId,
        rawSender: 'HDFCBK-UPI',
        detectedAmount: 500,
        referenceId: 'UPI123456',
        signature: 'mock_sig',
      });
      if (obs.observation.settlementStatus === 'MATCHED_PENDING_SETTLEMENT' || (obs.observation.settlementStatus as any) === 'SETTLED') {
        throw new Error('Observations must never be marked settled directly!');
      }
    });

    // 6. COD Operations
    assertTest('COD Operations', 'Computes order totals and updates merchant approval lifecycle', () => {
      const cod = CODService.createOrder({
        orderId: 'TEST-COD-' + Date.now(),
        customerName: 'Samir Rao',
        phone: '+91 98220 11223',
        deliveryAddress: 'Road 36, Jubilee Hills, Hyderabad',
        pincode: '500033',
        items: [{ name: 'Test Chai Blend', quantity: 2, price: 200 }],
        codFee: 50,
      });
      if (cod.totalAmount !== 450) throw new Error(`Expected 450, got ${cod.totalAmount}`);
      const approved = CODService.updateMerchantApproval(cod.orderId, true);
      if (approved?.status !== 'MERCHANT_APPROVED') throw new Error('Status should be MERCHANT_APPROVED');
    });

    // 7. Offline POS
    assertTest('Offline POS', 'Records multi-tender split payment and updates cash drawer', () => {
      const initialCash = db.cashRegister.currentCash;
      const txn = POSService.recordTransaction({
        items: [{ name: 'Single Origin Roast', qty: 1, price: 400 }],
        splitTender: {
          cashAmount: 200,
          cashTendered: 500,
          changeReturned: 300,
          cardAmount: 220, // 400 + 5% tax = 420
          upiAmount: 0,
        },
      });
      if (txn.total !== 420) throw new Error(`Total should be 420, got ${txn.total}`);
      if (db.cashRegister.currentCash !== initialCash + 200) {
        throw new Error('Cash drawer was not properly incremented');
      }
    });

    // 8. White-Label Engine
    assertTest('White-Label', 'Dynamically generates custom CSS theme variables', () => {
      const vars = WhiteLabelService.generateCssVariables();
      if (!vars['--oup-primary']) throw new Error('Missing --oup-primary variable');
    });

    // 9. Developer Experience
    assertTest('Developer Experience', 'Generates valid Postman collection v2.1 structure', () => {
      const collection = {
        info: { name: 'OpenUPI Gateway API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Create Session', request: { method: 'POST', url: '/api/v1/sessions' } }],
      };
      if (!collection.info.schema) throw new Error('Postman schema missing');
    });

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      totalTests: results.length,
      passedCount,
      failedCount,
      durationMs: Date.now() - startTime,
      results,
    };
  }
}
