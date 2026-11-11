<?php
/**
 * OpenUPI Gateway - PHP Server-Side Payment Creation
 */

$gatewayUrl = getenv('OPENUPI_GATEWAY_URL') ?: 'http://localhost:3000';
$apiKey     = getenv('OPENUPI_API_KEY') ?: 'oup_test_8f294ba713cd4109b8';

// Order parameters
$orderId   = 'PHP-ORD-' . time();
$amount    = 850.00;
$custName  = 'Devika Nair';
$custPhone = '+91 98450 12345';

$payload = json_encode([
    'orderId'       => $orderId,
    'amount'        => $amount,
    'customerName'  => $custName,
    'customerPhone' => $custPhone,
    'method'        => 'UPI_QR'
]);

$ch = curl_init($gatewayUrl . '/api/v1/sessions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey,
    'Idempotency-Key: ' . $orderId
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true);

if ($httpCode !== 200 || !isset($data['session'])) {
    die("Error initializing payment: " . ($data['error'] ?? 'Unknown error'));
}

$session = $data['session'];
?>
<!DOCTYPE html>
<html>
<head>
    <title>PHP Checkout - OpenUPI</title>
    <script src="<?php echo htmlspecialchars($gatewayUrl); ?>/openupi.js"></script>
</head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
    <h2>Processing Order #<?php echo htmlspecialchars($session['orderId']); ?></h2>
    <p>Amount Payable: <strong>₹<?php echo number_format($session['amount'], 2); ?></strong></p>
    
    <button id="open-btn" style="background:#0284c7; color:#fff; border:none; padding:12px 24px; border-radius:8px; font-size:16px; cursor:pointer;">
        Open UPI Checkout
    </button>

    <script>
        document.getElementById('open-btn').addEventListener('click', function() {
            window.OpenUPI.open({
                amount: <?php echo json_encode($session['amount']); ?>,
                orderId: <?php echo json_encode($session['orderId']); ?>,
                onSuccess: function(res) {
                    window.location.href = "success.php?session_id=" + res.paymentId;
                },
                onFailure: function(err) {
                    alert("Payment failed: " + err.error);
                }
            });
        });
        // Auto trigger on load
        window.addEventListener('DOMContentLoaded', function() {
            document.getElementById('open-btn').click();
        });
    </script>
</body>
</html>
