# Pro Garaje

App Android para llevar el mantenimiento del Nissan Qashqai J11: avisos de ITV, seguro, aceite y neumáticos, registro de repostajes con consumo real y gasto mensual.

**Descarga (siempre la última):** https://github.com/franciscoserranoadt/pro-garaje/releases/tag/ultima → `ProGaraje.apk`

## Publicar una versión nueva
1. Cambiar el código y escribir las novedades en `CAMBIOS.txt`.
2. Commit y push a `main`.
3. GitHub Actions compila, firma con `app/pro-garaje.jks` y publica la release `ultima`. La versión se numera sola (`1.0.<nº de ejecución>`).
4. La app avisa sola de la actualización.

**Firma:** `app/pro-garaje.jks`, alias `progaraje`, contraseña `progaraje2026`. No cambiarla nunca.
