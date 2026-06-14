<p align="center">
  <img src="./img/REAPER LOGO.png" alt="REAPER LOGO" width="300px"/>
</p>

# 🦖 REAPER | Game Server Stats Bot 🟩

REAPER es un bot de Discord de alto rendimiento y arquitectura modular diseñado para monitorear y mostrar estadísticas en tiempo real de tus servidores de videojuegos favoritos utilizando únicamente su dirección IP o Dominio.

Gracias a una interfaz moderna basada en componentes interactivos de Discord (**Menús desplegables y Modales flotantes**), el Staff de la comunidad puede cambiar o reconfigurar el servidor a escanear "en caliente" de forma visual y segura, sin tocar código ni reiniciar la aplicación.

---

## ✨ Características Principales

- **📊 Monitoreo interactivo completo:** Visualización dinámica mediante embeds adaptativos que cambian sus colores, etiquetas y emojis automáticamente según el juego seleccionado.
- **🌐 Configuración en caliente mediante UI:** Olvídate de archivos JSON complejos. Usa el menú desplegable integrado para abrir un formulario modal e introducir la IP y el Puerto Query directamente desde Discord.
- **🔌 Resolución DNS SRV Automática:** Especialmente optimizado para Minecraft. Si el Staff introduce un dominio limpio (ej: `mc.diosesmc.net`) sin puerto, el bot interroga los registros DNS de internet para extraer y auto-configurar el puerto oculto perimetral.
- **⏱️ Sistema Anti-Congelamiento (Timeout de 30s):** Cuenta con un controlador de aborto estricto. Si un servidor de juego está colgado o caído, el bot detiene la llamada a los 30 segundos exactos y genera un embed rojo detallando el error de red en lugar de congelar el bot.
- **⏳ Animación de Carga en Canal:** Al guardar los datos de un servidor, el bot publica instantáneamente un cartel informativo naranja avisando a los usuarios que el escaneo está en proceso, evitando canales vacíos durante la búsqueda.
- **🔄 Bucle Auto-Actualizable Eficiente:** Una vez configurado el servidor, el panel refresca de forma automática todos los datos en Discord cada **30 segundos** de manera asíncrona.

---

## 🎮 Categorías de Juegos Soportadas

El panel interactivo viene preconfigurado con soporte híbrido de escaneo para las siguientes categorías globales:

- 🟩 **Minecraft:** Soporte inteligente unificado para **Java Edition** y **Bedrock (Móvil/Consolas)** con motores API HTTP redundantes para leer proxies complejos (BungeeCord/Velocity).
- 🦖 **Ark: Survival:** Soporte unificado para el clásico **Survival Evolved (ASE)** y el nuevo **Survival Ascended (ASA)** en Unreal Engine 5.
- 🔧 **Rust:** Rastreador UDP nativo para servidores de Rust dedicados.
- 🥚 **Palworld:** Monitoreo optimizado para servidores comunitarios de Palworld.
- 🧟 **DayZ:** Conector de consulta perimetral para servidores DayZ Standalone.
- 🪓 **7 Days to Die:** Rastreador síncrono para servidores de 7DTD.

---

## 🛠️ Tecnologías Utilizadas

Este proyecto está desarrollado bajo el entorno de ejecución de **Node.js** utilizando los siguientes paquetes principales:

- [discord.js v14](https://discord.js.org/) - Librería principal para la interacción directa con la pasarela y API de Discord.
- [gamedig](https://github.com/gamedig/node-gamedig) - Motor de consulta de protocolos Query encargado de conectarse con los servidores de juego.
- [source-server-query](https://www.npmjs.com/package/source-server-query) - Motor binario A2S directo de Valve para consultas de alta velocidad en Steam.
- [axios](https://axios-http.com/) - Cliente HTTP para consultas de rescate mediante APIs espejo globales redundantes.

---

<p align="center">
  <img src="./img/REAPER CARTEL.png" alt="REAPER CARTEL" width="300px"/>
</p>

## 🚀 Instalación y Despliegue Local

### 1. Requisitos Previos

Asegúrate de tener instalado [Node.js](https://nodejs.org/) (Versión 16.11.0 o superior recomendada) y el gestor de procesos global de Node, **PM2**, para garantizar que el bot se mantenga encendido 24/7 y se auto-reinicie en caso de caídas del sistema.

Para instalar PM2 globalmente en tu PC, abre una terminal y ejecuta:

```bash
npm install pm2 -g
```
