# Carioca Urbanas — Migración Drive + Hostinger

## Estado base auditado
Repositorio: `cariocaurbanas/carioca-urbanas`
Rama productiva: `main`
Rama de trabajo: `migration-drive-hostinger`

### Arquitectura actual
1. Carioca Manager (Apps Script) guarda datos de producto en Google Sheets.
2. Carioca Core valida y publica `Web_CSV`.
3. La web lee el CSV publicado de Google Sheets.
4. `foto_1` a `foto_5` son URLs externas.
5. El sitio público está desplegado en GitHub Pages.

### Hallazgos confirmados
- El Manager actual no sube imágenes: solicita URLs en `foto_1` a `foto_5`.
- La interfaz todavía identifica ese bloque como "Imágenes de Cloudinary".
- Core valida `foto_1` como URL HTTP/HTTPS y exporta las cinco fotos a `Web_CSV`.
- La web arma la galería desde `foto_1` a `foto_5`.
- `index.html` y `producto.html` todavía tienen `preconnect` a Cloudinary.
- `index.html`, `robots.txt` y `sitemap.xml` contienen URLs antiguas de GitHub Pages.
- `DEPLOY_GITHUB.txt` documenta un repositorio/ruta anterior (`cariocaurbanasweb`), no el repositorio actual.
- `config.js` apunta al CSV correcto de Core 3.0.
- La prioridad de ofertas está implementada en `catalog.js`.

## Principios de la migración
1. No modificar `main` hasta completar pruebas.
2. No tocar fórmulas económicas ni el contrato de precios de Core 3.0.
3. Google Drive será el repositorio maestro de imágenes.
4. Las imágenes web no dependerán de URLs temporales de miniaturas de Drive.
5. Hostinger será la capa pública de entrega del sitio y de las copias optimizadas para web.
6. Mantener rollback simple durante toda la migración.

## Arquitectura objetivo
```
Carioca Manager
      |
      v
Google Drive (originales)
      |
      v
Google Sheets / Core 3.x
      |
      v
Web_CSV
      |
      v
Hostinger (sitio + copias web de imágenes)
      |
      v
Dominio definitivo
```

## Estructura propuesta en Drive
```
CARIOCA_URBANAS/
  PRODUCTOS/
    CU-000001/
      CU-000001-01.jpg
      CU-000001-02.jpg
      CU-000001-03.jpg
    CU-000002/
      ...
```

## Modelo de datos propuesto
Conservar temporalmente `foto_1` a `foto_5` para compatibilidad.

Agregar:
- `drive_foto_1_id`
- `drive_foto_2_id`
- `drive_foto_3_id`
- `drive_foto_4_id`
- `drive_foto_5_id`

Opcional para control:
- `imagenes_sync_estado`
- `imagenes_sync_fecha`

Los IDs de Drive identifican los originales. Las URLs públicas para la web se generan por separado.

## Manager 3.1 — objetivo
Reemplazar campos URL por selectores de archivo:
- Foto principal
- Foto 2
- Foto 3
- Foto 4
- Foto 5

Al guardar:
1. Validar tipo y tamaño.
2. Crear/ubicar carpeta por SKU.
3. Subir archivos a Drive.
4. Nombrarlos de forma determinista.
5. Guardar IDs de Drive.
6. Mostrar previews.
7. Permitir reemplazar/eliminar una foto sin afectar las demás.

## Web / Hostinger
Antes del cambio de dominio:
- corregir canonical;
- corregir og:url;
- corregir og:image;
- eliminar preconnect de Cloudinary;
- corregir robots.txt;
- corregir sitemap.xml;
- mantener rutas relativas;
- definir estrategia de URLs de producto;
- configurar staging de Hostinger;
- probar cache y fallback del catálogo.

## Fases
### Fase A — Auditoría y aislamiento
- rama separada;
- inventario completo;
- no modificar producción.

### Fase B — Drive
- carpeta raíz;
- estructura por SKU;
- upload desde Manager;
- columnas de IDs;
- prueba con un producto borrador.

### Fase C — Sincronización web
- generar copias optimizadas para Hostinger;
- publicar rutas web estables;
- mantener Drive como original.

### Fase D — Migración de imágenes existentes
- copiar desde URLs actuales;
- verificar 1 a 5 imágenes por SKU;
- no borrar origen anterior hasta completar control.

### Fase E — Hostinger staging
- desplegar rama de migración;
- configurar dominio/staging;
- probar catálogo, producto, imágenes, WhatsApp, filtros, oferta y móvil.

### Fase F — Corte final
- backup;
- sincronización final;
- cambiar dominio;
- actualizar SEO;
- smoke test;
- mantener rollback disponible.

## Invariantes que no se tocan
- SKU existente.
- Modelo económico Core 3.0.
- Validación estricta.
- Publicación de Web_CSV.
- Oferta primero.
- Flujo de compra por WhatsApp.
