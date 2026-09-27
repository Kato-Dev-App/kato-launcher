# Kato Launcher (KatoApp)

<p align="center">
  <strong>Launcher ligero, moderno y modular para Minecraft con soporte para múltiples versiones, modloaders y gestión de contenido Modrinth.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0--alpha-purple.svg" alt="Versión 0.3.0-alpha" />
  <img src="https://img.shields.io/badge/Tauri-v2-blue.svg" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/React-19-cyan.svg" alt="React 19" />
  <img src="https://img.shields.io/badge/Rust-2021-orange.svg" alt="Rust Core" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="Licencia MIT" />
</p>

---

## 🌟 Características Principales

- **🎮 Amplia compatibilidad de versiones**: Soporte desde Minecraft Clásico (1.0) hasta las versiones modernas más recientes (1.21.x).
- **🧩 Soporte completo de ModLoaders**:
  - **Vanilla** (Oficial Mojang)
  - **Fabric**
  - **Forge**
  - **NeoForge** (con resolución automática de conflictos de librerías en 1.21.x)
  - **Quilt**
- **📦 Explorador e Instalador Modrinth Integrado**:
  - Busca e instala **Mods**, **Shaders** y **Resource Packs** con un solo clic.
  - Filtro automático de compatibilidad según la versión del juego y el ModLoader de la instancia.
  - Activación, desactivación y eliminación directa de mods desde el launcher.
- **🍎 Soporte Especializado para Apple Silicon (Mac M1/M2/M3/M4)**:
  - Detección y ejecución automática de versiones legacy (pre-1.13) mediante **Java 8 x86_64 con Rosetta 2**.
  - Duplicación de librerías nativas LWJGL 2 (`.jnilib` ⟷ `.dylib`) para evitar errores `UnsatisfiedLinkError`.
- **☕ Detección y Gestión Inteligente de Java**:
  - Lectura ultrarrápida sin sobrecarga del sistema (< 0.1 ms) mediante el archivo `release` de los JDKs instalados.
  - Descarga automática de entornos Java portables aislados si no tienes la versión adecuada instalada en tu equipo.
- **📊 Consola y Logs en Vivo**:
  - Visor de registros integrado en tiempo real con opción de autoscroll dinámico, contador de líneas y exportación/copia rápida.
- **⚡ Ajustes y Configuración de Instancias**:
  - Selector intuitivo de memoria RAM (2 GB a 16 GB).
  - Apertura directa del directorio del juego y zona de administración protegida.
- **🌐 Internacionalización (i18n)**:
  - Soporte completo en **Español** e **Inglés**.

---

## 📋 Compatibilidad de Entornos Java

| Versión de Minecraft | ModLoaders Soportados | Java Requerido | Soporte macOS Apple Silicon |
|---|---|---|---|
| **1.0 – 1.12.2** | Vanilla, Forge | Java 8 (x86_64) | ✅ Soportado (vía Rosetta 2 + Java 8 Portable) |
| **1.13 – 1.16.5** | Vanilla, Forge, Fabric | Java 8 / 11 | ✅ Nativo / Rosetta |
| **1.17 – 1.20.4** | Vanilla, Fabric, Forge, Quilt, NeoForge | Java 17 o 21 LTS | ✅ Nativo (ARM64 / x86_64) |
| **1.20.5 – 1.21.x+** | Vanilla, Fabric, NeoForge, Forge, Quilt | Java 21 LTS | ✅ Nativo (ARM64 / x86_64) |

---

## 🚀 Guía de Instalación y Primer Inicio

Debido a que **Kato Launcher** es un proyecto de código abierto independiente y no cuenta con certificados de firma corporativos de pago, el sistema operativo puede requerir una autorización en el primer inicio.

### Windows

1. Descarga el instalador oficial `KatoApp_x.x.x_x64-setup.exe` desde la pestaña de [Releases](https://github.com/Kato-Dev-App/kato-launcher/releases).
2. Ejecuta el archivo descargado.
3. Si aparece la ventana de **Windows SmartScreen** (*«Windows protegió su PC / Editor desconocido»*):
   - Haz clic en **«Más información»**.
   - Haz clic en el botón **«Ejecutar de todas formas»**.
4. Sigue los pasos del asistente de instalación.

---

### macOS

1. Descarga el instalador `KatoApp_x.x.x_universal.dmg` (o el específico para tu arquitectura: `aarch64` para M1/M2/M3/M4 o `x64` para Intel).
2. Abre el archivo `.dmg` y arrastra **KatoApp.app** a tu carpeta de **Aplicaciones** (`/Applications`).
3. Al ser una aplicación descargada de internet, macOS aplica atributos de Gatekeeper en la primera apertura:

#### Método 1: Menú contextual (Recomendado)
1. Abre tu carpeta de **Aplicaciones**.
2. Haz **Clic derecho** (o `Control` + Clic) sobre **KatoApp.app**.
3. Selecciona **Abrir** en el menú.
4. En el diálogo que aparece, pulsa en **«Abrir»**.
   > *Solo es necesario realizar este paso una vez; en las siguientes ocasiones abrirá normalmente con doble clic.*

#### Método 2: Ajustes del Sistema
1. Intenta abrir la app normalmente una vez.
2. Abre **Ajustes del Sistema** > **Privacidad y seguridad** > **Seguridad**.
3. Haz clic en **«Abrir de todos modos»** e introduce tu contraseña o Touch ID.

#### Método 3: Terminal
```bash
xattr -cr /Applications/KatoApp.app
```

---

### Linux

#### Opción A: Paquete `.deb` (Debian, Ubuntu, Linux Mint)
```bash
sudo dpkg -i KatoApp_*_amd64.deb
sudo apt-get install -f # Si faltase alguna dependencia
```

#### Opción B: Paquete `.AppImage`
```bash
chmod +x KatoApp_*.AppImage
./KatoApp_*.AppImage
```

---

## 🛠️ Desarrollo Local

Si deseas compilar o contribuir al desarrollo de Kato Launcher:

### Requisitos previos
- [Node.js](https://nodejs.org/) (v20 o superior recomendado)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (toolchain estable)
- Dependencias del sistema según la [guía de requisitos de Tauri v2](https://v2.tauri.app/start/prerequisites/).

### Instalación y ejecución
```bash
# 1. Clonar el repositorio
git clone https://github.com/Kato-Dev-App/kato-launcher.git
cd kato-launcher

# 2. Instalar dependencias
pnpm install

# 3. Iniciar entorno de desarrollo frontend + escritorio
pnpm desktop
```

### Compilación para producción
```bash
# Construir frontend y sincronizar configuración
pnpm build

# Compilar binarios nativos con Tauri
pnpm tauri build
```

> **Nota para macOS:** Si deseas compilar localmente solo el paquete `.app` sin crear el DMG:
> ```bash
> pnpm tauri build --bundles app
> ```

---

## ⚖️ Descargo de Responsabilidad (Disclaimer)

**Kato Launcher** es una herramienta desarrollada por la comunidad y **NO** es un producto oficial de Minecraft ni está respaldado, aprobado o asociado con Mojang AB o Microsoft. Todas las marcas registradas y nombres comerciales son propiedad de sus respectivos dueños.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.
