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
const query = require('source-server-query'); // Motor nativo de Steam
const fs = require('fs');
const path = require('path');

// ================= CONFIGURACIÓN SEGURA =================
const TOKEN = process.env.TOKEN || ''; 
const CONFIG_FILE = path.join(__dirname, 'config.json');

let DATA = {
    canalGestion: null,
    canalEstado: null,
    msgEstadoId: null,
    server: { type: null, host: null, port: null }
};

if (fs.existsSync(CONFIG_FILE)) {
    try {
        DATA = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
        console.error("⚠️ No se pudo leer config.json.");
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
                option.setName('gestion').setDescription('Canal privado para el Staff (Panel de Control).').setRequired(true))
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
            content: `✅ ¡Canales enlazados! Generando menú de control en <#${canalGestion.id}>...`,
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
            content: `✅ ¡Datos guardados! Conectando directamente con el Servidor Maestro de Steam...`,
            ephemeral: true
        });

        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(updateServerStatus, 30000);
        updateServerStatus();
    }
});

// Función auxiliar para transformar el Callback de Steam en una Promesa real
function consultarSteam(host, port) {
    return new Promise((resolve, reject) => {
        query.info(host, port, 4000, (err, info) => {
            if (err) return reject(err);
            resolve(info);
        });
    });
}

// 📊 BUCLE DE MONITOREO DIRECTO (Librería Oficial de Consultas de Steam Corregida)
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

        if (DATA.server.type === 'arkse' || DATA.server.type === 'arksa' || DATA.server.type === 'rust') {
            // MOTOR PRINCIPAL COMPILADO: Sincronización asíncrona real con Valve
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
                // Si el motor asíncrono de Valve falla, ejecutamos el salvavidas de GameDig tradicional
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
                } catch (e) { /* Ambos motores fallaron */ }
            }
        } else {
            // MODO DE RESPALDO TRADICIONAL PARA MINECRAFT (GameDig)
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
                 .setFooter({ text: 'Sincronizado de forma directa con los servidores de Steam • Cada 30s' })
                 .setTimestamp();

            if (state.players.length > 0 && state.players[0].name !== 'Jugador') {
                const listaJugadores = state.players.map(p => p.name).join(', ');
                embed.addFields({ name: '🎮 Jugadores Conectados:', value: listaJugadores.length > 1024 ? listaJugadores.substring(0, 1021) + '...' : listaJugadores });
            }
        } else {
            embed.setTitle('🔴 SERVIDOR OFFLINE o INACCESIBLE')
                 .setColor(0xe74c3c)
                 .setDescription(`No se ha podido recibir respuesta de los protocolos maestros de Steam.\n\nVerifica que los datos ingresados en el formulario coincidan exactamente con la ventana de información de Steam.`)
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