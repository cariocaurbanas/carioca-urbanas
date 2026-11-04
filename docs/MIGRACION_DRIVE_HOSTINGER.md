# Carioca Urbanas — Migración Drive + Hostinger

## Estado base auditado
Repositorio: `cariocaurbanas/carioca-urbanas`
Rama productiva: `main`
Rama de trabajo: `migration-drive-hostinger`

## Recursos reales confirmados
- Google Sheet vivo: `CARIOCA CORE 3.0 - STAGING`
- Spreadsheet ID: `1SvE66NpvhUcFeZO31SdXtjmaio6lmu7evwRBSqxsMzM`
- Drive raíz: `CARIOCA_URBANAS`
- Drive raíz ID: `1ZCyS5_InlA8v8yJFfqAAdLDRmnDSIYUB`
- Drive productos: `PRODUCTOS`
- Drive productos ID: `1PRis6foEeObZ05QkLzWrAXPpG5au_KHG`
- Cuenta Drive operativa: `SORTIGOZA.DRIVE`
- La carpeta raíz figura `shared: false`.

## Arquitectura actual
1. Carioca Manager (Apps Script) guarda datos de producto en Google Sheets.
2. Carioca Core valida y publica `Web_CSV`.
3. La web pública lee el CSV publicado de Google Sheets en cada sesión.
4. `foto_1` a `foto_5` son URLs públicas externas.
5. Las imágenes actuales están mayormente en Cloudinary.
6. El sitio está desplegado desde GitHub Pages.

## Hallazgos confirmados
- El Manager actual no sube archivos: solicita URLs en `foto_1` a `foto_5`.
- La interfaz todavía muestra "Imágenes de Cloudinary".
- Core valida `foto_1` como URL HTTP/HTTPS y exporta las cinco fotos a `Web_CSV`.
- La web arma la galería desde `foto_1` a `foto_5`.
- `index.html` y `producto.html` mantienen `preconnect` a Cloudinary.
- `index.html`, `robots.txt` y `sitemap.xml` contienen URLs antiguas de GitHub Pages.
- El `index.html` productivo contiene un enlace flotante de WhatsApp fuera de `<body>`; el navegador lo corrige, pero el HTML es inválido y debe limpiarse.
- `producto.html` actualiza Open Graph por JavaScript; no es una solución SEO robusta para crawlers que no ejecuten JS.
- `config.js` apunta al CSV correcto de Core 3.0.
- La prioridad de ofertas está implementada en `catalog.js`.
- La planilla tiene locale `es_MX` y zona horaria `America/Los_Angeles`; debe corregirse de forma controlada.
- Config mantiene 50% como ganancia objetivo general. `CU-000001` hoy usa una excepción manual del 25%, por eso su precio actual difiere del ejemplo original.

## Principios de la migración
1. No modificar `main` hasta completar pruebas.
2. No tocar fórmulas económicas ni el contrato de precios de Core 3.0.
3. Google Drive será el repositorio maestro privado de imágenes.
4. La web no servirá imágenes directamente desde Drive.
5. Hostinger será la capa pública de entrega de imágenes y datos.
6. `Web_CSV` se conserva como salida administrativa/backup.
7. El sitio público dejará de depender de Google Sheets en tiempo de visita.
8. Mantener rollback simple durante toda la migración.

## Arquitectura objetivo
```
Carioca Manager
   |                       |                     \ imágenes originales
   v                      v
Google Sheets/Core      Google Drive privado
   |
   | Publicar catálogo
   v
Hostinger API
   |--------------------------|
   v                          v
data/catalog.json        media/productos/<SKU>/
   |                          |
   |--------------------------|
              |
              v
        Sitio + dominio
```

## Decisión clave: catálogo same-origin
Core seguirá generando `Web_CSV`, pero además enviará el catálogo público a Hostinger como:

```
/data/catalog.json
```

La web leerá ese JSON desde su propio dominio. Beneficios:
- menos dependencia de Google;
- mejor velocidad;
- sin CORS;
- publicación atómica;
- más fácil de cachear;
- rollback simple;
- Hostinger puede seguir sirviendo el último catálogo aunque Google tenga una caída.

## Drive: estructura
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

## Modelo de datos recomendado
Mantener `foto_1` a `foto_5` como URLs públicas estables en Hostinger.

Usar las cuatro columnas libres actuales de `Productos_Madre` para:
- `drive_folder_id`
- `imagenes_sync_estado`
- `imagenes_sync_fecha`
- `imagenes_sync_detalle`

No hace falta guardar cinco IDs de archivo si cada producto tiene su propia carpeta y nombres deterministas.

## Manager 3.1 — objetivo
Reemplazar los campos de URL por selectores de archivo:
- Foto principal
- Foto 2
- Foto 3
- Foto 4
- Foto 5

Al guardar:
1. validar imagen;
2. reservar/generar SKU bajo lock;
3. crear/ubicar carpeta Drive del SKU;
4. subir original a Drive;
5. enviar copia web a Hostinger;
6. recibir URL pública estable;
7. escribir esa URL en `foto_1...foto_5`;
8. guardar `drive_folder_id`;
9. marcar sincronización;
10. completar Core y guardar.

En edición:
- si no se selecciona un archivo nuevo, se conserva la imagen existente;
- si se reemplaza, se actualiza Drive + Hostinger;
- la eliminación explícita será una acción separada y segura.

## Hostinger
La rama de migración incluirá endpoints PHP sin secretos:
- `api/upload-product-image.php`
- `api/delete-product-image.php`
- `api/publish-catalog.php`
- `api/config.example.php`

Los secretos reales vivirán fuera del repositorio en `api/config.php`.

## Fases
### A — Auditoría y aislamiento
Completada en la rama de migración.

### B — Drive
En curso:
- raíz creada;
- carpeta `PRODUCTOS` creada;
- pendiente integración desde Manager.

### C — API Hostinger
Preparar y probar localmente endpoints de imágenes y catálogo.

### D — Manager 3.1 en staging
Integrar subida real sin desplegar todavía la implementación productiva.

### E — Sitio Hostinger staging
- leer `data/catalog.json`;
- servir imágenes same-origin;
- limpiar SEO y URLs;
- mejorar fichas de producto.

### F — Migración de imágenes existentes
Copiar Cloudinary -> Drive + Hostinger, SKU por SKU.

### G — Corte final
- backup;
- publicación final;
- cambio de dominio;
- SEO;
- smoke test;
- rollback disponible.

## Invariantes
- SKU existente.
- Modelo económico Core 3.0.
- Validación estricta.
- Publicación de `Web_CSV`.
- Oferta primero.
- Flujo de compra por WhatsApp.
