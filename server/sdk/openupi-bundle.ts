/**
 * OpenUPI Universal JavaScript SDK Bundle Generator
 * Returns the raw JavaScript string served directly at /openupi.js
 */
export function getOpenUpiBundleJs(): string {
  return `/**
 * OpenUPI Gateway Universal SDK v1.0.0
 * Zero-dependency UPI Checkout Modal & Mobile Drawer
 * (C) 2026 OpenUPI Platform
 */
(function(window, document) {
  'use strict';

  if (window.OpenUPI) return;

  var config = {
    endpoint: window.location.origin,
    merchantId: 'mer_openupi_01',
    themeColor: '#0284c7'
  };

  var activeSession = null;
  var pollInterval = null;
  var modalEl = null;

  var OpenUPI = {
    version: '1.0.0',

    configure: function(options) {
      if (!options) return;
      if (options.endpoint) config.endpoint = options.endpoint;
      if (options.merchantId) config.merchantId = options.merchantId;
      if (options.themeColor) config.themeColor = options.themeColor;
      return this;
    },

    open: function(options) {
      if (!options || !options.amount) {
        console.error('[OpenUPI] Amount is required to open checkout session.');
        if (options && options.onFailure) options.onFailure({ error: 'Amount is required' });
        return;
      }

      var orderId = options.orderId || ('ORD_' + Date.now());
      var callbacks = {
        onOpen: options.onOpen || function() {},
        onSuccess: options.onSuccess || function() {},
        onFailure: options.onFailure || function() {},
        onClose: options.onClose || function() {},
        onQueueWait: options.onQueueWait || function() {}
      };

      callbacks.onOpen();

      // Call OpenUPI Gateway API to create or acquire session
      fetch(config.endpoint + '/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: options.amount,
          orderId: orderId,
          customerName: options.name || 'Valued Customer',
          customerPhone: options.phone || '',
          method: 'UPI_QR'
        })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.session) {
          throw new Error(data.error || 'Failed to initialize payment session');
        }

        activeSession = data.session;
        renderCheckoutUI(data.session, data.intents, callbacks, options);

        if (data.session.status === 'QUEUED') {
          callbacks.onQueueWait({
            position: data.session.queuePosition || 1,
            sessionId: data.session.id
          });
        }

        startPolling(data.session.id, callbacks);
      })
      .catch(function(err) {
        console.error('[OpenUPI] Checkout init error:', err);
        callbacks.onFailure({ error: err.message });
      });
    },

    close: function() {
      if (pollInterval) clearInterval(pollInterval);
      if (modalEl && modalEl.parentNode) {
        modalEl.parentNode.removeChild(modalEl);
      }
      modalEl = null;
      activeSession = null;
    }
  };

  function startPolling(sessionId, callbacks) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(function() {
      fetch(config.endpoint + '/api/v1/sessions/' + sessionId + '/status')
        .then(function(res) { return res.json(); })
        .then(function(resData) {
          if (!resData || !resData.session) return;
          var session = resData.session;

          // Update UI if queue status changed to ACTIVE
          var queueBanner = document.getElementById('openupi-queue-banner');
          if (queueBanner) {
            if (session.status === 'ACTIVE') {
              queueBanner.style.display = 'none';
            } else if (session.status === 'QUEUED') {
              queueBanner.innerText = 'Position in queue: #' + (session.queuePosition || 1);
            }
          }

          if (session.status === 'PAID') {
            clearInterval(pollInterval);
            renderSuccessState(session, callbacks);
          } else if (session.status === 'EXPIRED') {
            clearInterval(pollInterval);
            renderExpiredState(callbacks);
          }
        })
        .catch(function(err) {
          console.warn('[OpenUPI] Polling warning:', err);
        });
    }, 2000);
  }

  function renderSuccessState(session, callbacks) {
    var contentEl = document.getElementById('openupi-modal-content');
    if (contentEl) {
      contentEl.innerHTML = 
        '<div style="text-align:center; padding: 28px 16px;">' +
          '<div style="width: 56px; height: 56px; border-radius: 50%; background: #dcfce7; color: #15803d; font-size: 28px; line-height: 56px; margin: 0 auto 16px; font-weight: bold;">✓</div>' +
          '<h3 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 6px;">Payment Successful!</h3>' +
          '<p style="color: #64748b; font-size: 14px; margin: 0 0 16px;">₹' + session.amount.toFixed(2) + ' received via UPI</p>' +
          '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; text-align: left; font-size: 13px;">' +
            '<div style="color: #64748b; margin-bottom: 4px;">Order ID: <span style="font-family: monospace; color: #0f172a; font-weight: 600;">' + session.orderId + '</span></div>' +
            '<div style="color: #64748b;">Transaction Ref: <span style="font-family: monospace; color: #0f172a; font-weight: 600;">' + session.id + '</span></div>' +
          '</div>' +
          '<button id="openupi-finish-btn" style="width: 100%; background: #0f172a; color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Done</button>' +
        '</div>';

      var finishBtn = document.getElementById('openupi-finish-btn');
      if (finishBtn) {
        finishBtn.onclick = function() {
          OpenUPI.close();
          callbacks.onSuccess({
            paymentId: session.id,
            orderId: session.orderId,
            amount: session.amount,
            method: 'UPI'
          });
        };
      }
    }
  }

  function renderExpiredState(callbacks) {
    var contentEl = document.getElementById('openupi-modal-content');
    if (contentEl) {
      contentEl.innerHTML = 
        '<div style="text-align:center; padding: 28px 16px;">' +
          '<div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #b91c1c; font-size: 28px; line-height: 56px; margin: 0 auto 16px;">✕</div>' +
          '<h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">QR Code Expired</h3>' +
          '<p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">The payment session has timed out for security.</p>' +
          '<button id="openupi-close-exp-btn" style="width: 100%; background: #64748b; color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Close</button>' +
        '</div>';

      var btn = document.getElementById('openupi-close-exp-btn');
      if (btn) {
        btn.onclick = function() {
          OpenUPI.close();
          callbacks.onFailure({ error: 'Session expired' });
        };
      }
    }
  }

  function renderCheckoutUI(session, intents, callbacks, options) {
    if (modalEl) OpenUPI.close();

    var primaryColor = (options && options.themeColor) || config.themeColor || '#0284c7';

    var container = document.createElement('div');
    container.id = 'openupi-checkout-root';
    container.innerHTML = 
      '<div id="openupi-backdrop" style="position:fixed; inset:0; background:rgba(15,23,42,0.65); z-index:999990; backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px;">' +
        '<div id="openupi-sheet" style="background:#ffffff; width:100%; max-width:440px; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); position:relative; font-family:-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;">' +
          
          '<!-- Header -->' +
          '<div style="background:#0f172a; color:#fff; padding:18px 20px; display:flex; align-items:center; justify-content:between;">' +
            '<div style="display:flex; align-items:center; gap:10px;">' +
              '<div style="width:30px; height:30px; border-radius:6px; background:' + primaryColor + '; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px; color:#fff;">U</div>' +
              '<div>' +
                '<div style="font-weight:700; font-size:15px; letter-spacing:-0.01em;">OpenUPI Checkout</div>' +
                '<div style="font-size:11px; color:#94a3b8;">Direct Merchant Settlement</div>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex; align-items:center; gap:12px; margin-left:auto;">' +
              '<div style="text-align:right;">' +
                '<div style="font-size:11px; color:#94a3b8;">Amount</div>' +
                '<div style="font-size:16px; font-weight:700; color:#38bdf8; font-family:monospace;">₹' + session.amount.toFixed(2) + '</div>' +
              '</div>' +
              '<button id="openupi-close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer; padding:4px 8px; line-height:1;">✕</button>' +
            '</div>' +
          '</div>' +

          '<!-- Queue Banner (if queued) -->' +
          '<div id="openupi-queue-banner" style="' + (session.status === 'QUEUED' ? 'display:block;' : 'display:none;') + ' background:#fef3c7; color:#92400e; padding:8px 16px; font-size:12px; font-weight:600; border-bottom:1px solid #fde68a;">' +
            'High traffic: Waiting in payment queue (Position #' + (session.queuePosition || 1) + ')' +
          '</div>' +

          '<!-- Body -->' +
          '<div id="openupi-modal-content" style="padding:20px;">' +
            
            '<!-- QR Code Area -->' +
            '<div style="text-align:center; margin-bottom:16px;">' +
              '<div style="display:inline-block; padding:10px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.04);">' +
                '<img src="' + session.qrDataUrl + '" alt="UPI QR" style="width:200px; height:200px; display:block; margin:0 auto;" />' +
              '</div>' +
              '<div style="font-size:12px; color:#64748b; margin-top:8px;">Scan with Any UPI App (GPay, PhonePe, Paytm, BHIM)</div>' +
            '</div>' +

            '<!-- Mobile Intent Direct Buttons -->' +
            '<div style="margin-bottom:16px;">' +
              '<div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:8px; text-align:center;">Or Pay via Mobile App</div>' +
              '<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">' +
                '<a href="' + (intents.gpay || session.upiUri) + '" style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:8px 4px; text-align:center; text-decoration:none; color:#0f172a; font-size:11px; font-weight:600; display:block;">GPay</a>' +
                '<a href="' + (intents.phonepe || session.upiUri) + '" style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:8px 4px; text-align:center; text-decoration:none; color:#0f172a; font-size:11px; font-weight:600; display:block;">PhonePe</a>' +
                '<a href="' + (intents.paytm || session.upiUri) + '" style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:8px 4px; text-align:center; text-decoration:none; color:#0f172a; font-size:11px; font-weight:600; display:block;">Paytm</a>' +
                '<a href="' + session.upiUri + '" style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:8px 4px; text-align:center; text-decoration:none; color:#0f172a; font-size:11px; font-weight:600; display:block;">BHIM</a>' +
              '</div>' +
            '</div>' +

            '<!-- Mock Simulation Pay Button (for sandbox) -->' +
            '<button id="openupi-simulate-pay-btn" style="width:100%; background:' + primaryColor + '; color:#fff; border:none; padding:11px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:opacity 0.15s;">' +
              '⚡ Simulate Customer UPI Approval' +
            '</button>' +

            '<div style="text-align:center; margin-top:12px; font-size:11px; color:#94a3b8;">' +
              '🔒 Protected by OpenUPI Sovereign Engine · Zero Intermediary' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(container);
    modalEl = container;

    // Attach listeners
    var closeBtn = document.getElementById('openupi-close-btn');
    if (closeBtn) {
      closeBtn.onclick = function() {
        OpenUPI.close();
        callbacks.onClose();
      };
    }

    var backdrop = document.getElementById('openupi-backdrop');
    if (backdrop) {
      backdrop.onclick = function(e) {
        if (e.target === backdrop) {
          OpenUPI.close();
          callbacks.onClose();
        }
      };
    }

    var simBtn = document.getElementById('openupi-simulate-pay-btn');
    if (simBtn) {
      simBtn.onclick = function() {
        simBtn.disabled = true;
        simBtn.innerText = 'Processing UPI Settlement...';
        fetch(config.endpoint + '/api/v1/sessions/' + session.id + '/simulate-pay', {
          method: 'POST'
        });
      };
    }
  }

  // Automatic HTML Data Attribute Integration Scanner
  function autoBindDataAttributes() {
    var triggers = document.querySelectorAll('[data-openupi-checkout], [data-openupi-amount]');
    for (var i = 0; i < triggers.length; i++) {
      (function(el) {
        if (el.getAttribute('data-openupi-bound')) return;
        el.setAttribute('data-openupi-bound', 'true');
        el.addEventListener('click', function(e) {
          e.preventDefault();
          var amount = parseFloat(el.getAttribute('data-openupi-amount') || '0');
          var orderId = el.getAttribute('data-openupi-order-id') || ('ORD_' + Date.now());
          var name = el.getAttribute('data-openupi-name') || '';
          var phone = el.getAttribute('data-openupi-phone') || '';
          var theme = el.getAttribute('data-openupi-theme') || '';

          OpenUPI.open({
            amount: amount,
            orderId: orderId,
            name: name,
            phone: phone,
            themeColor: theme,
            onSuccess: function(detail) {
              var callbackName = el.getAttribute('data-openupi-success-callback');
              if (callbackName && typeof window[callbackName] === 'function') {
                window[callbackName](detail);
              }
            }
          });
        });
      })(triggers[i]);
    }
  }

  // Initialize auto-scanner on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBindDataAttributes);
  } else {
    autoBindDataAttributes();
  }

  // Export to global scope
  window.OpenUPI = OpenUPI;
  window.openupiAutoScan = autoBindDataAttributes;

})(window, document);
`;
}
