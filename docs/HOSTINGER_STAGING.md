# Hostinger staging — Carioca Urbanas

Este directorio contiene la capa servidor prevista para la migración.

## API
- `api/upload-product-image.php`: recibe una imagen de producto.
- `api/delete-product-image.php`: elimina un slot de imagen.
- `api/publish-catalog.php`: publica `data/catalog.json` de forma atómica.

## Seguridad
1. Copiar `api/config.example.php` como `api/config.php`.
2. Definir un token largo y aleatorio.
3. `api/config.php` está ignorado por Git y no debe subirse al repositorio.
4. Todas las escrituras requieren cabecera `X-Carioca-Token`.

## Estructura pública
- `/media/productos/CU-000001/CU-000001-01.jpg`
- `/data/catalog.json`

## Estado
La API 1.0 fue validada localmente con PHP 8.4:
- autenticación 401 sin token;
- publicación JSON 200;
- subida de imagen 200;
- eliminación de imagen 200.

No está desplegada todavía en Hostinger.
