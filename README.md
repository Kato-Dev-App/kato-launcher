# Kato-Dev Launcher

> Launcher ligero, moderno y modular para Minecraft con soporte para múltiples versiones, modloaders (Vanilla, Fabric, Forge, NeoForge, Quilt) y perfiles locales sin fricción. Desarrollado con **Tauri v2** y **React 19**.

---

## Guía de Instalación y Primer Inicio

Debido a que **Kato-Dev** es un proyecto independiente de código abierto y no cuenta con certificados de firma corporativos de pago (como Apple Developer Program o certificados EV de Windows), cada sistema operativo puede mostrar advertencias de seguridad en la primera apertura. 

A continuación se detallan los pasos para abrir la aplicación en cada sistema operativo:

### Windows

1. Descarga el instalador oficial `Kato-Dev_x.x.x_x64-setup.exe` desde la sección de [Releases](https://github.com/Kato-Dev-App/kato-launcher/releases).
2. Ejecuta el archivo descargado.
3. Si aparece la ventana azul de **Windows SmartScreen** (*«Windows protegió su PC / Editor desconocido»*):
   - Haz clic en **«Más información»**.
   - Haz clic en el botón **«Ejecutar de todas formas»**.
4. Sigue los pasos del asistente de instalación. Se creará automáticamente un acceso directo en tu Escritorio y Menú Inicio.

---

### macOS

1. Descarga el archivo `Kato-Dev_x.x.x_universal.dmg` o la versión correspondiente a tu arquitectura (`aarch64` para Apple Silicon M1/M2/M3/M4 o `x64` para Intel).
2. Abre el `.dmg` y arrastra **Kato-Dev.app** a tu carpeta de **Aplicaciones** (`/Applications`).
3. Por defecto, macOS aplica un atributo de cuarentena (*Gatekeeper*) a las aplicaciones descargadas fuera de la App Store, lo que puede mostrar alertas como *«No se puede abrir porque el desarrollador no ha sido verificado»* o *«La app está dañada»*.

Para autorizar la aplicación en la primera apertura, puedes usar cualquiera de estos métodos:

#### Método 1: Menú contextual (Recomendado sin terminal)
1. Ve a tu carpeta de **Aplicaciones**.
2. Haz **Clic derecho** (o mantén pulsada la tecla `Control` y haz clic) sobre **Kato-Dev.app**.
3. Selecciona **Abrir** en el menú.
4. En la ventana de confirmación que aparece, pulsa nuevamente en **«Abrir»**.
   > *Una vez hecho esto la primera vez, el sistema recordará la autorización y podrás abrirla siempre con doble clic normal.*

#### Método 2: Ajustes del Sistema
1. Intenta abrir la aplicación normalmente una vez.
2. Abre **Ajustes del Sistema** > **Privacidad y seguridad**.
3. Desplázate hacia abajo hasta la sección **Seguridad**.
4. Verás un mensaje indicando que se bloqueó *Kato-Dev*. Haz clic en **«Abrir de todos modos»** e introduce tu contraseña o Touch ID.

#### Método 3: Terminal (Rápido para usuarios avanzados)
Abre la **Terminal** y ejecuta el siguiente comando para limpiar los atributos de cuarentena:
```bash
xattr -cr /Applications/Kato-Dev.app
```

---

### Linux

#### Opción A: Paquete `.deb` (Debian, Ubuntu, Linux Mint, etc.)
1. Descarga `Kato-Dev_x.x.x_amd64.deb`.
2. Haz doble clic para abrirlo con el Centro de Software de tu distribución y pulsa **Instalar**, o instálalo desde la terminal:
   ```bash
   sudo dpkg -i Kato-Dev_*_amd64.deb
   sudo apt-get install -f # Si faltase alguna dependencia
   ```

#### Opción B: Paquete `.AppImage`
1. Descarga el archivo `.AppImage`.
2. Dale permisos de ejecución:
   - **Gráficamente:** Clic derecho sobre el archivo > *Propiedades* > *Permisos* > Marcar *«Permitir ejecutar el archivo como un programa»*.
   - **Por terminal:**
     ```bash
     chmod +x Kato-Dev_*.AppImage
     ./Kato-Dev_*.AppImage
     ```

---

## Desarrollo Local

Si deseas contribuir o compilar el proyecto en tu máquina local:

### Requisitos previos
- [Node.js](https://nodejs.org/) (v20 o superior recomendado)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (toolchain estable)
- Dependencias del sistema según la [documentación oficial de Tauri v2](https://v2.tauri.app/start/prerequisites/).

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

### Compilación de paquetes de producción
```bash
# Construir frontend
pnpm build

# Compilar binarios de Tauri
pnpm tauri build
```
> **Nota para macOS:** Si deseas compilar localmente solo el paquete `.app` sin ejecutar los scripts cosméticos de DMG:
> ```bash
> pnpm tauri build --bundles app
> ```

---

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
