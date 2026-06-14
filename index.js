const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');
const { GameDig } = require('gamedig');
const query = require('source-server-query'); 
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

// ================= CONFIGURACIÓN SEGURO (SISTEMA) =================
const TOKEN = process.env.TOKEN; 
const CONFIG_FILE = path.join(__dirname, 'config.json');

if (!TOKEN) {
    console.error("❌ [ERROR CRÍTICO] No se ha encontrado el TOKEN en las variables de entorno.");
    process.exit(1);
}

const JUEGOS_CONFIG = {
    minecraft: {
        nombre: 'Minecraft (Java / Bedrock)',
        puertoDefecto: 25565,
        labelIp: 'IP o Dominio (Ej: mc.diosesmc.net)',
        placeholderIp: 'Introduce el dominio o la IP del servidor',
        labelPuerto: 'Puerto (Opcional - Vacío por defecto)',
        placeholderPuerto: 'Java usa 25565 / Bedrock usa 19132. Vacío auto-detecta',
        emoji: '🟩',
        color: 0x3498db,
        labelMapa: '⚙️ Versión / Modo'
    },
    ark: {
        nombre: 'Ark: Survival (ASE / ASA)',
        puertoDefecto: 27015,
        labelIp: 'Dirección IP o Dominio (Sin el puerto)',
        placeholderIp: 'Ej: 176.86.44.97 o ark.mi-servidor.com',
        labelPuerto: 'Puerto Query (Opcional - Vacío por defecto)',
        placeholderPuerto: 'Deja vacío para usar 27015 (ASE) o pon 7777 si es ASA',
        emoji: '🦖',
        color: 0x2ecc71,
        labelMapa: '📍 Mapa'
    },
    rust: {
        nombre: 'Rust',
        puertoDefecto: 28015,
        labelIp: 'Dirección IP o Dominio (Sin el puerto)',
        placeholderIp: 'Ej: rust.mi-servidor.com o 185.X.X.X',
        labelPuerto: 'Puerto Query (Opcional - Vacío por defecto)',
        placeholderPuerto: 'Deja vacío para usar el puerto 28015',
        emoji: '🔧',
        color: 0xe67e22,
        labelMapa: '📍 Mapa'
    },
    palworld: {
        nombre: 'Palworld',
        puertoDefecto: 8211,
        labelIp: 'Dirección IP o Dominio (Sin el puerto)',
        placeholderIp: 'Ej: pal.mi-servidor.com',
        labelPuerto: 'Puerto Query / Conexión (Predeterminado: 8211)',
        placeholderPuerto: 'Deja vacío para usar el puerto estándar 8211',
        emoji: '🥚',
        color: 0xf1c40f,
        labelMapa: '⚙️ Estado del Servidor'
    },
    dayz: {
        nombre: 'DayZ',
        puertoDefecto: 27016,
        labelIp: 'Dirección IP o Dominio (Sin el puerto)',
        placeholderIp: 'Ej: dayz.mi-servidor.com',
        labelPuerto: 'Puerto Query / Consulta (¡Obligatorio en DayZ!)',
        placeholderPuerto: 'Introduce el puerto Query asignado por tu hosting',
        emoji: '🧟',
        color: 0x1abc9c,
        labelMapa: '📍 Mapa'
    },
    sdtd: {
        nombre: '7 Days to Die',
        puertoDefecto: 26900,
        labelIp: 'Dirección IP o Dominio (Sin el puerto)',
        placeholderIp: 'Ej: 7dtd.mi-servidor.com',
        labelPuerto: 'Puerto Query / Consulta (Predeterminado: 26900)',
        placeholderPuerto: 'Deja vacío para usar el puerto estándar 26900',
        emoji: '🪓',
        color: 0xe74c3c,
        labelMapa: '⏳ Días Transcurridos'
    }
};

let DATA = {
    canalGestion: null,
    canalEstado: null,
    msgEstadoId: null,
    server: { type: null, host: null, port: null }
};

if (fs.existsSync(CONFIG_FILE)) {
    try {
        DATA = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        console.log("📂 [CONFIG] Archivo config.json cargado con éxito.");
    } catch (e) {
        console.error("⚠️ [CONFIG] No se pudo leer el archivo config.json.");
    }
}

function guardarConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DATA, null, 4), 'utf-8');
}
// =================================================================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let updateInterval = null;

client.once('ready', async () => {
    console.log(`\n🟢 [SISTEMA] Bot online en tu PC como: ${client.user.tag}`);
    
    const commands = [
        new SlashCommandBuilder()
            .setName('setup-bot')
            .setDescription('⚙️ Despliega el panel de gestión interna y el canal de estado público.')
            .addChannelOption(option => 
                option.setName('gestion').setDescription('Canal privado para el Staff.').setRequired(true))
            .addChannelOption(option => 
                option.setName('estado').setDescription('Canal público exclusivo para mostrar el estado.').setRequired(true))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('🔄 [BOT] Sincronizando comandos slash...');
        const guilds = await client.guilds.fetch();
        for (const [guildId] of guilds) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
        }
        console.log('✅ [BOT] Comandos slash registrados.');
    } catch (error) {
        console.error('❌ [BOT] Error cargando comandos:', error.message);
    }

    if (DATA.server && DATA.server.host && DATA.server.type) {
        console.log(`⏳ [MONITOR] Iniciando bucle automático cada 30s...`);
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(updateServerStatus, 30000);
        updateServerStatus();
    }
});

// 🔄 MANEJADOR DE INTERACCIONES
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand() && interaction.commandName === 'setup-bot') {
            await interaction.deferReply({ ephemeral: true });

            const canalGestion = interaction.options.getChannel('gestion');
            const canalEstado = interaction.options.getChannel('estado');

            DATA.canalGestion = canalGestion.id;
            DATA.canalEstado = canalEstado.id;
            DATA.msgEstadoId = null; 
            guardarConfig();

            const embedStaff = new EmbedBuilder()
                .setTitle('🛠️ PANEL DE CONFIGURACIÓN DEL STAFF')
                .setDescription('Usa el menú desplegable de abajo para seleccionar y configurar tu servidor en tiempo real.')
                .setColor(0x2f3136);

            const selectorJuegos = new StringSelectMenuBuilder()
                .setCustomId('seleccionar_juego')
                .setPlaceholder('👉 Selecciona el juego para rellenar sus datos')
                .addOptions(
                    { label: 'Minecraft (Java / Bedrock)', value: 'minecraft', description: 'Servidores de Minecraft PC y Consolas', emoji: '🟩' },
                    { label: 'Ark: Survival (ASE / ASA)', value: 'ark', description: 'Ark Survival Evolved o Ascended (Unificados)', emoji: '🦖' },
                    { label: 'Rust', value: 'rust', description: 'Servidores de Rust', emoji: '🔧' },
                    { label: 'Palworld', value: 'palworld', description: 'Servidores de Palworld comunitarios', emoji: '🥚' },
                    { label: 'DayZ', value: 'dayz', description: 'Servidores de DayZ Standalone', emoji: '🧟' },
                    { label: '7 Days to Die', value: 'sdtd', description: 'Servidores de 7 Days to Die', emoji: '🪓' }
                );

            const filaComponentes = new ActionRowBuilder().addComponents(selectorJuegos);
            await canalGestion.send({ embeds: [embedStaff], components: [filaComponentes] });
            
            await interaction.editReply({ content: `✅ ¡Canales enlazados! Panel generado con éxito en <#${canalGestion.id}>.` });
            updateServerStatus();
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_juego') {
            const juego = interaction.values[0];
            const configJuego = JUEGOS_CONFIG[juego];

            if (!configJuego) return console.error(`⚠️ No se encontró configuración para la categoría: ${juego}`);

            const modal = new ModalBuilder()
                .setCustomId(`modal_config_${juego}`)
                .setTitle(`CONFIGURAR: ${juego.toUpperCase()}`);

            const ipInput = new TextInputBuilder()
                .setCustomId('input_ip')
                .setLabel(configJuego.labelIp)
                .setPlaceholder(configJuego.placeholderIp)
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const puertoInput = new TextInputBuilder()
                .setCustomId('input_puerto')
                .setLabel(configJuego.labelPuerto)
                .setPlaceholder(configJuego.placeholderPuerto)
                .setStyle(TextInputStyle.Short)
                .setRequired(false); 

            if (DATA.server && DATA.server.type === juego && DATA.server.host) {
                ipInput.setValue(DATA.server.host);
                puertoInput.setValue(DATA.server.port ? DATA.server.port.toString() : '');
            }

            modal.addComponents(
                new ActionRowBuilder().addComponents(ipInput),
                new ActionRowBuilder().addComponents(puertoInput)
            );

            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_config_')) {
            const juego = interaction.customId.replace('modal_config_', '');
            const ip = interaction.fields.getTextInputValue('input_ip').trim();
            const puertoStr = interaction.fields.getTextInputValue('input_puerto').trim();
            
            let puerto = null;
            if (puertoStr) {
                const puertoValidado = parseInt(puertoStr, 10);
                puerto = isNaN(puertoValidado) ? null : puertoValidado;
            }

            // 1. Si cambiamos de juego o reconfiguramos, eliminamos el mensaje anterior de forma limpia
            if (DATA.msgEstadoId) {
                try {
                    const channel = await client.channels.fetch(DATA.canalEstado);
                    const msgViejo = await channel.messages.fetch(DATA.msgEstadoId);
                    if (msgViejo) await msgViejo.delete();
                } catch (e) {}
                DATA.msgEstadoId = null;
            }

            DATA.server.type = juego;
            DATA.server.host = ip;
            DATA.server.port = puerto; 
            guardarConfig();

            // 2. Avisamos al Staff en privado
            await interaction.reply({
                content: `✅ ¡Buscando datos del servidor en tiempo real...!`,
                ephemeral: true
            });

            // 3. Pintamos INSTANTÁNEAMENTE el cartel de carga en el canal público (para cumplir con la captura)
            try {
                const publicChannel = await client.channels.fetch(DATA.canalEstado);
                if (publicChannel) {
                    const embedCarga = new EmbedBuilder()
                        .setTitle(`⏳ BUSCANDO SERVIDOR...`)
                        .setDescription(`El bot está intentando conectar con los datos de **${JUEGOS_CONFIG[juego].nombre}**.\n\nEste proceso tardará unos **30 segundos**. Por favor, espera...`)
                        .setColor(0xe67e22)
                        .setTimestamp();
                    
                    const msgCarga = await publicChannel.send({ embeds: [embedCarga] });
                    DATA.msgEstadoId = msgCarga.id;
                    guardarConfig();
                }
            } catch (errCarga) {
                console.error("Error enviando cartel de carga inicial:", errCarga.message);
            }

            // 4. Reiniciamos el reloj de consulta automática y forzamos el escáner real
            if (updateInterval) clearInterval(updateInterval);
            updateInterval = setInterval(updateServerStatus, 30000);
            
            // Esperamos un segundo para dejar que Discord procese el mensaje y lanzamos el escáner
            setTimeout(() => {
                updateServerStatus();
            }, 1000);
        }
    } catch (errInteraction) {
        console.error("❌ Error controlando interacción de Discord:", errInteraction.message);
    }
});

