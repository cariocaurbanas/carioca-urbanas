<?php
declare(strict_types=1);

return [
    // Copiar este archivo como config.php y reemplazar por un secreto largo.
    'api_token' => 'CHANGE_ME_WITH_A_LONG_RANDOM_SECRET',

    // Dominio final, sin barra al final. En staging usar el subdominio correspondiente.
    'public_base_url' => 'https://www.cariocaurbanas.com',

    // Límite por imagen recibida desde Carioca Manager.
    'max_image_bytes' => 15 * 1024 * 1024,

    // Tipos aceptados. La extensión final se deriva del MIME real del archivo.
    'image_mime_types' => [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/avif' => 'avif',
    ],
];
