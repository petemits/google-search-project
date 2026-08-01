const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store chat messages and online users
let messages = [];
let onlineUsers = new Map();

// Serve the chat interface
app.get('/', (req, res) => {
    const port = process.env.PORT || 3000;
    res.send(\`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ai-chat-app-1762692448692</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .chat-container {
                width: 90%;
                max-width: 800px;
                height: 90vh;
                background: white;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
            }
            .chat-header {
                background: #2c3e50;
                color: white;
                padding: 20px;
                border-radius: 15px 15px 0 0;
                text-align: center;
            }
            .chat-messages {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                background: #f8f9fa;
            }
            .message {
                margin-bottom: 15px;
                padding: 10px 15px;
                border-radius: 10px;
                max-width: 70%;
            }
            .message.own {
                background: #007bff;
                color: white;
                margin-left: auto;
            }
            .message.other {
                background: white;
                border: 1px solid #e9ecef;
            }
            .message-system {
                background: #ffc107;
                color: #212529;
                text-align: center;
                max-width: 100%;
                font-style: italic;
            }
            .chat-input {
                padding: 20px;
                background: white;
                border-radius: 0 0 15px 15px;
                display: flex;
                gap: 10px;
            }
            .chat-input input {
                flex: 1;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 16px;
            }
            .chat-input button {
                padding: 10px 20px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            }
            .online-users {
                background: #e9ecef;
                padding: 10px 20px;
                font-size: 14px;
                color: #6c757d;
            }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <div class="chat-header">
                <h1>💬 ai-chat-app-1762692448692</h1>
                <p>ai chat app</p>
            </div>
            <div class="online-users" id="onlineUsers">
                Online users: <span id="userCount">0</span>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="message message-system">
                    Welcome to the chat! Enter your username to start chatting.
                </div>
            </div>
            <div class="chat-input">
                <input type="text" id="messageInput" placeholder="Type your message..." disabled>
                <button id="sendButton" disabled>Send</button>
            </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            const chatMessages = document.getElementById('chatMessages');
            const messageInput = document.getElementById('messageInput');
            const sendButton = document.getElementById('sendButton');
            const userCount = document.getElementById('userCount');
            let username = '';

            // Ask for username
            while (!username) {
                username = prompt('Enter your username:');
                if (username) {
                    socket.emit('join', username);
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    messageInput.focus();
                }
            }

            // Send message
            sendButton.addEventListener('click', sendMessage);
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });

            function sendMessage() {
                const message = messageInput.value.trim();
                if (message) {
                    socket.emit('chat message', {
                        username: username,
                        message: message,
                        timestamp: new Date().toISOString()
                    });
                    messageInput.value = '';
                }
            }

            // Socket event handlers
            socket.on('chat message', (data) => {
                const messageDiv = document.createElement('div');
                messageDiv.className = \`message \${data.username === username ? 'own' : 'other'}\`;
                messageDiv.innerHTML = \`
                    <strong>\${data.username}:</strong> \${data.message}
                    <br><small>\${new Date(data.timestamp).toLocaleTimeString()}</small>
                \`;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });

            socket.on('user joined', (data) => {
                const systemDiv = document.createElement('div');
                systemDiv.className = 'message message-system';
                systemDiv.textContent = \`🎉 \${data.username} joined the chat\`;
                chatMessages.appendChild(systemDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                userCount.textContent = data.userCount;
            });

            socket.on('user left', (data) => {
                const systemDiv = document.createElement('div');
                systemDiv.className = 'message message-system';
                systemDiv.textContent = \`👋 \${data.username} left the chat\`;
                chatMessages.appendChild(systemDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                userCount.textContent = data.userCount;
            });

            socket.on('user count update', (data) => {
                userCount.textContent = data.userCount;
            });
        </script>
    </body>
    </html>
    \`);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (username) => {
        onlineUsers.set(socket.id, username);
        
        // Send chat history to the new user
        socket.emit('chat history', messages);
        
        // Notify all users about the new user
        const joinMessage = {
            username: 'System',
            message: \`\${username} joined the chat\`,
            timestamp: new Date().toISOString()
        };
        
        messages.push(joinMessage);
        io.emit('user joined', {
            username: username,
            userCount: onlineUsers.size
        });
        io.emit('chat message', joinMessage);
    });

    socket.on('chat message', (data) => {
        messages.push(data);
        io.emit('chat message', data);
    });

    socket.on('disconnect', () => {
        const username = onlineUsers.get(socket.id);
        if (username) {
            onlineUsers.delete(socket.id);
            
            const leaveMessage = {
                username: 'System',
                message: \`\${username} left the chat\`,
                timestamp: new Date().toISOString()
            };
            
            messages.push(leaveMessage);
            io.emit('user left', {
                username: username,
                userCount: onlineUsers.size
            });
            io.emit('chat message', leaveMessage);
        }
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log('🚀 Chat app running at http://localhost:' + PORT);
    console.log('💬 Open http://localhost:' + PORT + ' to start chatting');
    console.log('🕒 Started at: ' + new Date().toLocaleString());
});