function consultarSteam(host, port) {
    return new Promise((resolve, reject) => {
        query.info(host, port, 28000, (err, info) => {
            if (err) return reject(err);
            resolve(info);
        });
    });
}

// 📊 BUCLE DE MONITOREO CON TIMEOUT EXACTO DE 30 SEGUNDOS
async function updateServerStatus() {
    if (!DATA.canalEstado || !DATA.server.type) return;

    try {
        const channel = await client.channels.fetch(DATA.canalEstado);
        if (!channel) return;

        const tipoJuego = DATA.server.type;
        const configJuego = JUEGOS_CONFIG[tipoJuego];
        let embed = new EmbedBuilder();

        let puertoFinal = DATA.server.port;

        if (!puertoFinal) {
            if (tipoJuego === 'minecraft') {
                try {
                    const srvRecords = await dns.resolveSrv(`_minecraft._tcp.${DATA.server.host}`);
                    if (srvRecords && srvRecords.length > 0) {
                        puertoFinal = srvRecords[0].port;
                    }
                } catch (e) {
                    puertoFinal = configJuego.puertoDefecto; 
                }
            } else {
                puertoFinal = configJuego.puertoDefecto;
            }
        }

        let state = null;
        let esUnTimeout = false; 
        
        console.log(`\n==================================================================`);
        console.log(`🔎 [ESCÁNER] IP: ${DATA.server.host} | Puerto: ${puertoFinal} | Categoría: ${tipoJuego.toUpperCase()}`);
        console.log(`==================================================================`);

        // ⏱️ TIMEOUT EXACTO DE 30 SEGUNDOS 
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            esUnTimeout = true;
            controller.abort();
            console.log("⚠️ [TIMEOUT] La consulta ha superado los 30 segundos límite. Abortando.");
        }, 30000);

        try {
            if (tipoJuego !== 'minecraft') {
                // 1. MOTOR DIRECTO VALVE
                try {
                    const infoSteam = await consultarSteam(DATA.server.host, puertoFinal);
                    if (infoSteam && infoSteam.name) {
                        state = {
                            name: infoSteam.name,
                            map: infoSteam.map || 'N/A',
                            maxplayers: infoSteam.maxplayers,
                            players: new Array(infoSteam.players).fill({ name: 'Jugador' })
                        };
                    }
                } catch (e) {}

                // 2. MOTOR RED ESPEJO (HTTP)
                if (!state && !esUnTimeout) {
                    try {
                        const respuestaEspejo = await axios.get(`https://api.vserver.site/info/steam?addr=${DATA.server.host}:${puertoFinal}`, { signal: controller.signal, timeout: 15000 });
                        if (respuestaEspejo.data && respuestaEspejo.data.status === "online") {
                            state = {
                                name: respuestaEspejo.data.name,
                                map: respuestaEspejo.data.map || 'N/A',
                                maxplayers: respuestaEspejo.data.max_players,
                                players: new Array(respuestaEspejo.data.players).fill({ name: 'Jugador' })
                            };
                        }
                    } catch (e) {}
                }

                // 3. MOTOR BATTLEMETRICS (HTTP)
                if (!state && !esUnTimeout) {
                    try {
                        const respuestaBM = await axios.get(`https://api.battlemetrics.com/servers?filter[addr]=${encodeURIComponent(DATA.server.host + ':' + puertoFinal)}&page[size]=1`, { signal: controller.signal, timeout: 15000 });
                        if (respuestaBM.data && respuestaBM.data.data && respuestaBM.data.data.length > 0) {
                            const attr = respuestaBM.data.data[0].attributes;
                            state = {
                                name: attr.name,
                                map: attr.details?.map || attr.details?.rules?.les_elapsed_days || attr.map || 'N/A',
                                maxplayers: attr.maxPlayers,
                                players: new Array(attr.players).fill({ name: 'Jugador' })
                            };
                        }
                    } catch (e) {}
                }

                // 4. MOTOR GAMEDIG (UDP)
                if (!state && !esUnTimeout) {
                    try {
                        let subProtocolo = tipoJuego;
                        if (tipoJuego === 'ark') subProtocolo = (puertoFinal === 7777 ? 'asb' : 'arkse');
                        if (tipoJuego === 'sdtd') subProtocolo = '7d2d';

                        const resGamedig = await GameDig.query({ type: subProtocolo, host: DATA.server.host, port: puertoFinal, socketTimeout: 15000 });
                        if (resGamedig) {
                            state = { 
                                name: resGamedig.name, 
                                map: resGamedig.raw?.rules?.les_elapsed_days || resGamedig.map || 'N/A', 
                                maxplayers: resGamedig.maxplayers, 
                                players: resGamedig.players 
                            };
                        }
                    } catch (e) {}
                }
            } else {
                // ================= RED MINECRAFT =================
                try {
                    const resApi = await axios.get(`https://api.mcsrvstat.us/3/${DATA.server.host}`, { signal: controller.signal, timeout: 15000 });
                    if (resApi.data && resApi.data.online) {
                        state = {
                            name: resApi.data.motd?.clean?.join(' ') || DATA.server.host,
                            map: resApi.data.version || 'Java/Bedrock Network',
                            maxplayers: resApi.data.players?.max || 100,
                            players: new Array(resApi.data.players?.online || 0).fill({ name: 'Jugador' })
                        };
                    }
                } catch (errApi) {
                    if (!esUnTimeout) {
                        try {
                            const resGamedig = await GameDig.query({ type: 'minecraft', host: DATA.server.host, port: puertoFinal, socketTimeout: 10000 });
                            if (resGamedig) {
                                state = { name: resGamedig.name || DATA.server.host, map: 'Minecraft Java', maxplayers: resGamedig.maxplayers, players: resGamedig.players };
                            }
                        } catch (e) {
                            try {
                                const resBedrock = await GameDig.query({ type: 'minecraftbe', host: DATA.server.host, port: puertoFinal || 19132, socketTimeout: 10000 });
                                if (resBedrock) {
                                    state = { name: resBedrock.name || DATA.server.host, map: 'Minecraft Bedrock', maxplayers: resBedrock.maxplayers, players: resBedrock.players };
                                }
                            } catch (errB) {}
                        }
                    }
                }
            }
        } finally {
            clearTimeout(timeoutId);
        }

        // ================= ACTUALIZACIÓN DEL MENSAJE DE DISCORD =================
        if (state) {
            console.log("✨ [RESULTADO] Servidor Online. Actualizando Discord...");
            embed.setTitle(`🟢 SERVIDOR ONLINE: ${state.name}`)
                 .setColor(configJuego.color)
                 .addFields(
                     { name: '🎮 Categoría', value: `\`${configJuego.nombre}\``, inline: true },
                     { name: '🌐 Dirección IP', value: `\`${DATA.server.host}:${puertoFinal}\``, inline: true },
                     { name: '👥 Jugadores', value: `👤 **${state.players.length}** / **${state.maxplayers}**`, inline: false },
                     { name: configJuego.labelMapa, value: `\`${state.map}\``, inline: true }
                 )
                 .setFooter({ text: `Monitoreo Unificado ${configJuego.emoji} • Cada 30s` })
                 .setTimestamp();
        
        } else {
            console.log("🔴 [RESULTADO] Servidor Offline / Timeout detectado.");
            embed.setTitle('🔴 SERVIDOR OFFLINE o INACCESIBLE')
                 .setColor(0xe74c3c);

            if (esUnTimeout) {
                embed.setDescription(`⚠️ **ERROR DE CONEXIÓN (TIMEOUT SUPERADO):**\nEl escáner ha superado el límite de **30 segundos** esperando respuesta del servidor.\n\nEsto ocurre cuando la IP está bloqueando los paquetes de consulta UDP o el host de juego está completamente congelado.`);
            } else {
                embed.setDescription(`No se pudo establecer comunicación con el servidor de **${configJuego.nombre}**.\n\nVerifica que la IP y el puerto introducidos sean correctos y que la máquina no tenga el Firewall cerrado.`);
            }

            embed.addFields(
                { name: '🎮 Categoría', value: `\`${configJuego.nombre}\``, inline: true },
                { name: '🌐 IP e intento de Puerto', value: `\`${DATA.server.host}:${puertoFinal}\``, inline: true }
            )
            .setFooter({ text: 'Reintentando cada 30s' })
            .setTimestamp();
        }

        await enviarOEditar(channel, embed);

    } catch (err) {
        console.error('❌ Error en el bucle principal:', err);
    }
}

async function enviarOEditar(channel, embed) {
    if (!DATA.msgEstadoId) {
        const nuevoMensaje = await channel.send({ embeds: [embed] });
        DATA.msgEstadoId = nuevoMensaje.id;
        guardarConfig();
    } else {
        try {
            const mensajeExistente = await channel.messages.fetch(DATA.msgEstadoId);
            await mensajeExistente.edit({ embeds: [embed], components: [] }); 
        } catch (error) {
            const nuevoMensaje = await channel.send({ embeds: [embed] });
            DATA.msgEstadoId = nuevoMensaje.id;
            guardarConfig();
        }
    }
}

client.login(TOKEN);