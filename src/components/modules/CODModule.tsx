import React, { useState, useEffect } from 'react';
import { Truck, Check, X, Package, CheckCircle2, Clock, RotateCcw, Plus, RefreshCw, BarChart3 } from 'lucide-react';
import { CODOrder, CODStatus } from '../../types/index.ts';

export const CODModule: React.FC = () => {
  const [orders, setOrders] = useState<CODOrder[]>([]);
  const [report, setReport] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customerName, setCustomerName] = useState('Vikram Malhotra');
  const [phone, setPhone] = useState('+91 98450 77123');
  const [deliveryAddress, setDeliveryAddress] = useState('#42, 1st Cross, Indiranagar, Bengaluru');
  const [pincode, setPincode] = useState('560038');
  const [itemName, setItemName] = useState('Artisanal Coffee Grinder');
  const [itemPrice, setItemPrice] = useState('1499');

  const fetchData = async () => {
    try {
      const [resO, resR] = await Promise.all([
        fetch('/api/v1/cod/orders'),
        fetch('/api/v1/cod/report'),
      ]);
      const dataO = await resO.json();
      const dataR = await resR.json();
      if (dataO && dataO.orders) setOrders(dataO.orders);
      if (dataR) setReport(dataR);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateOrder = async () => {
    try {
      await fetch('/api/v1/cod/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'COD-' + Math.floor(1000 + Math.random() * 9000),
          customerName,
          phone,
          deliveryAddress,
          pincode,
          items: [{ name: itemName, quantity: 1, price: parseFloat(itemPrice) }],
          codFee: 50,
        }),
      });
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMerchantApproval = async (orderId: string, approved: boolean) => {
    try {
      await fetch(`/api/v1/cod/orders/${orderId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateDelivery = async (orderId: string, status: CODStatus) => {
    try {
      await fetch(`/api/v1/cod/orders/${orderId}/delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Module 06
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Cash On Delivery Operations</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              COD Order Lifecycle & Reconciliation Management
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Provides risk mitigation for Cash on Delivery transactions with merchant pre-dispatch verification, courier transit updates, return-to-origin (RTO) analytics, and automated cash drawer reconciliation.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-sm shadow-sky-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create COD Order</span>
          </button>
        </div>
      </div>

      {/* COD Key Performance Indicators */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Total COD Booked</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              ₹{report.totalValue.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{report.totalOrders} total orders</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Cash Collected</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              ₹{report.collectedValue.toFixed(2)}
            </div>
            <div className="text-[11px] text-emerald-500/80 mt-1">{report.deliveredCount} orders delivered</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Pending Approval</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {report.pendingApprovalCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Awaiting merchant review</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Return Rate (RTO)</div>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {report.rtoRate}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{report.returnedCount} rejected / returned</div>
          </div>
        </div>
      )}

      {/* COD Orders Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-sky-400" />
            COD Order Management & Fulfillment Pipeline
          </h3>
          <button onClick={fetchData} className="text-xs text-sky-400 hover:text-sky-300">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Customer & Phone</th>
                <th className="py-2.5 px-3">Items Total</th>
                <th className="py-2.5 px-3">COD Total</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-3 text-white font-medium">
                    {ord.orderId}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <div className="font-semibold text-slate-200">{ord.customerName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{ord.phone}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-xs">{ord.deliveryAddress}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    ₹{ord.itemTotal.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-sky-400 font-bold">
                    ₹{ord.totalAmount.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      ord.status === 'DELIVERED_CASH_COLLECTED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : ord.status === 'REJECTED_RETURNED'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : ord.status === 'AWAITING_MERCHANT_APPROVAL'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    }`}>
                      {ord.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      {ord.status === 'AWAITING_MERCHANT_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleMerchantApproval(ord.orderId, true)}
                            className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded"
                            title="Approve Order"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMerchantApproval(ord.orderId, false)}
                            className="p-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded"
                            title="Reject / Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {ord.status === 'MERCHANT_APPROVED' && (
                        <button
                          onClick={() => handleUpdateDelivery(ord.orderId, 'DISPATCHED')}
                          className="px-2.5 py-1 bg-sky-600/20 text-sky-300 hover:bg-sky-600/30 border border-sky-500/30 rounded text-[11px] font-semibold"
                        >
                          Dispatch
                        </button>
                      )}

                      {ord.status === 'DISPATCHED' && (
                        <button
                          onClick={() => handleUpdateDelivery(ord.orderId, 'DELIVERED_CASH_COLLECTED')}
                          className="px-2.5 py-1 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-[11px] font-semibold"
                        >
                          Mark Delivered & Paid
                        </button>
                      )}

                      {ord.status === 'DELIVERED_CASH_COLLECTED' && (
                        <span className="text-[11px] text-emerald-400 font-semibold">Settled to Drawer</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Create New Cash on Delivery Order</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Delivery Address</label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Item Name</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg"
              >
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
