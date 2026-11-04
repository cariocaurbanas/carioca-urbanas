<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

carioca_require_post();
$config = carioca_config();
carioca_authenticate($config);

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    carioca_json(422, [
        'ok' => false,
        'error' => 'EMPTY_BODY',
    ]);
}

try {
    $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_JSON',
    ]);
}

if (!is_array($decoded)) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_CATALOG',
    ]);
}

$products = $decoded['products'] ?? null;
if (!is_array($products)) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'PRODUCTS_ARRAY_REQUIRED',
    ]);
}

foreach ($products as $index => $product) {
    if (!is_array($product)) {
        carioca_json(422, [
            'ok' => false,
            'error' => 'INVALID_PRODUCT',
            'index' => $index,
        ]);
    }

    $sku = strtoupper(trim((string)($product['sku'] ?? '')));
    if (!carioca_valid_sku($sku)) {
        carioca_json(422, [
            'ok' => false,
            'error' => 'INVALID_SKU',
            'index' => $index,
        ]);
    }
}

$dataDir = dirname(__DIR__) . '/data';
carioca_ensure_dir($dataDir);

$normalized = [
    'schemaVersion' => (string)($decoded['schemaVersion'] ?? '1'),
    'publishedAt' => (string)($decoded['publishedAt'] ?? gmdate('c')),
    'count' => count($products),
    'products' => $products,
];

$json = json_encode(
    $normalized,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
) . "\n";

$final = $dataDir . '/catalog.json';
$temp = $dataDir . '/catalog.json.tmp.' . bin2hex(random_bytes(6));

if (file_put_contents($temp, $json, LOCK_EX) === false) {
    carioca_json(500, [
        'ok' => false,
        'error' => 'CATALOG_WRITE_FAILED',
    ]);
}

@chmod($temp, 0644);

if (!rename($temp, $final)) {
    @unlink($temp);
    carioca_json(500, [
        'ok' => false,
        'error' => 'CATALOG_RENAME_FAILED',
    ]);
}

carioca_json(200, [
    'ok' => true,
    'api_version' => CARIOCA_API_VERSION,
    'count' => count($products),
    'publishedAt' => $normalized['publishedAt'],
    'path' => '/data/catalog.json',
]);
