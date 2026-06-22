# Guia de mantenimiento y mejoras

Este documento resume como esta armada la app Zero Spoiler y que hay que cuidar en futuros cambios.

## Objetivo del producto

La app permite ver resumenes recientes de partidos publicados en YouTube sin revelar resultado final, ganador, miniaturas, comentarios, descripciones ni titulos originales.

La regla principal es: si un dato puede revelar el resultado, no debe llegar a la interfaz.

## Fuentes actuales

Las fuentes estan configuradas en `server.js`, constante `CHANNELS`:

- `https://www.youtube.com/@dsportsok`
- `https://www.youtube.com/@ESPNFans`

Cada fuente tiene:

- `handle`: identificador interno.
- `label`: nombre seguro visible en la interfaz.
- `url`: URL del canal.

Para agregar una fuente, sumar otro objeto a `CHANNELS`. Antes de mostrar videos de una fuente nueva, verificar que publica compactos con titulos suficientemente estructurados para extraer paises sin mostrar resultados.

## Criterios de inclusion

Un video aparece en la lista solo si cumple estas condiciones:

1. Fue publicado en las ultimas 24 horas.
2. El titulo original contiene la palabra `RESUMEN`.
3. El titulo original permite detectar al menos dos paises.
4. YouTube permite reproducirlo embebido dentro de la app.

La app lee dos superficies del canal:

- RSS oficial del canal.
- Pagina publica `/videos` del canal.

Esto existe porque RSS puede devolver menos videos recientes que la pagina del canal.

## Reglas anti-spoiler obligatorias

Estas reglas no deberian relajarse salvo decision explicita:

- No mostrar titulos originales de YouTube.
- No mostrar miniaturas.
- No mostrar descripcion, comentarios, recomendaciones ni pagina de YouTube.
- No mostrar links directos a `youtube.com/watch`.
- No mostrar texto que indique marcador, ganador, goleada, clasificacion o eliminacion.
- Al seleccionar un partido, iniciar la reproduccion directamente con `youtube-nocookie.com` y mantener el cover inicial de seguridad.
- No ofrecer abrir en YouTube cuando el video no es embebible.
- Mantener `youtube-nocookie.com` para el reproductor.

La API `/api/videos` nunca debe devolver `originalTitle`. Hoy se elimina antes de responder:

```js
const { originalTitle, ...safeItem } = item;
return safeItem;
```

Si se agregan campos nuevos, revisar que no contengan spoilers antes de enviarlos al cliente.

## Etiquetas seguras

El servidor convierte el titulo original en una etiqueta neutral:

```text
Partido disponible: Pais 1 vs Pais 2
```

Esto sucede en `stripSpoilers(title)`.

La deteccion de paises usa `COUNTRY_NAMES`. Si faltan partidos porque no detecta algun pais, agregar el pais a esa lista. Evitar agregar clubes o apodos si pueden confundirse con informacion de resultado o contexto sensible.

## Duracion

La duracion se extrae desde la pagina publica del canal con `parseDurationFromChunk(chunk)`.

Si YouTube cambia su estructura HTML, puede dejar de aparecer la duracion, pero la app debe seguir funcionando. La duracion es informativa, no obligatoria.

## Reproductor seguro

El cliente esta en `app.js`.

Puntos clave:

- `selectVideo()` marca el partido activo y llama a `playSelected()` para reproducir automaticamente.
- `playSelected()` carga el embed seguro, activa el cover inicial y permite reiniciar el resumen.
- `playerCover` tapa el video durante los primeros segundos para evitar overlays iniciales.
- `audioEnabled` controla si el embed se carga con `mute=1` o `mute=0`.
- `controls=0`, `rel=0`, `disablekb=1` y `iv_load_policy=3` reducen superficies que puedan mostrar informacion externa.

Las mascaras visuales estan en `styles.css`:

- `.mask-top`: franja superior negra para tapar marcador/titulo sobreimpreso.
- `.mask-bottom`: franja inferior negra para tapar controles o overlays.
- `.mask-left` y `.mask-right`: actualmente desactivadas.

Si se ajustan mascaras, probar con videos reales porque los overlays de YouTube y de los canales cambian segun video, relacion de aspecto y viewport.

## API

