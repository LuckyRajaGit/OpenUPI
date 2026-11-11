<?php
/**
 * Plugin Name: WooCommerce OpenUPI Gateway
 * Description: Direct Self-Hosted UPI Payment Gateway for WooCommerce.
 * Version: 1.2.0
 * Author: OpenUPI Core Team
 */

if (!defined('ABSPATH')) exit;

add_action('plugins_loaded', 'init_openupi_gateway_class');

function init_openupi_gateway_class() {
    class WC_Gateway_OpenUPI extends WC_Payment_Gateway {

        public function __construct() {
            $this->id                 = 'openupi';
            $this->icon               = '';
            $this->has_fields         = false;
            $this->method_title       = 'OpenUPI Direct Gateway';
            $this->method_description = 'Accept direct UPI collections with dynamic QR, intent apps, and zero intermediary fees.';

            $this->supports = array('products', 'refunds');

            $this->init_form_fields();
            $this->init_settings();

            $this->title          = $this->get_option('title');
            $this->description    = $this->get_option('description');
            $this->enabled        = $this->get_option('enabled');
            $this->gateway_url    = rtrim($this->get_option('gateway_url'), '/');
            $this->api_key        = $this->get_option('api_key');
            $this->webhook_secret = $this->get_option('webhook_secret');

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            add_action('woocommerce_api_wc_gateway_openupi', array($this, 'check_webhook_response'));
        }

        public function init_form_fields() {
            $this->form_fields = array(
                'enabled' => array(
                    'title'   => 'Enable/Disable',
                    'type'    => 'checkbox',
                    'label'   => 'Enable OpenUPI Gateway',
                    'default' => 'yes'
                ),
                'title' => array(
                    'title'       => 'Title',
                    'type'        => 'text',
                    'description' => 'Payment method title displayed during checkout.',
                    'default'     => 'Direct UPI (GPay, PhonePe, Paytm, BHIM)',
                    'desc_tip'    => true,
                ),
                'gateway_url' => array(
                    'title'       => 'Gateway Endpoint URL',
                    'type'        => 'text',
                    'description' => 'Base URL where OpenUPI Gateway server is hosted (e.g. https://pay.mybrand.in).',
                    'default'     => 'http://localhost:3000'
                ),
                'api_key' => array(
                    'title'       => 'Merchant API Key',
                    'type'        => 'password',
                    'description' => 'Your private OpenUPI API key (Bearer token). Kept securely in WordPress database.',
                ),
                'webhook_secret' => array(
                    'title'       => 'Webhook Secret Key',
                    'type'        => 'password',
                    'description' => 'Secret used to cryptographically verify HMAC-SHA256 signatures.',
                ),
            );
        }

        public function process_payment($order_id) {
            $order = wc_get_order($order_id);

            $payload = array(
                'orderId'       => 'WC-' . $order->get_id(),
                'amount'        => (float)$order->get_total(),
                'currency'      => $order->get_currency(),
                'customerName'  => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'customerPhone' => $order->get_billing_phone(),
                'method'        => 'UPI_QR',
            );

            $response = wp_remote_post($this->gateway_url . '/api/v1/sessions', array(
                'method'    => 'POST',
                'headers'   => array(
                    'Content-Type'    => 'application/json',
                    'Authorization'   => 'Bearer ' . $this->api_key,
                    'Idempotency-Key' => 'WC-' . $order->get_id(),
                ),
                'body'      => json_encode($payload),
                'timeout'   => 15,
            ));

            if (is_wp_error($response)) {
                wc_add_notice('Connection error to OpenUPI Gateway: ' . $response->get_error_message(), 'error');
                return;
            }

            $body = json_decode(wp_remote_retrieve_body($response), true);
            if (empty($body['session'])) {
                wc_add_notice('Failed to initiate UPI session: ' . ($body['error'] ?? 'Unknown error'), 'error');
                return;
            }

            $session_id = $body['session']['id'];
            $order->update_meta_data('_openupi_session_id', $session_id);
            $order->save();

            // Return redirect URL or open modal checkout
            return array(
                'result'   => 'success',
                'redirect' => $order->get_checkout_payment_url(true),
            );
        }

        public function process_refund($order_id, $amount = null, $reason = '') {
            $order = wc_get_order($order_id);
            $session_id = $order->get_meta('_openupi_session_id');

            if (!$session_id) {
                return new WP_Error('error', 'No OpenUPI transaction reference found on order.');
            }

            $response = wp_remote_post($this->gateway_url . '/api/v1/sessions/' . $session_id . '/refund', array(
                'method'    => 'POST',
                'headers'   => array(
                    'Content-Type'    => 'application/json',
                    'Authorization'   => 'Bearer ' . $this->api_key,
                    'Idempotency-Key' => 'REF-' . $order_id . '-' . time(),
                ),
                'body'      => json_encode(array(
                    'amount' => (float)$amount,
                    'reason' => $reason ?: 'WooCommerce admin refund',
                )),
                'timeout'   => 15,
            ));

            if (is_wp_error($response)) {
                return $response;
            }

            $body = json_decode(wp_remote_retrieve_body($response), true);
            if (empty($body['success'])) {
                return new WP_Error('error', $body['error'] ?? 'Refund failed at gateway.');
            }

            $order->add_order_note(sprintf('OpenUPI Refund processed: ₹%s (Ref: %s)', $amount, $body['refund']['id']));
            return true;
        }

        public function check_webhook_response() {
            $raw_payload = file_get_contents('php://input');
            $sig_header  = $_SERVER['HTTP_X_OPENUPI_SIGNATURE'] ?? '';

            if (empty($raw_payload) || empty($sig_header)) {
                status_header(400);
                exit('Missing payload or signature');
            }

            // Verify timestamped HMAC-SHA256 signature
            $parts = explode(',', $sig_header);
            $timestamp = null;
            $received_sig = null;
            foreach ($parts as $part) {
                list($k, $v) = explode('=', trim($part), 2);
                if ($k === 't') $timestamp = (int)$v;
                if ($k === 'v1') $received_sig = $v;
            }

            // Replay protection window (300 seconds)
            if ($timestamp && abs(time() - $timestamp) > 300) {
                status_header(400);
                exit('Replay window exceeded');
            }

            $expected_sig = hash_hmac('sha256', $timestamp . '.' . $raw_payload, $this->webhook_secret);
            if (!hash_equals($expected_sig, $received_sig)) {
                status_header(401);
                exit('Signature mismatch');
            }

            $event = json_decode($raw_payload, true);
            if ($event['event'] === 'payment.success') {
                $order_id_clean = str_replace('WC-', '', $event['orderId']);
                $order = wc_get_order($order_id_clean);
                if ($order && !$order->is_paid()) {
                    $order->payment_complete($event['sessionId']);
                    $order->add_order_note(sprintf('UPI payment verified via OpenUPI Gateway. Amount: ₹%s', $event['amount']));
                }
            }

            status_header(200);
            exit('OK');
        }
    }
}

add_filter('woocommerce_payment_gateways', function($methods) {
    $methods[] = 'WC_Gateway_OpenUPI';
    return $methods;
});
