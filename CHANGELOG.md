# Changelog

Todas las modificaciones notables realizadas en este proyecto serán documentadas en este archivo.

## [0.4.5-alpha] - 2026-11-07

### Rediseño de Navegación y UI Minimalista
- **Menú Superior Unificado (`TopNav`)**:
  - Sustitución de la barra lateral izquierda fija por una barra superior moderna (`TopNav`) con efecto glassmorphism (`backdrop-filter: blur`).
  - Integración de marca (`Logo` + `Kato Launcher`), badge dinámico de versión con enlace web, pestañas centrales con indicador activo (`Instancias` con badge de conteo y `Ajustes`).
  - Acción universal de `+ Nueva Instancia` situada en la cabecera, accesible en todo momento sin invadir el espacio de juego.
  - Píldora de perfil de usuario activo con avatar, nombre del jugador y acción rápida para cambiar o salir de perfil.
  - Botón de ayuda/información discretamente ubicado en el extremo derecho.
- **Lienzo Libre y Espacioso**:
  - Se eliminó la restricción horizontal de 215px del sidebar, otorgando el 100% del ancho de pantalla para la visualización de instancias y ajustes.
  - Eliminación de encabezados redundantes y métricas que obstruían el foco del usuario.
  - Cuadrícula de instancias (`instance-grid`) adaptada a un ancho mínimo de tarjeta de 280px con espaciado fluido y respirable.
  - Vista de Ajustes (`SettingsView`) rediseñada a pantalla completa con grid responsivo de 2 columnas balanceadas (`settings-col`), eliminando la restricción previa de 750px para aprovechar todo el lienzo disponible.
  - Barra de herramientas minimalista con buscador instantáneo estilizado y botón de sincronización de catálogo con Mojang.
- **Compatibilidad con Nuevas Versiones de Minecraft (`26.x` y Snapshots)**:
  - Corrección de la heurística en `checkLoaderCompatibility` (`loaders.ts`), eliminando la restricción estricta de `major === 1` para dar soporte a versiones `>= 1.14` o del nuevo esquema (`26.x`, etc.) en Fabric, Forge y NeoForge.
  - Reconocimiento dinámico de formatos de snapshots modernos (`-snapshot-`, `-pre-`, `-rc-`) habilitando Fabric automáticamente en ellos.
  - Actualización en el downloader de Rust (`src-tauri/src/downloader.rs`) para resolver prefijos de NeoForge dinámicamente según el esquema de versión.
- **Optimización del Modal de Opciones de Instancia (`InstanceSettingsModal`)**:
  - Ajuste de capa modal con `z-index: 1000` en `.modal-backdrop` para cubrir limpiamente el menú superior fijo (`top-nav`) y evitar recortes visuales.
  - Rediseño de una columna vertical a un **grid balanceado de 2 columnas horizontales** (`instance-settings-grid`), distribuyendo la configuración de RAM y Mods a la izquierda y la ficha de información con la zona de peligro a la derecha.
  - Eliminación de pie inferior redundante y reducción de alturas muertas, permitiendo que el bloque de opciones se aprecie 100% completo en pantalla sin forzar scroll interno.
- **Estilos y Experiencia de Usuario (`styles.css`)**:
  - Transición del contenedor raíz `.app-shell` a un flujo vertical con degradado atmosférico de alta fidelidad.
  - Microinteracciones refinadas, hover accesible y estados deshabilitados claros.

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
