// server.js
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
    ws.clientData = {
        ip: ip,
        device: userAgent, // Aquí viene el string del navegador/SO
        connectedAt: new Date().toISOString(),
    };

    // Guardamos el nombre de usuario en el objeto del socket
    ws.userName = "Anónimo"; 

    sendJson(ws, { type: 'info', message: 'Conectado exitosamente.' });

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            // 1. Lógica de UNIRSE (JOIN)
            if (parsedMessage.type === 'join') {
                const channel = parsedMessage.channel;
                
                // Si el mensaje incluye un nombre de usuario, lo guardamos
                if (parsedMessage.user) {
                    ws.userName = parsedMessage.user;
                }
                if (parsedMessage.userId) {
                    ws.userId = parsedMessage.userId;
                }
                if (!channels[channel]) channels[channel] = [];

                if (currentChannel && channels[currentChannel]) {
                    channels[currentChannel] = channels[currentChannel].filter(client => client !== ws);
                }

                channels[channel].push(ws);
                currentChannel = channel;

                sendJson(ws, {
                    type: 'system',
                    action: 'join_success',
                    channel: channel,
                    user: ws.userName,
                    message: `Te has unido como ${ws.userName}`
                });

            // 2. Lógica de Listado de USUARIOS (GET_USERS)
            }else if (parsedMessage.type === 'get_global_users') {
                const allUsers = Array.from(wss.clients).map(client => ({
                    user: client.userName || "Anónimo",
                    channel: client.currentChannelName || "Ninguno",
                    ip: client.clientData.ip,
                    device: client.clientData.device,
                    since: client.clientData.connectedAt
                }));

                sendJson(ws, {
                    type: 'system',
                    action: 'global_user_list',
                    users: allUsers
                });
            // 3. Lógica de MENSAJE (MESSAGE)
            } else if (parsedMessage.type === 'message' && currentChannel) {
                // Si envían un usuario en el mensaje de chat, actualizamos (opcional)
                const senderName = parsedMessage.user || ws.userName;

                channels[currentChannel].forEach(client => {
                    if (client !== ws) {
                        sendJson(client, {
                            type: 'chat',
                            channel: currentChannel,
                            user: senderName, // Aquí va el nombre (Anónimo o el real)
                            message: parsedMessage.message,
                            timestamp: new Date().toLocaleTimeString()
                        });
                    }
                });
            }
        } catch (error) {
            sendJson(ws, { type: 'error', message: 'Error en el formato JSON' });
        }
    });

    let currentChannel = null;

    ws.on('close', () => {
        if (currentChannel && channels[currentChannel]) {
            channels[currentChannel] = channels[currentChannel].filter(client => client !== ws);
        }
    });
});

console.log('Servidor WebSocket JSON activo en puerto 8080');