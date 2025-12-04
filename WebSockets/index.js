const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('client connected:', socket.id);

  // set username for this user
  socket.on('set-username', (name) => {
    if (typeof name === 'string') {
      socket.username = name.trim() || 'Anonymous';
    } else {
      socket.username = 'Anonymous';
    }
  });

  // when a user sends a chat message
  socket.on('user-message', (message) => {
    const text = message.trim();
    if (!text) return;

    const user = socket.username || 'user';// ron

    // send to everyone
    io.emit('message', { user, text });
  });

  socket.on('disconnect', () => {
    console.log('client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8005;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
