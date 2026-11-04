<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

carioca_require_post();
$config = carioca_config();
carioca_authenticate($config);

$sku = strtoupper(trim((string)($_POST['sku'] ?? '')));
$slot = (int)($_POST['slot'] ?? 0);

if (!carioca_valid_sku($sku) || !carioca_valid_slot($slot)) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_PRODUCT_REFERENCE',
    ]);
}

$productDir = dirname(__DIR__) . '/media/productos/' . $sku;
$removed = is_dir($productDir)
    ? carioca_remove_slot_files($productDir, $sku, $slot)
    : [];

carioca_json(200, [
    'ok' => true,
    'api_version' => CARIOCA_API_VERSION,
    'sku' => $sku,
    'slot' => $slot,
    'removed' => $removed,
]);
