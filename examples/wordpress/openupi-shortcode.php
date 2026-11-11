<?php
/**
 * Plugin Name: OpenUPI Gateway WordPress Shortcode
 * Description: Embed direct UPI payment buttons on any WordPress post or page using [openupi_checkout].
 * Version: 1.0.0
 * Author: OpenUPI Engineering
 */

if (!defined('ABSPATH')) exit;

add_action('wp_enqueue_scripts', function() {
    $gateway_url = get_option('openupi_gateway_url', 'http://localhost:3000');
    wp_enqueue_script('openupi-sdk', rtrim($gateway_url, '/') . '/openupi.js', array(), '1.0.0', true);
});

// Shortcode: [openupi_checkout amount="499" order_id="WP-101" text="Pay with UPI"]
add_shortcode('openupi_checkout', function($atts) {
    $a = shortcode_atts(array(
        'amount'   => '100.00',
        'order_id' => 'WP-' . time(),
        'text'     => 'Pay with UPI',
        'name'     => get_bloginfo('name'),
    ), $atts);

    ob_start();
    ?>
    <button
        class="openupi-btn"
        data-openupi-checkout
        data-openupi-amount="<?php echo esc_attr($a['amount']); ?>"
        data-openupi-order-id="<?php echo esc_attr($a['order_id']); ?>"
        data-openupi-name="<?php echo esc_attr($a['name']); ?>"
        style="background:#0284c7; color:#fff; border:none; padding:10px 20px; border-radius:6px; font-weight:600; cursor:pointer;"
    >
        <?php echo esc_html($a['text']); ?> (₹<?php echo esc_html($a['amount']); ?>)
    </button>
    <?php
    return ob_get_clean();
});
