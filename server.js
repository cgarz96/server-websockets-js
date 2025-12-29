// server.js
const WebSocket = require('ws');

const url = require('url');
// Crea el servidor WebSocket


const wss = new WebSocket.Server({ 
    host: '0.0.0.0', 
    port: 8080,
        // Verificación antes de aceptar la conexión  
        verifyClient: (info, callback) => {
        const location = url.parse(info.req.url, true);
        const token = location.query.token;

        // AQUÍ VALIDAS EL TOKEN (puedes compararlo con una DB o un string)
        const TOKEN_VALIDO = "@sunl@r26";

        if (token === TOKEN_VALIDO) {
            callback(true); // Acepta la conexión     
            } else {
            console.log('Intento de conexión fallido: Token inválido');
            callback(false, 401, 'Unauthorized'); // Rechaza la conexión   
            }
    }
});

// Objeto para almacenar los clientes por canal
const channels = {};

wss.on('connection', (ws,req) => {
  
  const ip = req.socket.remoteAddress;
  console.log('Nuevo cliente conectado desde IP:',ip);
  // Variable para saber a qu\Uffffffffanal est\Uffffffffuscrito el cliente
  let currentChannel = null;

  // Cuando el cliente env\Uffffffffun mensaje
  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage.type === 'join') {
      // El cliente quiere unirse a un canal
      const channel = parsedMessage.channel;

      if (!channels[channel]) {
        channels[channel] = [];
      }
      console.log(channels)
      // Si ya est\Uffffffffn un canal anterior, lo quitamos de ese canal
      if (currentChannel && channels[currentChannel]) {
        channels[currentChannel] = channels[currentChannel].filter(client => client !== ws);
      }

      // Agregar al cliente al canal nuevo
      channels[channel].push(ws);
      currentChannel = channel;

      ws.send(`Te has unido al canal: ${channel}`);
      console.log(`Cliente se uni\Uffffffff canal: ${channel}`);
    } else if (parsedMessage.type === 'message' && currentChannel) {
      // El cliente est\Uffffffffnviando un mensaje a su canal actual
      const messageContent = parsedMessage.message;
      console.log(`Mensaje en canal ${currentChannel}: ${messageContent}`);

      // Enviar el mensaje a todos los clientes del canal
      channels[currentChannel].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(`${currentChannel}: ${messageContent}`);
        }
      });
    }
  });

  // Cuando el cliente se desconecta
  ws.on('close', () => {
    if (currentChannel && channels[currentChannel]) {
      // Eliminar al cliente del canal
      channels[currentChannel] = channels[currentChannel].filter(client => client !== ws);
      console.log(`Cliente desconectado del canal: ${currentChannel}`);
    }
  });

  // Enviar un mensaje de bienvenida al cliente
  ws.send('Bienvenido al servidor WebSocket.');
  //ws.send('Bienvenido al servidor WebSocket. \Uffffffffete a un canal con el comando "join".');
});
// Ping peri\Uffffffffo a cada cliente para mantener la conexi\Uffffffffiva
setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping(); // Enviar un "ping"
      }
    });
}, 30000); // cada 30 segundos
// Informar que el servidor est\Ufffffffforriendo
console.log('Servidor WebSocket escuchando en ws://localhost:8080');