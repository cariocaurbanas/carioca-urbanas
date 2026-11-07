<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

carioca_require_post();
$config = carioca_config();
carioca_authenticate($config);

$sku = strtoupper(trim((string)($_POST['sku'] ?? '')));
$slot = (int)($_POST['slot'] ?? 0);
$keep = basename(trim((string)($_POST['keep_file'] ?? '')));

if (!carioca_valid_sku($sku) || !carioca_valid_slot($slot)) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_PRODUCT_REFERENCE',
    ]);
}

$expectedPrefix = sprintf('%s-%02d-', $sku, $slot);
if (
    $keep === '' ||
    preg_match(
        '/^' . preg_quote($expectedPrefix, '/') . '[A-Za-z0-9_-]{6,40}\\.(?:jpg|png|webp|avif)$/',
        $keep
    ) !== 1
) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_KEEP_FILE',
    ]);
}

$productDir = dirname(__DIR__) . '/media/productos/' . $sku;

// Never remove previously published images unless the replacement exists.
// This also makes repeated cleanup requests safe if the new file was removed.
if (!is_file($productDir . '/' . $keep)) {
    carioca_json(409, [
        'ok' => false,
        'error' => 'KEEP_FILE_NOT_FOUND',
    ]);
}

$removed = [];

if (is_dir($productDir)) {
    foreach (glob($productDir . '/' . $sku . '-' . sprintf('%02d', $slot) . '-*') ?: [] as $candidate) {
        if (!is_file($candidate) || basename($candidate) === $keep) {
            continue;
        }

        if (@unlink($candidate)) {
            $removed[] = basename($candidate);
        }
    }
}

carioca_json(200, [
    'ok' => true,
    'api_version' => CARIOCA_API_VERSION,
    'sku' => $sku,
    'slot' => $slot,
    'kept' => $keep,
    'removed' => $removed,
]);