Endpoint principal:

```text
GET /api/videos
```

Respuesta esperada:

```json
{
  "sources": [{ "label": "ESPN Fans", "url": "https://www.youtube.com/@ESPNFans" }],
  "generatedAt": "2026-06-22T00:00:00.000Z",
  "items": [
    {
      "id": "videoId",
      "safeTitle": "Partido disponible: Pais 1 vs Pais 2",
      "publishedAt": "2026-06-22T00:00:00.000Z",
      "duration": "8:07",
      "source": "ESPN Fans"
    }
  ],
  "blockedCount": 0
}
```

No agregar `title`, `description`, `thumbnail`, `url`, `winner`, `score` ni campos similares.

## Archivos principales

- `server.js`: servidor local, lectura de YouTube, filtros y API segura.
- `index.html`: estructura de la interfaz.
- `styles.css`: layout, mascaras y estilos.
- `app.js`: comportamiento del cliente.
- `src/client.ts`: version TypeScript de referencia del cliente.
- `scripts/build-single-file.js`: genera `zero-spoiler-single.js`.
- `scripts/package-mac-app.js`: genera app y ZIP para macOS Apple Silicon.
- `scripts/package-windows-app.js`: genera ZIP autocontenido para Windows x64.
- `README.md`: instrucciones de uso para usuario final.

## Comandos utiles

Ejecutar en desarrollo:

```bash
npm start
```

Abrir:

```text
http://127.0.0.1:4173
```

Generar archivo unico:

```bash
npm run pack:single
```

Generar paquete para Mac:

```bash
npm run pack:mac
```

Generar paquete para Windows:

```bash
npm run pack:windows
```

Generar ambos paquetes:

```bash
npm run pack:desktop
```

## Artefactos generados

Estos son productos de distribucion:

- `zero-spoiler-single.js`
- `dist/Zero Spoiler macOS Apple Silicon.zip`
- `dist/Zero Spoiler Windows x64.zip`

El ZIP de Mac incluye una `.app` con Node embebido. El ZIP de Windows incluye `node.exe`, `zero-spoiler-single.js`, `LEEME.txt` e `Iniciar Zero Spoiler.cmd`.

## Validaciones antes de compartir

Antes de entregar una version nueva:

1. Ejecutar `npm start`.
2. Abrir `http://127.0.0.1:4173`.
3. Confirmar que la lista muestra solo etiquetas neutrales.
4. Confirmar que no aparecen titulos originales, marcadores ni ganadores.
5. Seleccionar un partido y verificar que reproduzca automaticamente sin mostrar miniaturas previas.
6. Revisar que el cover inicial y las mascaras tapen zonas de marcador y overlays.
7. Probar audio activado/desactivado.
8. Ejecutar `npm run pack:desktop`.
9. Validar que los ZIP finales existan y se puedan descomprimir.

## Riesgos conocidos

YouTube puede cambiar su HTML. Si pasa, pueden fallar:

- Resolucion del canal.
- Extraccion de videos desde `/videos`.
- Extraccion de duracion.
- Deteccion de tiempos relativos como `hace 2 horas`.

La app debe fallar de forma segura: si no puede determinar que un video cumple las reglas, no lo muestra.

Tambien puede ocurrir que un video reciente exista pero YouTube no permita reproducirlo embebido. En ese caso se cuenta como bloqueado, pero no se ofrece abrirlo fuera de la app.

## Mejoras posibles

Ideas razonables para futuras versiones:

- Agregar mas canales autorizados.
- Ampliar `COUNTRY_NAMES`.
- Agregar selector de ventana temporal: 12, 24 o 48 horas.
- Agregar opcion de idioma para nombres de paises.
- Guardar fuentes configurables en un archivo separado.
- Agregar tests unitarios para `extractCountries`, `titleMatchesRequiredSummary` y `parseRelativePublishTime`.
- Agregar logs internos no visibles para diagnosticar canales que dejaron de parsear.
- Firmar la app de macOS para evitar advertencias de seguridad.
- Crear instalador de Windows firmado para evitar advertencias de SmartScreen.

## Principio de mantenimiento

Cuando haya duda entre mostrar mas informacion o proteger al usuario de spoilers, elegir proteger al usuario.
