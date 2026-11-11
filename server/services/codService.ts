import crypto from 'crypto';
import { db } from '../store.ts';
import { CODOrder, CODStatus } from '../../src/types/index.ts';

export class CODService {
  /**
   * Create COD Order
   */
  public static createOrder(params: {
    orderId: string;
    customerName: string;
    phone: string;
    deliveryAddress: string;
    pincode: string;
    items: { name: string; quantity: number; price: number }[];
    codFee?: number;
  }): CODOrder {
    const itemTotal = params.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const codFee = params.codFee !== undefined ? params.codFee : 50;
    const totalAmount = itemTotal + codFee;

    const newOrder: CODOrder = {
      id: 'cod_' + crypto.randomBytes(6).toString('hex'),
      orderId: params.orderId,
      customerName: params.customerName,
      phone: params.phone,
      deliveryAddress: params.deliveryAddress,
      pincode: params.pincode,
      items: params.items,
      itemTotal,
      codFee,
      totalAmount,
      status: 'AWAITING_MERCHANT_APPROVAL',
      createdAt: Date.now(),
    };

    db.codOrders.set(params.orderId, newOrder);
    return newOrder;
  }

  /**
   * Merchant Approval or Rejection
   */
  public static updateMerchantApproval(
    orderId: string,
    approved: boolean,
    rejectReason?: string
  ): CODOrder | null {
    const order = db.codOrders.get(orderId);
    if (!order) return null;

    if (approved) {
      order.status = 'MERCHANT_APPROVED';
      order.approvedAt = Date.now();
    } else {
      order.status = 'REJECTED_RETURNED';
    }

    db.codOrders.set(orderId, order);
    return order;
  }

  /**
   * Advance Delivery Status
   */
  public static updateDeliveryStatus(
    orderId: string,
    status: CODStatus,
    courierData?: { courierPartner: string; trackingNumber: string }
  ): CODOrder | null {
    const order = db.codOrders.get(orderId);
    if (!order) return null;

    order.status = status;
    if (courierData) {
      order.courierPartner = courierData.courierPartner;
      order.trackingNumber = courierData.trackingNumber;
    }
    if (status === 'DISPATCHED') {
      order.dispatchedAt = Date.now();
    } else if (status === 'DELIVERED_CASH_COLLECTED') {
      order.deliveredAt = Date.now();
      // Record in cash register float
      db.cashRegister.currentCash += order.totalAmount;
    }

    db.codOrders.set(orderId, order);
    return order;
  }

  /**
   * Generate COD Performance & Reconciliation Report
   */
  public static getCODReport() {
    const orders = Array.from(db.codOrders.values());
    const totalOrders = orders.length;
    let totalValue = 0;
    let collectedValue = 0;
    let deliveredCount = 0;
    let returnedCount = 0;
    let pendingApprovalCount = 0;
    let inTransitCount = 0;

    orders.forEach((o) => {
      totalValue += o.totalAmount;
      if (o.status === 'DELIVERED_CASH_COLLECTED') {
        collectedValue += o.totalAmount;
        deliveredCount++;
      } else if (o.status === 'REJECTED_RETURNED') {
        returnedCount++;
      } else if (o.status === 'AWAITING_MERCHANT_APPROVAL') {
        pendingApprovalCount++;
      } else if (o.status === 'DISPATCHED' || o.status === 'OUT_FOR_DELIVERY') {
        inTransitCount++;
      }
    });

    const deliverySuccessRate = totalOrders > 0 
      ? Math.round((deliveredCount / totalOrders) * 100) 
      : 0;
    const rtoRate = totalOrders > 0 
      ? Math.round((returnedCount / totalOrders) * 100) 
      : 0;

    return {
      totalOrders,
      totalValue,
      collectedValue,
      pendingCollectionValue: totalValue - collectedValue,
      deliveredCount,
      returnedCount,
      pendingApprovalCount,
      inTransitCount,
      deliverySuccessRate,
      rtoRate,
    };
  }
}
