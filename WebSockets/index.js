const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

// Initialize database
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create messages table if not exists
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const onlineUsers = [];
const typingUsers = [];

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

    // Add to online users if not already
    if (!onlineUsers.includes(socket.username)) {
      onlineUsers.push(socket.username);
      // Notify all clients
      io.emit('online-users', onlineUsers);
    }

    // Send recent messages to new user
    db.all('SELECT username, message, timestamp FROM messages ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
      if (err) {
        console.error(err.message);
      } else {
        // Send in reverse to get chronological order
        const messages = rows.reverse().map(row => ({ user: row.username, text: row.message, timestamp: row.timestamp }));
        socket.emit('message-history', messages);
      }
    });
  });

  // when a user sends a chat message
  socket.on('user-message', (message) => {
    const text = message.trim();
    if (!text) return;

    const user = socket.username || 'Anonymous';

    // Save to database
    db.run('INSERT INTO messages (username, message) VALUES (?, ?)', [user, text], function (err) {
      if (err) {
        console.error('Error saving message:', err.message);
      } else {
        // Send to everyone including sender
        io.emit('message', { user, text, id: this.lastID });
      }
    });
  });

  socket.on('typing', () => {
    if (!typingUsers.includes(socket.username)) {
      typingUsers.push(socket.username);
      io.emit('typing-users', typingUsers);
    }
  });

  socket.on('stop-typing', () => {
    const index = typingUsers.indexOf(socket.username);
    if (index > -1) {
      typingUsers.splice(index, 1);
      io.emit('typing-users', typingUsers);
    }
  });

  socket.on('disconnect', () => {
    console.log('client disconnected:', socket.id);

    // Remove from online users
    const index = onlineUsers.indexOf(socket.username);
    if (index > -1) {
      onlineUsers.splice(index, 1);
      io.emit('online-users', onlineUsers);
    }

    // Remove from typing if was
    const tIndex = typingUsers.indexOf(socket.username);
    if (tIndex > -1) {
      typingUsers.splice(tIndex, 1);
      io.emit('typing-users', typingUsers);
    }
  });
});

const PORT = process.env.PORT || 8005;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
