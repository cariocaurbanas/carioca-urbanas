<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

carioca_require_post();
$config = carioca_config();
carioca_authenticate($config);

$sku = strtoupper(trim((string)($_POST['sku'] ?? '')));
$slot = (int)($_POST['slot'] ?? 0);
$revision = trim((string)($_POST['revision'] ?? ''));

if (!carioca_valid_sku($sku) || !carioca_valid_slot($slot)) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_PRODUCT_REFERENCE',
    ]);
}

if (preg_match('/^[A-Za-z0-9_-]{6,40}$/', $revision) !== 1) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_REVISION',
    ]);
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'IMAGE_REQUIRED',
    ]);
}

$file = $_FILES['image'];
$error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);

if ($error !== UPLOAD_ERR_OK) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'UPLOAD_ERROR',
        'upload_error_code' => $error,
    ]);
}

$tmp = (string)($file['tmp_name'] ?? '');
$size = (int)($file['size'] ?? 0);
$maxBytes = (int)($config['max_image_bytes'] ?? (15 * 1024 * 1024));

if ($tmp === '' || !is_uploaded_file($tmp) || $size <= 0 || $size > $maxBytes) {
    carioca_json(422, [
        'ok' => false,
        'error' => 'INVALID_IMAGE_SIZE',
        'max_bytes' => $maxBytes,
    ]);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($tmp);
$allowed = (array)($config['image_mime_types'] ?? []);
$extension = $allowed[$mime] ?? null;

if (!$extension) {
    carioca_json(415, [
        'ok' => false,
        'error' => 'UNSUPPORTED_IMAGE_TYPE',
        'mime' => $mime,
    ]);
}

$root = dirname(__DIR__) . '/media/productos';
$productDir = $root . '/' . $sku;
carioca_ensure_dir($productDir);

// Versionado: nunca pisamos una imagen ya publicada durante el upload.
$fileName = sprintf('%s-%02d-%s.%s', $sku, $slot, $revision, $extension);
$target = $productDir . '/' . $fileName;

if (is_file($target)) {
    carioca_json(409, [
        'ok' => false,
        'error' => 'REVISION_ALREADY_EXISTS',
    ]);
}

if (!move_uploaded_file($tmp, $target)) {
    carioca_json(500, [
        'ok' => false,
        'error' => 'MOVE_FAILED',
    ]);
}

@chmod($target, 0644);

$baseUrl = rtrim((string)($config['public_base_url'] ?? ''), '/');
if ($baseUrl === '') {
    @unlink($target);
    carioca_json(500, [
        'ok' => false,
        'error' => 'PUBLIC_BASE_URL_MISSING',
    ]);
}

$url = $baseUrl . '/media/productos/' . rawurlencode($sku) . '/' . rawurlencode($fileName);

carioca_json(200, [
    'ok' => true,
    'api_version' => CARIOCA_API_VERSION,
    'sku' => $sku,
    'slot' => $slot,
    'revision' => $revision,
    'file' => $fileName,
    'mime' => $mime,
    'bytes' => filesize($target),
    'url' => $url,
]);
