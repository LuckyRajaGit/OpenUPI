<?php
/**
 * OpenUPI Gateway - PHP Signature-Verified Webhook Handler
 */

$webhookSecret = getenv('OPENUPI_WEBHOOK_SECRET') ?: 'whsec_a891f7c239401829e1';

// Read raw body exactly as received - do NOT format or alter
$rawPayload = file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_X_OPENUPI_SIGNATURE'] ?? '';

if (empty($signatureHeader) || empty($rawPayload)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing signature or payload']);
    exit;
}

// Parse signature header: t=<timestamp>,v1=<signature>
$timestamp = null;
$receivedSignature = null;

$parts = explode(',', $signatureHeader);
foreach ($parts as $part) {
    list($k, $v) = explode('=', trim($part), 2);
    if ($k === 't') $timestamp = (int)$v;
    if ($k === 'v1') $receivedSignature = $v;
}

// 1. Replay Prevention: Check timestamp within 300 seconds
if ($timestamp && abs(time() - $timestamp) > 300) {
    http_response_code(400);
    echo json_encode(['error' => 'Webhook timestamp rejected: replay window exceeded']);
    exit;
}

// 2. Cryptographic Timing-Safe Signature Verification
$expectedSignature = hash_hmac('sha256', $timestamp . '.' . $rawPayload, $webhookSecret);

if (!hash_equals($expectedSignature, $receivedSignature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid webhook signature']);
    exit;
}

// 3. Process Verified Event
$event = json_decode($rawPayload, true);

if ($event['event'] === 'payment.success') {
    $orderId = $event['orderId'];
    $amount  = $event['amount'];
    $txnId   = $event['sessionId'];

    // TODO: Update your database status to PAID, fulfill order, trigger email
    // update_order_status($orderId, 'PAID', $txnId);
}

http_response_code(200);
echo json_encode(['status' => 'received']);
