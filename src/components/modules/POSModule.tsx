import React, { useState, useEffect } from 'react';
import { CreditCard, Banknote, QrCode, Receipt, CheckCircle2, RotateCcw, Plus, Trash2, Printer, Calculator } from 'lucide-react';
import { POSTransaction, EDCTerminalState } from '../../types/index.ts';

export const POSModule: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [items, setItems] = useState<Array<{ name: string; qty: number; price: number }>>([
    { name: 'Espresso Roast Beans 500g', qty: 1, price: 650 },
    { name: 'Oat Milk Barista Edition 1L', qty: 2, price: 320 },
  ]);

  const [cashTendered, setCashTendered] = useState<string>('500');
  const [splitCash, setSplitCash] = useState<string>('354.50');
  const [splitCard, setSplitCard] = useState<string>('1000.00');
  const [splitUpi, setSplitUpi] = useState<string>('0');
  const [selectedReceipt, setSelectedReceipt] = useState<POSTransaction | null>(null);

  const [edcTerminal, setEdcTerminal] = useState<EDCTerminalState>({
    terminalId: 'EDC-PINE-9842',
    status: 'IDLE',
    amount: 0,
    message: 'Ready for transaction',
  });
  const [isProcessingCard, setIsProcessingCard] = useState(false);

  const fetchData = async () => {
    try {
      const [resS, resT] = await Promise.all([
        fetch('/api/v1/pos/summary'),
        fetch('/api/v1/pos/transactions'),
      ]);
      const dataS = await resS.json();
      const dataT = await resT.json();
      if (dataS) {
        setSummary(dataS);
        if (dataS.edcTerminal) setEdcTerminal(dataS.edcTerminal);
      }
      if (dataT && dataT.transactions) setTransactions(dataT.transactions);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const billTotal = subtotal + tax;

  const handleChargeCardEDC = async () => {
    const cardAmt = parseFloat(splitCard || '0');
    if (cardAmt <= 0) return;
    setIsProcessingCard(true);
    try {
      const res = await fetch('/api/v1/pos/edc/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cardAmt }),
      });
      const data = await res.json();
      setEdcTerminal(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingCard(false);
    }
  };

  const handleResetEDC = async () => {
    try {
      const res = await fetch('/api/v1/pos/edc/reset', { method: 'POST' });
      const data = await res.json();
      setEdcTerminal(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteSale = async () => {
    const cAmount = parseFloat(splitCash || '0');
    const cTendered = parseFloat(cashTendered || '0');
    const cardAmount = parseFloat(splitCard || '0');
    const upiAmount = parseFloat(splitUpi || '0');
    const change = Math.max(0, cTendered - cAmount);

    try {
      const res = await fetch('/api/v1/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          splitTender: {
            cashAmount: cAmount,
            cashTendered: cTendered,
            changeReturned: change,
            cardAmount,
            cardAuthCode: edcTerminal.authCode || 'AUTH-' + Math.floor(1000 + Math.random() * 9000),
            cardRRN: edcTerminal.rrn || 'RRN-' + Date.now().toString().slice(-8),
            upiAmount,
            upiRefId: upiAmount > 0 ? 'UPI-POS-' + Date.now().toString().slice(-6) : undefined,
          },
        }),
      });
      const data = await res.json();
      if (data && data.transaction) {
        setSelectedReceipt(data.transaction);
        // Reset cart for next customer
        setItems([
          { name: 'Specialty Cold Brew Bottle (330ml)', qty: 2, price: 180 },
        ]);
        fetchData();
        handleResetEDC();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addItemToCart = (name: string, price: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing) {
        return prev.map((i) => (i.name === name ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { name, qty: 1, price }];
    });
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Module 07
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Offline Retail POS & Cash Counter</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Cashier Register & Split Tender Payment Terminal
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            High-speed physical checkout counter for in-store sales. Supports mixed split payments across Cash, integrated external EDC card terminals, and dynamic UPI QR, maintaining real-time register drawer balance.
          </p>
        </div>
      </div>

      {/* Cashier Shift Status Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Cash in Drawer</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              ₹{summary.currentCashInDrawer.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Float: ₹{summary.openingFloat}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Today's Total Sales</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              ₹{summary.totalSales.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{summary.todayTransactionCount} receipts issued</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Card EDC Swipes</div>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
              ₹{summary.breakdown.card.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Electronic settlement</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">In-Store UPI QR</div>
            <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
              ₹{summary.breakdown.upi.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Direct bank credit</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cashier Counter Register */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-sky-400" />
                Current Sale Register Cart
              </h3>
              <div className="flex gap-1.5">
                <button
                  onClick={() => addItemToCart('Single Origin Pour-over', 220)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  + Add Coffee (₹220)
                </button>
                <button
                  onClick={() => addItemToCart('Artisan Croissant', 140)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  + Add Pastry (₹140)
                </button>
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-sans text-white">{item.name}</td>
                      <td className="py-2 px-3 text-slate-300">{item.qty}</td>
                      <td className="py-2 px-3 text-right text-slate-300">₹{item.price.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-sky-400 font-bold">
                        ₹{(item.qty * item.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex justify-between items-center text-xs">
                <div className="text-slate-400">GST Tax (5%): ₹{tax.toFixed(2)}</div>
                <div className="text-base font-bold text-white font-mono">
                  Bill Total: <span className="text-sky-400">₹{billTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Split Tender Controls */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-semibold text-slate-300">Split Tender Breakdown</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-emerald-400" /> Cash Amount
                  </label>
                  <input
                    type="number"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-sky-400" /> Card (EDC)
                  </label>
                  <input
                    type="number"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-purple-400" /> Counter UPI QR
                  </label>
                  <input
                    type="number"
                    value={splitUpi}
                    onChange={(e) => setSplitUpi(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Cash tendered & change calculator */}
              {parseFloat(splitCash || '0') > 0 && (
                <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400">Cash Received from Customer:</span>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-white"
                  />
                  <span className="ml-auto text-emerald-400 font-mono font-bold">
                    Change to Return: ₹{Math.max(0, parseFloat(cashTendered || '0') - parseFloat(splitCash || '0')).toFixed(2)}
                  </span>
                </div>
              )}

              <button
                onClick={handleCompleteSale}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-sky-600/20"
              >
                <Receipt className="w-4 h-4" />
                <span>Complete Sale & Issue Receipt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: EDC Terminal Integration & Recent Receipts */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Terminal Simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-400" />
                External Card EDC Terminal
              </h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                edcTerminal.status === 'APPROVED'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {edcTerminal.terminalId} · {edcTerminal.status}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs space-y-1">
              <div className="text-slate-400">Status Message:</div>
              <div className="text-white font-semibold">{edcTerminal.message}</div>
              {edcTerminal.authCode && (
                <div className="text-emerald-400 text-[11px] pt-1">
                  Auth Code: {edcTerminal.authCode} · RRN: {edcTerminal.rrn}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleChargeCardEDC}
                disabled={isProcessingCard}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold"
              >
                {isProcessingCard ? 'Contacting EMV...' : `Trigger Card Auth (₹${splitCard})`}
              </button>
              <button
                onClick={handleResetEDC}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Transactions Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Counter Transaction Records</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  onClick={() => setSelectedReceipt(txn)}
                  className="p-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-mono text-white font-semibold">{txn.receiptNumber}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(txn.timestamp).toLocaleTimeString()} · {txn.items.length} items
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sky-400 font-bold">₹{txn.total.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400">
                      {txn.splitTender.cashAmount > 0 && 'Cash '}
                      {txn.splitTender.cardAmount > 0 && 'Card '}
                      {txn.splitTender.upiAmount > 0 && 'UPI'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* POS Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white text-slate-900 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold text-base font-sans">OpenUPI Retail Counter</div>
              <div className="text-[11px] text-slate-500 font-sans">Tax Invoice / Cash Memo</div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Receipt: {selectedReceipt.receiptNumber}
              </div>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
              {selectedReceipt.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.qty}x {it.name}</span>
                  <span className="font-bold">₹{(it.qty * it.price).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-slate-500 pt-1">
                <span>Tax (5% GST):</span>
                <span>₹{selectedReceipt.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200">
                <span>Total Amount:</span>
                <span>₹{selectedReceipt.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] text-slate-600 border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold text-slate-800">Tender Summary:</div>
              {selectedReceipt.splitTender.cashAmount > 0 && (
                <div className="flex justify-between">
                  <span>Cash Paid:</span>
                  <span>₹{selectedReceipt.splitTender.cashAmount.toFixed(2)}</span>
                </div>
              )}
              {selectedReceipt.splitTender.cardAmount > 0 && (
                <div className="flex justify-between">
                  <span>Card Auth ({selectedReceipt.splitTender.cardAuthCode}):</span>
                  <span>₹{selectedReceipt.splitTender.cardAmount.toFixed(2)}</span>
                </div>
              )}
              {selectedReceipt.splitTender.upiAmount > 0 && (
                <div className="flex justify-between">
                  <span>UPI Payment:</span>
                  <span>₹{selectedReceipt.splitTender.upiAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="text-center text-[10px] text-slate-500">
              Thank you for shopping! Powered by OpenUPI Sovereign POS.
            </div>

            <button
              onClick={() => setSelectedReceipt(null)}
              className="w-full py-2 bg-slate-900 text-white rounded text-xs font-semibold font-sans"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
