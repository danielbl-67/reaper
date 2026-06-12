# 🦖 REAPER | Game Server Stats Bot 🟩

REAPER es un bot de Discord de alto rendimiento diseñado para monitorear y mostrar estadísticas en tiempo real de tus servidores de videojuegos favoritos utilizando únicamente su dirección IP o Dominio. 

Gracias a una interfaz moderna basada en componentes interactivos de Discord (Menús desplegables y Modales), la comunidad o los administradores pueden cambiar el servidor a escanear "en caliente" sin tocar una sola línea de código.

---

## ✨ Características Principales

* **📊 Monitoreo interactivo completo:** Visualización dinámica mediante embeds limpios y organizados que muestran el estado del servidor (Online/Offline).
* **🌐 Configuración en caliente mediante la UI:** No necesitas archivos JSON complejos ni reiniciar el bot; usa el menú desplegable integrado para abrir un formulario modal e introducir la IP y Puerto Query directamente desde Discord.
* **👥 Rastreador de Jugadores en Vivo:** Muestra de forma exacta cuántas personas hay conectadas, el límite máximo del servidor y una lista con los nombres de los jugadores en línea.
* **📍 Datos del Entorno:** Captura automática del mapa actual o escenario del juego.
* **🔄 Bucle Auto-Actualizable:** Una vez configurado, el panel actualiza de forma automática todos los datos cada **30 segundos** sin saturar la API.

---

## 🎮 Juegos Soportados por Defecto

El panel interactivo viene preconfigurado con soporte optimizado para:
* 🦖 **Ark: Survival Evolved** (`arkse`)
* 🟩 **Minecraft Java Edition** (`minecraft`)
* 📱 **Minecraft Bedrock / Móvil** (`minecraftbe`)
* 🔧 **Rust** (`rust`)

*(Nota: Al usar internamente el motor de `GameDig`, es fácilmente expandible a más de 100 juegos distintos).*

---

## 🛠️ Tecnologías Utilizadas

Este proyecto está desarrollado bajo el entorno de ejecución de **Node.js** utilizando los siguientes paquetes principales:
* [discord.js v14](https://discord.js.org/) - Librería principal para la interacción directa con la pasarela y API de Discord.
* [gamedig](https://github.com/gamedig/node-gamedig) - Motor de consulta de protocolos Query encargado de conectarse con los servidores de juego.

---

## 🚀 Instalación y Despliegue

### 1. Requisitos Previos
Asegúrate de tener instalado [Node.js](https://nodejs.org/) (Versión 16.11.0 o superior recomendada) y un gestor de paquetes como `npm`.

### 2. Clonar el repositorio
```bash
git clone [https://github.com/TU_USUARIO/REAPER-Stats-Bot.git](https://github.com/TU_USUARIO/REAPER-Stats-Bot.git)
cd REAPER-Stats-Bot
