const WebSocket = require('ws');
const url = require('url');

const wss = new WebSocket.Server({ 
    host: '0.0.0.0', 
    port: 8080,
    verifyClient: (info, callback) => {
        const location = url.parse(info.req.url, true);
        const token = location.query.token;
        const TOKEN_VALIDO = "@sunl@r26";

        if (token === TOKEN_VALIDO) {
            callback(true);
        } else {
            callback(false, 401, 'Unauthorized');
        }
    }
});

const channels = {};

const sendJson = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
};

wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // --- DATOS DEL CLIENTE ---
    ws.clientData = {
        ip: ip,
        device: userAgent,
        connectedAt: new Date().toISOString(),
    };

    ws.userName = "Anónimo"; 
    ws.userId = null;
    // IMPORTANTE: Ahora usamos un Set para guardar múltiples canales
    ws.subscribedChannels = new Set(); 

    sendJson(ws, { type: 'info', message: 'Conectado exitosamente a OSUWebSocket.' });

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            // 1. UNIRSE A UN CANAL (Sin salir del anterior)
            if (parsedMessage.type === 'join') {
                const channel = parsedMessage.channel;
                if (!channel) return;

                if (parsedMessage.user) ws.userName = parsedMessage.user;
                if (parsedMessage.userId) ws.userId = parsedMessage.userId;

                // Crear el canal si no existe
                if (!channels[channel]) channels[channel] = [];

                // Solo agregarlo si no está ya en ese canal
                if (!ws.subscribedChannels.has(channel)) {
                    channels[channel].push(ws);
                    ws.subscribedChannels.add(channel);
                }

                sendJson(ws, {
                    type: 'system',
                    action: 'join_success',
                    channel: channel,
                    user: ws.userName,
                    message: `Te has unido al canal: ${channel}`
                });

            // 2. LISTADO GLOBAL (Muestra todos los canales de cada usuario)
            } else if (parsedMessage.type === 'get_global_users') {
                const allUsers = Array.from(wss.clients).map(client => ({
                    user: client.userName,
                    userId: client.userId,
                    // Convertimos el Set a Array para el JSON
                    channels: Array.from(client.subscribedChannels), 
                    ip: client.clientData?.ip,
                    since: client.clientData?.connectedAt
                }));

                sendJson(ws, { type: 'system', action: 'global_user_list', users: allUsers });

            // 3. ENVIAR MENSAJE A UN CANAL ESPECÍFICO
            } else if (parsedMessage.type === 'message') {
                const targetChannel = parsedMessage.channel;
                const msgContent = parsedMessage.message;

                // Validar que el usuario esté en el canal al que intenta escribir
                if (targetChannel && ws.subscribedChannels.has(targetChannel)) {
                    channels[targetChannel].forEach(client => {
                        if (client !== ws) {
                            sendJson(client, {
                                type: 'chat',
                                channel: targetChannel,
                                user: ws.userName,
                                message: msgContent,
                                timestamp: new Date().toLocaleTimeString()
                            });
                        }
                    });
                } else {
                    sendJson(ws, { type: 'error', message: 'No estás unido a este canal' });
                }
            }
        } catch (error) {
            sendJson(ws, { type: 'error', message: 'Error procesando el mensaje' });
        }
    });

    // 4. LIMPIEZA TOTAL AL DESCONECTAR
    ws.on('close', () => {
        ws.subscribedChannels.forEach(channelName => {
            if (channels[channelName]) {
                channels[channelName] = channels[channelName].filter(client => client !== ws);
                if (channels[channelName].length === 0) delete channels[channelName];
            }
        });
        console.log(`Cliente ${ws.userName} desconectado.`);
    });
});

console.log('Servidor Multi-Canal activo en puerto 8080');