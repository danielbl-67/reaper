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
const fs = require('fs');
const path = require('path');

// ================= CONFIGURACIÓN MAESTRA DE ENTREGAS (RAILWAY) =================
const TOKEN = process.env.TOKEN; 
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Inyección prioritaria desde Variables de Entorno para evitar pérdidas por reinicio
let DATA = {
    canalGestion: null,
    canalEstado: null,
    msgEstadoId: null,
    server: { 
        type: process.env.SERVER_TYPE || null, 
        host: process.env.SERVER_HOST || null, 
        port: process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : null 
    }
};

if (!TOKEN) {
    console.error("❌ ERROR: Falta la variable 'TOKEN' en Railway.");
    process.exit(1);
}

// Carga de respaldo para los canales de Discord enlazados
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const configLocal = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        DATA.canalGestion = configLocal.canalGestion;
        DATA.canalEstado = configLocal.canalEstado;
        DATA.msgEstadoId = configLocal.msgEstadoId;
        // Si no se definieron variables de entorno, usa el archivo de respaldo
        if (!DATA.server.host && configLocal.server) {
            DATA.server = configLocal.server;
        }
    } catch (e) {
        console.error("⚠️ No se pudo leer el archivo de canales.");
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
    console.log(`🟢 Bot online como: ${client.user.tag}`);
    
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
        console.log('🔄 Sincronizando comandos limpios...');
        const guilds = await client.guilds.fetch();
        for (const [guildId] of guilds) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId), 
                { body: commands }
            );
        }
        console.log('✅ Sistema de comandos listo.');
    } catch (error) {
        console.error('❌ Error cargando comando:', error);
    }

    if (DATA.server && DATA.server.host) {
        updateInterval = setInterval(updateServerStatus, 30000);
        updateServerStatus();
    }
});

// 🔄 MANEJADOR DE INTERACCIONES
client.on('interactionCreate', async interaction => {
    
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-bot') {
        const canalGestion = interaction.options.getChannel('gestion');
        const canalEstado = interaction.options.getChannel('estado');

        DATA.canalGestion = canalGestion.id;
        DATA.canalEstado = canalEstado.id;
        DATA.msgEstadoId = null; 
        guardarConfig();

        await interaction.reply({
            content: `✅ ¡Canales enlazados con éxito! Generando panel de control en <#${canalGestion.id}>...`,
            ephemeral: true
        });

        const embedStaff = new EmbedBuilder()
            .setTitle('🛠️ PANEL DE CONFIGURACIÓN DEL STAFF')
            .setDescription('Usa el menú desplegable de este mensaje para cambiar de juego o editar la IP/Puerto en tiempo real.')
            .setColor(0x2f3136);

        const selectorJuegos = new StringSelectMenuBuilder()
            .setCustomId('seleccionar_juego')
            .setPlaceholder('👉 Selecciona el juego para rellenar sus datos')
            .addOptions(
                { label: 'Ark: Survival Ascended (ASA)', value: 'arksa', description: 'Monitoreo directo por protocolo Steam', emoji: '🦖' },
                { label: 'Ark: Survival Evolved (ASE)', value: 'arkse', description: 'Monitoreo directo por protocolo Steam', emoji: '🦕' },
                { label: 'Minecraft (Java)', value: 'minecraft', description: 'Servidores de Minecraft PC', emoji: '🟩' },
                { label: 'Minecraft (Bedrock)', value: 'minecraftbe', description: 'Servidores PE/Consolas', emoji: '📱' },
                { label: 'Rust', value: 'rust', description: 'Monitoreo directo por protocolo Steam', emoji: '🔧' }
            );

        const filaComponentes = new ActionRowBuilder().addComponents(selectorJuegos);
        await canalGestion.send({ embeds: [embedStaff], components: [filaComponentes] });

        updateServerStatus();
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_juego') {
        const juegoSeleccionado = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`modal_config_${juegoSeleccionado}`)
            .setTitle(`CONFIGURAR JUEGO: ${juegoSeleccionado.toUpperCase()}`);

        const ipInput = new TextInputBuilder()
            .setCustomId('input_ip')
            .setLabel('Dirección IP (Sin el puerto)')
            .setPlaceholder('Ej: 176.86.44.97')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const puertoInput = new TextInputBuilder()
            .setCustomId('input_puerto')
            .setLabel('Puerto Query / Consulta')
            .setPlaceholder('Ej: 8787')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        if (DATA.server && DATA.server.type === juegoSeleccionado && DATA.server.host) {
            ipInput.setValue(DATA.server.host);
            puertoInput.setValue(DATA.server.port.toString());
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
        const puerto = parseInt(puertoStr, 10);

        if (isNaN(puerto)) {
            return await interaction.reply({ content: '⚠️ Error: El puerto ingresado debe ser un número.', ephemeral: true });
        }

        DATA.server.type = juego;
        DATA.server.host = ip;
        DATA.server.port = puerto;
        guardarConfig();

        await interaction.reply({
            content: `✅ ¡Datos guardados! El monitor actualizará el embed público en unos segundos...`,
            ephemeral: true
        });

        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(updateServerStatus, 30000);
        updateServerStatus();
    }
});


