<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

carioca_require_post();
$config = carioca_config();
carioca_authenticate($config);

$sku = strtoupper(trim((string)($_POST['sku'] ?? '')));
$slot = (int)($_POST['slot'] ?? 0);
$fileName = basename(trim((string)($_POST['file'] ?? '')));

if (!carioca_valid_sku($sku) || !carioca_valid_slot($slot)) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_PRODUCT_REFERENCE',
    ]);
}

$prefix = sprintf('%s-%02d-', $sku, $slot);
if ($fileName === '' || !str_starts_with($fileName, $prefix)) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_FILE',
    ]);
}

$target = dirname(__DIR__) . '/media/productos/' . $sku . '/' . $fileName;
$removed = false;

if (is_file($target)) {
    $removed = @unlink($target);
}

carioca_json(200, [
    'ok' => true,
    'api_version' => CARIOCA_API_VERSION,
    'sku' => $sku,
    'slot' => $slot,
    'file' => $fileName,
    'removed' => $removed,
]);
