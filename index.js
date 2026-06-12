const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle
} = require('discord.js');
const { GameDig } = require('gamedig');

// ================= CONFIGURACIÓN INICIAL =================
const TOKEN = 'MTUxNTA3MzEwNjc5OTIzMDk5Ng.G3MFao.9dZ7xYh7OAA1EuCQyU9dPNEFKnabkbq5fOBkIU'; 
const CANAL_ID = '1118586375030190090'; 

let SERVER_CONFIG = {
    type: null,
    host: null,
    port: null
};
// =========================================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let messageRef = null; 
let updateInterval = null;

client.once('clientReady', () => {
    console.log(`🟢 Bot conectado con éxito como: ${client.user.tag}`);
    console.log('✨ Interfaz visual con menú desplegable lista.');
    updateServerStatus();
});

// 🔄 ESCUCHAR LAS INTERACCIONES DE LA INTERFAZ
client.on('interactionCreate', async interaction => {
    
    // 1. Cuando el usuario selecciona un juego en el desplegable
    if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_juego') {
        const juegoSeleccionado = interaction.values[0];

        // Crear la ventana emergente (Modal) para pedir IP y Puerto
        const modal = new ModalBuilder()
            .setCustomId(`modal_config_${juegoSeleccionado}`)
            .setTitle(`Configurar ${juegoSeleccionado.toUpperCase()}`);

        const ipInput = new TextInputBuilder()
            .setCustomId('input_ip')
            .setLabel('Dirección IP o Dominio del Servidor')
            .setPlaceholder('Ej: 5.62.116.129 o mc.mi-servidor.com')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const puertoInput = new TextInputBuilder()
            .setCustomId('input_puerto')
            .setLabel('Puerto Query / Consulta')
            .setPlaceholder('Ej: 27015 para Ark, 25565 para Minecraft')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(ipInput),
            new ActionRowBuilder().addComponents(puertoInput)
        );

        // Mostrar la ventana emergente al usuario
        await interaction.showModal(modal);
    }

    // 2. Cuando el usuario envía el formulario de la ventana emergente
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_config_')) {
        const juego = interaction.customId.replace('modal_config_', '');
        const ip = interaction.fields.getTextInputValue('input_ip').trim();
        const puertoStr = interaction.fields.getTextInputValue('input_puerto').trim();
        const puerto = parseInt(puertoStr, 10);

        if (isNaN(puerto)) {
            return await interaction.reply({ 
                content: '⚠️ El puerto debe ser un número válido.', 
                ephemeral: true 
            });
        }

        // Guardar la configuración en caliente
        SERVER_CONFIG.type = juego;
        SERVER_CONFIG.host = ip;
        SERVER_CONFIG.port = puerto;

        await interaction.reply({ 
            content: `✅ ¡Datos aplicados! Conectando al servidor de ${juego.toUpperCase()}...`, 
            ephemeral: true 
        });

        // Activar el bucle de actualización
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(updateServerStatus, 30000);
        updateServerStatus();
    }
});

async function updateServerStatus() {
    try {
        const channel = await client.channels.fetch(CANAL_ID);
        if (!channel) return console.error("❌ No se encontró el canal de Discord.");

        let embed = new EmbedBuilder();

        // MENÚ DESPLEGABLE INTERACTIVO (Estructura visual)
        const selectorJuegos = new StringSelectMenuBuilder()
            .setCustomId('seleccionar_juego')
            .setPlaceholder('👉 Selecciona aquí el juego que quieres monitorear')
            .addOptions(
                { label: 'Ark: Survival Evolved', value: 'arkse', description: 'Monitorear un servidor de Ark', emoji: '🦖' },
                { label: 'Minecraft (Java)', value: 'minecraft', description: 'Servidores de PC de Minecraft', emoji: '🟩' },
                { label: 'Minecraft (Bedrock/Móvil)', value: 'minecraftbe', description: 'Servidores de celular o consola', emoji: '📱' },
                { label: 'Rust', value: 'rust', description: 'Servidores de Rust', emoji: '🔧' }
            );

        const filaComponentes = new ActionRowBuilder().addComponents(selectorJuegos);

        // 🔵 CASO EN BLANCO: Esperando configuración
        if (!SERVER_CONFIG.host) {
            embed.setTitle('🔵 PANEL DE CONTROL EN ESPERA')
                 .setColor(0x3498db)
                 .setDescription('Utiliza el menú desplegable que tienes aquí abajo para configurar el servidor de juegos en tiempo real.')
                 .setFooter({ text: 'Listo para recibir configuración' })
                 .setTimestamp();

            return await enviarOEditar(channel, embed, filaComponentes);
        }

        // 🟢 / 🔴 CASO CON DATOS: Buscar servidor de juegos
        try {
            const state = await GameDig.query({
                type: SERVER_CONFIG.type,
                host: SERVER_CONFIG.host,
                port: SERVER_CONFIG.port,
                socketTimeout: 5000
            });

            embed.setTitle(`🟢 SERVIDOR ONLINE: ${state.name}`)
                 .setColor(0x2ecc71)
                 .addFields(
                     { name: '🎮 Juego', value: `\`${SERVER_CONFIG.type.toUpperCase()}\``, inline: true },
                     { name: '🌐 Dirección IP', value: `\`${SERVER_CONFIG.host}:${SERVER_CONFIG.port}\``, inline: true },
                     { name: '👥 Jugadores', value: `👤 **${state.players.length}** / **${state.maxplayers}**`, inline: false },
                     { name: '🗺️ Mapa', value: `📍 ${state.map || 'N/A'}`, inline: true }
                 )
                 .setFooter({ text: 'Actualiza cada 30s • Cambia de juego abajo' })
                 .setTimestamp();

            if (state.players.length > 0) {
                const listaJugadores = state.players.map(p => p.name).join(', ');
                embed.addFields({ name: '🎮 En línea actualmente:', value: listaJugadores.length > 1024 ? listaJugadores.substring(0, 1021) + '...' : listaJugadores });
            }

        } catch (error) {
            embed.setTitle('🔴 SERVIDOR OFFLINE O DATOS ERRÓNEOS')
                 .setColor(0xe74c3c)
                 .setDescription(`No se ha podido conectar con el servidor utilizando estos datos actuales:`)
                 .addFields(
                     { name: '🎮 Juego intentado', value: `\`${SERVER_CONFIG.type.toUpperCase()}\``, inline: true },
                     { name: '🌐 IP e Info', value: `\`${SERVER_CONFIG.host}:${SERVER_CONFIG.port}\``, inline: true }
                 )
                 .setFooter({ text: 'Reintentando cada 30s • Puedes corregirlo abajo' })
                 .setTimestamp();
        }

        await enviarOEditar(channel, embed, filaComponentes);

    } catch (err) {
        console.error('Error crítico en el bucle:', err);
    }
}

// Función auxiliar para enviar o editar el mensaje
async function enviarOEditar(channel, embed, componentes) {
    if (!messageRef) {
        messageRef = await channel.send({ embeds: [embed], components: [componentes] });
    } else {
        await messageRef.edit({ embeds: [embed], components: [componentes] });
    }
}

client.login(TOKEN);