function consultarSteam(host, port) {
    return new Promise((resolve, reject) => {
        query.info(host, port, 4000, (err, info) => {
            if (err) return reject(err);
            resolve(info);
        });
    });
}

// 📊 BUCLE DE MONITOREO DIRECTO (Estabilizado para Nube)
// 📊 BUCLE DE MONITOREO DIRECTO + RESCATE DE RED VALVEDIG
async function updateServerStatus() {
    if (!DATA.canalEstado) return;

    try {
        const channel = await client.channels.fetch(DATA.canalEstado);
        if (!channel) return;

        let embed = new EmbedBuilder();

        if (!DATA.server.host) {
            embed.setTitle('🔵 PANEL EN ESPERA')
                 .setColor(0x3498db)
                 .setDescription('Esperando parámetros en el canal de administración del Staff.');
            return await enviarOEditar(channel, embed);
        }

        let state = null;
        const targetAddr = `${DATA.server.host}:${DATA.server.port}`;

        if (DATA.server.type === 'arkse' || DATA.server.type === 'arksa' || DATA.server.type === 'rust') {
            // 1. INTENTO BINARIO: Consulta asíncrona directa a Steam
            try {
                const infoSteam = await consultarSteam(DATA.server.host, DATA.server.port);
                if (infoSteam && infoSteam.name) {
                    state = {
                        name: infoSteam.name,
                        map: infoSteam.map || 'N/A',
                        maxplayers: infoSteam.maxplayers,
                        players: new Array(infoSteam.players).fill({ name: 'Jugador' })
                    };
                }
            } catch (errSteam) {
                // 2. RESCATE DE EMERGENCIA POR HTTP: Rompe el bloqueo de IP usando el nodo público de Valve
                try {
                    const axios = require('axios');
                    const respuestaEspejo = await axios.get(
                        `https://api.vserver.site/info/steam?addr=${targetAddr}`, 
                        { timeout: 5000 }
                    );
                    
                    if (respuestaEspejo.data && respuestaEspejo.data.status === "online") {
                        state = {
                            name: respuestaEspejo.data.name,
                            map: respuestaEspejo.data.map || 'N/A',
                            maxplayers: respuestaEspejo.data.max_players,
                            players: new Array(respuestaEspejo.data.players).fill({ name: 'Jugador' })
                        };
                    }
                } catch (errEspejo) {
                    // 3. TERCER MOTOR: GameDig Tradicional por si acaso
                    try {
                        let protocoloJuego = DATA.server.type === 'arksa' ? 'asb' : DATA.server.type;
                        const resGamedig = await GameDig.query({
                            type: protocoloJuego,
                            host: DATA.server.host,
                            port: DATA.server.port,
                            socketTimeout: 2000
                        });
                        if (resGamedig) {
                            state = {
                                name: resGamedig.name,
                                map: resGamedig.map || 'N/A',
                                maxplayers: resGamedig.maxplayers,
                                players: resGamedig.players
                            };
                        }
                    } catch (e) { /* Todos los sistemas bloqueados por Nitrado */ }
                }
            }
        } else {
            try {
                state = await GameDig.query({
                    type: DATA.server.type,
                    host: DATA.server.host,
                    port: DATA.server.port,
                    socketTimeout: 4000
                });
            } catch (e) { /* Minecraft Offline */ }
        }

        // Pintar el Embed Final
        if (state) {
            embed.setTitle(`🟢 SERVIDOR ONLINE: ${state.name}`)
                 .setColor(0x2ecc71)
                 .addFields(
                     { name: '🎮 Juego', value: `\`${DATA.server.type.toUpperCase()}\``, inline: true },
                     { name: '🌐 Dirección IP', value: `\`${DATA.server.host}:${DATA.server.port}\``, inline: true },
                     { name: '👥 Jugadores', value: `👤 **${state.players.length}** / **${state.maxplayers}**`, inline: false },
                     { name: '📍 Mapa', value: `📍 \`${state.map}\``, inline: true }
                 )
                 .setFooter({ text: 'Sincronizado con éxito mediante Red Espejo • Cada 30s' })
                 .setTimestamp();

            if (state.players.length > 0 && state.players[0].name !== 'Jugador') {
                const listaJugadores = state.players.map(p => p.name).join(', ');
                embed.addFields({ name: '🎮 Jugadores Conectados:', value: listaJugadores.length > 1024 ? listaJugadores.substring(0, 1021) + '...' : listaJugadores });
            }
        } else {
            embed.setTitle('🔴 SERVIDOR OFFLINE o INACCESIBLE')
                 .setColor(0xe74c3c)
                 .setDescription(`No se ha podido recibir respuesta de Nitrado ni de las APIs globales de Steam.\n\nEl servidor podría tener las consultas externas (Query) completamente deshabilitadas por su administrador.`)
                 .addFields(
                     { name: '🎮 Juego seleccionado', value: `\`${DATA.server.type.toUpperCase()}\``, inline: true },
                     { name: '🌐 IP y Puerto Query', value: `\`${DATA.server.host}:${DATA.server.port}\``, inline: true }
                 )
                 .setFooter({ text: 'Reintentando cada 30s' })
                 .setTimestamp();
        }

        await enviarOEditar(channel, embed);

    } catch (err) {
        console.error('Error en el bucle principal:', err);
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