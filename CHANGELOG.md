# Changelog

Todas las modificaciones notables realizadas en este proyecto serán documentadas en este archivo.

## [0.4.0-alpha] - 2026-10-11

### Mejoras en el Selector de Versión (Creación de Instancias)
- **Componente `VersionSelector`**:
  - Implementación de tarjeta de visualización de versión seleccionada con distintivos de tipo (`Release oficial` / `Snapshot experimental`) y fecha formateada de lanzamiento.
  - Resumen visual inmediato de compatibilidad con modloaders (`Vanilla`, `Fabric`, `Forge`, `NeoForge`) para la versión seleccionada.
  - Barra de búsqueda interactiva en tiempo real con contador dinámico de resultados y botón de limpieza rápida.
  - Pestañas de filtrado categorizado por versión: `Releases`, `Snapshots` y `Todas` (100% dinámicas desde el catálogo sincronizado).
  - Lista desplegable personalizada con scrollbar estilizado, micro-badges de soporte de modloaders y check de selección.
  - Eliminación de etiquetas/chips fijos y hardcoded (`POPULAR_VERSIONS`), dejando un flujo completamente dinámico basado en las versiones oficiales obtenidas.
- **Modal de Creación de Instancia (`CreateInstanceModal`)**:
  - Reemplazo del `<datalist>` nativo del navegador por el nuevo selector interactivo.
  - Ajuste de anchura y scroll dinámico del modal para adaptarse a pantallas de distintas resoluciones.
- **Internacionalización (i18n)**:
  - Añadidas cadenas de traducción para búsqueda, filtros y etiquetas en `src/i18n/locales/es.json` y `src/i18n/locales/en.json`.
- **Estilos (`styles.css`)**:
  - Diseño temático gaming/dark mode con efectos hover, micro-animación `animate-slide-down` y badges con esquemas de color contrastados.
  - Limpieza de estilos obsoletos de chips de versiones estáticas.
