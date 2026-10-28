'use strict';

const { WebSocketServer, WebSocket } = require('ws');

function attachWebSocket(server, auth, garden) {
  const sockets = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });

  sockets.on('connection', function onConnection(socket) {
    let authenticating = false;
    let sessionDeadline = null;
    const deadline = setTimeout(function requireAuthentication() {
      socket.close(4401, 'Authentication required');
    }, 5000);
    socket.on('error', function ignoreClosedSocket() {
      // Sự kiện close chịu trách nhiệm dọn tài nguyên của socket.
    });
    socket.on('close', function cleanupSocket() {
      clearTimeout(deadline);
      clearTimeout(sessionDeadline);
    });
    socket.on('message', async function authenticate(payload) {
      if (socket.user || authenticating) {
        return;
      }
      authenticating = true;
      try {
        const message = JSON.parse(payload.toString());
        if (message.type !== 'auth' || typeof message.token !== 'string') {
          throw new Error('Authentication required');
        }
        socket.user = await auth.verify(message.token);
        socket.token = message.token;
        clearTimeout(deadline);
        sessionDeadline = setTimeout(function expireSession() {
          socket.close(4401, 'Session expired');
        }, Math.max(1, socket.user.sessionExpiresAt - Date.now()));
        socket.send(JSON.stringify({ type: 'ready', data: garden.status() }));
      } catch (_) {
        socket.close(4401, 'Invalid session');
      }
    });
  });

  function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    for (const socket of sockets.clients) {
      if (socket.user && socket.readyState === WebSocket.OPEN) {
        if (socket.bufferedAmount > 1024 * 1024) {
          socket.terminate();
        } else {
          socket.send(message);
        }
      }
    }
  }

  const handlers = [];
  for (const type of ['sensors', 'command', 'devices', 'status']) {
    const handler = function forwardEvent(data) {
      broadcast(type, data);
    };
    garden.on(type, handler);
    handlers.push([type, handler]);
  }

  function revokeUser(userId) {
    for (const socket of sockets.clients) {
      if (socket.user && socket.user.id === userId) {
        socket.close(4401, 'Session revoked');
      }
    }
  }
  garden.on('revoke', revokeUser);

  const heartbeat = setInterval(async function checkSessions() {
    for (const socket of sockets.clients) {
      if (!socket.user) {
        continue;
      }
      try {
        await auth.verify(socket.token);
        socket.ping();
      } catch (_) {
        socket.close(4401, 'Session expired');
      }
    }
  }, 30000);
  heartbeat.unref();

  return function closeWebSocket() {
    clearInterval(heartbeat);
    for (const [type, handler] of handlers) {
      garden.off(type, handler);
    }
    garden.off('revoke', revokeUser);
    for (const socket of sockets.clients) {
      socket.terminate();
    }
    sockets.close();
  };
}

module.exports = { attachWebSocket };
