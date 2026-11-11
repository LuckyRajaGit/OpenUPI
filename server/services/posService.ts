import crypto from 'crypto';
import { db } from '../store.ts';
import { POSTransaction } from '../../src/types/index.ts';

export class POSService {
  /**
   * Record Complete Counter Transaction (supporting split tender)
   */
  public static recordTransaction(params: {
    cashierName?: string;
    merchantId?: string;
    items: { name: string; qty: number; price: number }[];
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
  }): POSTransaction {
    const subtotal = params.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const total = subtotal + tax;

    const receiptNumber = 'RCP-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);

    const transaction: POSTransaction = {
      id: 'pos_' + crypto.randomBytes(6).toString('hex'),
      receiptNumber,
      merchantId: params.merchantId || db.merchant.id,
      cashierName: params.cashierName || db.cashRegister.currentShiftCashier,
      items: params.items,
      subtotal,
      tax,
      total,
      splitTender: params.splitTender,
      timestamp: Date.now(),
      status: 'COMPLETED',
    };

    db.posTransactions.unshift(transaction);

    // Update physical cash register float
    if (params.splitTender.cashAmount > 0) {
      db.cashRegister.currentCash += params.splitTender.cashAmount;
    }

    return transaction;
  }

  /**
   * External Card Terminal (EDC) Bridge Simulator
   */
  public static triggerCardTerminal(amount: number): {
    terminalId: string;
    status: string;
    message: string;
    authCode?: string;
    rrn?: string;
  } {
    const authCode = 'AUTH-' + Math.floor(1000 + Math.random() * 9000);
    const rrn = 'RRN-' + Date.now().toString().slice(-9);

    db.edcTerminal = {
      terminalId: 'EDC-PINE-9842',
      status: 'APPROVED',
      amount,
      authCode,
      rrn,
      message: `Card Approved via EMV Chip. Auth: ${authCode}`,
    };

    return db.edcTerminal;
  }

  /**
   * Reset EDC Terminal to IDLE
   */
  public static resetCardTerminal() {
    db.edcTerminal = {
      terminalId: 'EDC-PINE-9842',
      status: 'IDLE',
      amount: 0,
      message: 'Terminal ready for contactless/chip card',
    };
    return db.edcTerminal;
  }

  /**
   * Get Cashier Shift Summary (Z-Report)
   */
  public static getShiftSummary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startTime = todayStart.getTime();

    const todayTxns = db.posTransactions.filter((t) => t.timestamp >= startTime);
    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;

    todayTxns.forEach((t) => {
      totalSales += t.total;
      cashSales += t.splitTender.cashAmount;
      cardSales += t.splitTender.cardAmount;
      upiSales += t.splitTender.upiAmount;
    });

    return {
      cashier: db.cashRegister.currentShiftCashier,
      shiftOpenedAt: db.cashRegister.openedAt,
      openingFloat: db.cashRegister.openingFloat,
      currentCashInDrawer: db.cashRegister.currentCash,
      todayTransactionCount: todayTxns.length,
      totalSales,
      breakdown: {
        cash: cashSales,
        card: cardSales,
        upi: upiSales,
      },
      edcTerminal: db.edcTerminal,
    };
  }
}
