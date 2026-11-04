<?php
declare(strict_types=1);

const CARIOCA_API_VERSION = '1.0.0';

function carioca_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function carioca_config(): array
{
    $file = __DIR__ . '/config.php';

    if (!is_file($file)) {
        carioca_json(500, [
            'ok' => false,
            'error' => 'API_NOT_CONFIGURED',
            'message' => 'Falta api/config.php.',
        ]);
    }

    $config = require $file;

    if (!is_array($config)) {
        carioca_json(500, [
            'ok' => false,
            'error' => 'INVALID_CONFIG',
        ]);
    }

    return $config;
}

function carioca_header(string $name): string
{
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string)($_SERVER[$serverKey] ?? ''));
}

function carioca_authenticate(array $config): void
{
    $expected = (string)($config['api_token'] ?? '');
    $received = carioca_header('X-Carioca-Token');

    if ($expected === '' || $received === '' || !hash_equals($expected, $received)) {
        carioca_json(401, [
            'ok' => false,
            'error' => 'UNAUTHORIZED',
        ]);
    }
}

function carioca_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        carioca_json(405, [
            'ok' => false,
            'error' => 'METHOD_NOT_ALLOWED',
        ]);
    }
}

function carioca_valid_sku(string $sku): bool
{
    return preg_match('/^CU-\\d{6}$/', $sku) === 1;
}

function carioca_valid_slot(int $slot): bool
{
    return $slot >= 1 && $slot <= 5;
}

function carioca_ensure_dir(string $path): void
{
    if (is_dir($path)) {
        return;
    }

    if (!mkdir($path, 0755, true) && !is_dir($path)) {
        carioca_json(500, [
            'ok' => false,
            'error' => 'DIRECTORY_CREATE_FAILED',
        ]);
    }
}

function carioca_remove_slot_files(string $directory, string $sku, int $slot): array
{
    $prefix = sprintf('%s-%02d.', $sku, $slot);
    $removed = [];

    foreach (glob($directory . '/' . $sku . '-' . sprintf('%02d', $slot) . '.*') ?: [] as $candidate) {
        if (!is_file($candidate)) {
            continue;
        }

        $name = basename($candidate);
        if (!str_starts_with($name, $prefix)) {
            continue;
        }

        if (@unlink($candidate)) {
            $removed[] = $name;
        }
    }

    return $removed;
}
