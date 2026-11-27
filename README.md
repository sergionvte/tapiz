# Tapiz

Web app para crear fondos de pantalla de patrón a la resolución exacta de tu pantalla.

- Detecta las medidas de la pantalla (píxeles reales × densidad) o elige un modelo de teléfono, tableta, Mac o monitor.
- 4 estilos: **Patrón** (20 texturas), **Material** (12 formas por capas), **Abstracto** (líquido, cristal acanalado, trazos, vitral, Memphis, pulsar) y **Degradado** (malla, aurora, orbes, holográfico, lineal, cónico).
- 31 paletas multicolor, monocromo a partir de un color y paleta personalizada.
- Vista completa o detalle 1:1, simulación de pantalla de bloqueo y escritorio.
- Favoritos y enlaces para compartir un diseño.
- Exporta PNG (en el móvil abre el menú de compartir para guardarlo en Fotos).

Todo se genera en el navegador con Canvas; no hay servidor ni dependencias. Código: `js/data.js` (catálogos), `js/render.js` (patrones y Material), `js/art.js` (Abstracto y Degradado), `js/app.js` (interfaz).
