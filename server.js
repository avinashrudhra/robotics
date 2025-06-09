const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.static('public'));

// In-memory storage for messages and users
let messages = [];
let users = new Map();
let activeSessions = new Map(); // Track active sessions per username (username -> socketId)
let disappearingMessages = new Map(); // Store disappearing message timers
let loginAttempts = new Map(); // Track login attempts for rate limiting

// Secure user credentials (hashed passwords from environment variables)
const validUsers = {
  'Pavi': process.env.USER_PAVI_PASSWORD_HASH,
  'Manu': process.env.USER_MANU_PASSWORD_HASH
};

// Security configuration
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOGIN_COOLDOWN = parseInt(process.env.LOGIN_COOLDOWN) || 900000; // 15 minutes

// Validation: Check if environment variables are properly set
if (!process.env.USER_PAVI_PASSWORD_HASH || !process.env.USER_MANU_PASSWORD_HASH) {
  console.error('❌ ERROR: User password hashes not found in environment variables!');
  console.error('📝 Please run: node setup-env.js');
  console.error('🔒 Or set USER_PAVI_PASSWORD_HASH and USER_MANU_PASSWORD_HASH in your .env file');
  process.exit(1);
}

// Chat partner mapping
const chatPartners = {
  'Pavi': 'Manu',
  'Manu': 'Pavi'
};

// Multer configuration for file uploads
const upload = multer({
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 }, // Use env var or 2MB default
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed'), false);
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'employeelogin.html'));
});

app.get('/employeelogin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'employeelogin.html'));
});

// Rate limiting helper function
function checkRateLimit(clientIP) {
  const now = Date.now();
  const attempts = loginAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
  
  // Reset counter if cooldown period has passed
  if (now - attempts.lastAttempt > LOGIN_COOLDOWN) {
    attempts.count = 0;
  }
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeLeft = Math.ceil((LOGIN_COOLDOWN - (now - attempts.lastAttempt)) / 1000 / 60);
    return { allowed: false, timeLeft };
  }
  
  return { allowed: true };
}

function recordLoginAttempt(clientIP, success) {
  const now = Date.now();
  const attempts = loginAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
  
  if (success) {
    // Reset on successful login
    loginAttempts.delete(clientIP);
  } else {
    // Increment failed attempts
    attempts.count += 1;
    attempts.lastAttempt = now;
    loginAttempts.set(clientIP, attempts);
  }
}

// Secure login endpoint with bcrypt and rate limiting
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Input validation
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and password are required' 
    });
  }
  
  // Rate limiting check
  const rateLimitCheck = checkRateLimit(clientIP);
  if (!rateLimitCheck.allowed) {
    console.log(`🚫 Rate limit exceeded for IP: ${clientIP}`);
    return res.status(429).json({ 
      success: false, 
      message: `Too many login attempts. Please try again in ${rateLimitCheck.timeLeft} minutes.` 
    });
  }
  
  try {
    // Find matching username (case insensitive)
    const matchedUsername = Object.keys(validUsers).find(
      validUser => validUser.toLowerCase() === username.toLowerCase()
    );
    
    if (matchedUsername && validUsers[matchedUsername]) {
      // Compare the provided password with the hashed password
      const isPasswordValid = await bcrypt.compare(password, validUsers[matchedUsername]);
      
      if (isPasswordValid) {
        // Successful login
        recordLoginAttempt(clientIP, true);
        const chatPartner = chatPartners[matchedUsername];
        
        // Check if user already has an active session
        if (activeSessions.has(matchedUsername)) {
          const oldSocketId = activeSessions.get(matchedUsername);
          const oldSocket = io.sockets.sockets.get(oldSocketId);
          
          if (oldSocket) {
            console.log(`🔄 Disconnecting old session for ${matchedUsername} (${oldSocketId})`);
            oldSocket.emit('force-logout', { reason: 'New login from another location' });
            oldSocket.disconnect(true);
          }
          
          // Clean up old session data
          users.delete(oldSocketId);
        }
        
        console.log(`✅ Successful login: ${matchedUsername} from IP: ${clientIP}`);
        
        res.json({ 
          success: true, 
          username: matchedUsername, // Use the correct case from validUsers
          chatPartner: chatPartner
        });
      } else {
        // Invalid password
        recordLoginAttempt(clientIP, false);
        console.log(`❌ Invalid password for user: ${username} from IP: ${clientIP}`);
        
        res.status(401).json({ 
          success: false, 
          message: 'Invalid username or password' 
        });
      }
    } else {
      // Invalid username
      recordLoginAttempt(clientIP, false);
      console.log(`❌ Invalid username: ${username} from IP: ${clientIP}`);
      
      res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
  } catch (error) {
    console.error('🔥 Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Convert file to base64
  const base64 = req.file.buffer.toString('base64');
  const fileData = {
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size,
    data: `data:${req.file.mimetype};base64,${base64}`
  };
  
  res.json({ file: fileData });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle user join
  socket.on('user-join', (userData) => {
    const username = userData.username || `User_${socket.id.substring(0, 6)}`;
    const chatPartner = userData.chatPartner || null;
    
    // Check if this is a valid user
    if (!validUsers[username]) {
      socket.emit('error', { message: 'Invalid user' });
      socket.disconnect(true);
      return;
    }
    
    // Check user limit (max 2 users: Manu and Pavi)
    if (activeSessions.size >= 2 && !activeSessions.has(username)) {
      socket.emit('error', { message: 'Chat room is full. Maximum 2 users allowed.' });
      socket.disconnect(true);
      return;
    }
    
    // Check if user already has an active session (double check)
    if (activeSessions.has(username) && activeSessions.get(username) !== socket.id) {
      const oldSocketId = activeSessions.get(username);
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      
      if (oldSocket) {
        console.log(`🔄 Force disconnecting old session for ${username} (${oldSocketId})`);
        oldSocket.emit('force-logout', { reason: 'New login from another location' });
        oldSocket.disconnect(true);
      }
      
      // Clean up old session data
      users.delete(oldSocketId);
    }
    
    // Register new active session
    activeSessions.set(username, socket.id);
    
    users.set(socket.id, {
      id: socket.id,
      username: username,
      chatPartner: chatPartner,
      online: true,
      lastSeen: new Date()
    });
    
    console.log(`✅ ${username} joined the chat (partner: ${chatPartner})`);
    logActiveSessions();
    
    // Send existing messages to new user
    socket.emit('load-messages', messages);
    
    // Restart disappearing message timers for existing messages
    messages.forEach(message => {
      if (message.disappearing && message.disappearTime && !message.deleted && !disappearingMessages.has(message.id)) {
        if (typeof message.disappearTime === 'string' && message.disappearTime.startsWith('read_')) {
          // For "after read + time" messages
          if (message.read && message.readAt) {
            const timeAfterRead = parseInt(message.disappearTime.split('_')[1]);
            const timeSinceRead = (Date.now() - new Date(message.readAt).getTime()) / 1000;
            const remainingTime = timeAfterRead - timeSinceRead;
            
            if (remainingTime > 0) {
              const timer = setTimeout(() => {
                deleteMessage(message.id, true);
              }, remainingTime * 1000);
              
              disappearingMessages.set(message.id, timer);
              console.log(`Restarted "after read + time" timer for message ${message.id}, remaining: ${remainingTime}s`);
            } else {
              deleteMessage(message.id, true);
              console.log(`Auto-deleted expired "after read + time" message ${message.id}`);
            }
          }
          // If not read yet, timer will start when marked as read
        } else {
          // Regular time-based disappearing message
          const messageAge = (Date.now() - new Date(message.timestamp).getTime()) / 1000;
          const remainingTime = message.disappearTime - messageAge;
          
          if (remainingTime > 0) {
            // Message still has time left
            const timer = setTimeout(() => {
              deleteMessage(message.id, true); // true indicates disappearing message
            }, remainingTime * 1000);
            
            disappearingMessages.set(message.id, timer);
            console.log(`Restarted disappearing timer for message ${message.id}, remaining: ${remainingTime}s`);
          } else {
            // Message should have already disappeared
            deleteMessage(message.id, true); // true indicates disappearing message
            console.log(`Auto-deleted expired message ${message.id}`);
          }
        }
      }
    });
    
    // Broadcast user list update
    broadcastUserList();
  });
  
  // Handle chat messages
  socket.on('chat-message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const message = {
      id: Date.now() + Math.random(),
      text: data.text,
      username: user.username,
      userId: socket.id,
      timestamp: new Date(),
      delivered: false,
      read: false,
      edited: false,
      deleted: false,
      type: 'text',
      disappearing: data.disappearing || false,
      disappearTime: data.disappearTime || null,
      replyTo: data.replyTo || null
    };
    
    messages.push(message);
    
    // Broadcast message to all clients
    io.emit('message-received', message);
    
    // Handle disappearing messages
    if (message.disappearing && message.disappearTime) {
      if (typeof message.disappearTime === 'string' && message.disappearTime.startsWith('read_')) {
        // Don't start timer immediately for "after read + time" messages
        // Timer will start when message is marked as read
        console.log(`Message ${message.id} set to disappear after being read + ${message.disappearTime.split('_')[1]}s`);
      } else {
        // Regular time-based disappearing message
        const timer = setTimeout(() => {
          deleteMessage(message.id, true); // true indicates disappearing message
        }, message.disappearTime * 1000);
        
        disappearingMessages.set(message.id, timer);
      }
    }
    
    // Mark as delivered after a short delay
    setTimeout(() => {
      message.delivered = true;
      io.emit('message-status-update', { messageId: message.id, status: 'delivered' });
    }, 100);
  });
  
  // Handle image messages
  socket.on('image-message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const message = {
      id: Date.now() + Math.random(),
      username: user.username,
      userId: socket.id,
      timestamp: new Date(),
      delivered: false,
      read: false,
      edited: false,
      deleted: false,
      type: 'image',
      imageData: data.imageData,
      imageName: data.imageName,
      disappearing: data.disappearing || false,
      disappearTime: data.disappearTime || null
    };
    
    messages.push(message);
    io.emit('message-received', message);
    
    // Handle disappearing images
    if (message.disappearing && message.disappearTime) {
      if (typeof message.disappearTime === 'string' && message.disappearTime.startsWith('read_')) {
        console.log(`Image ${message.id} set to disappear after being read + ${message.disappearTime.split('_')[1]}s`);
      } else {
        const timer = setTimeout(() => {
          deleteMessage(message.id, true); // true indicates disappearing message
        }, message.disappearTime * 1000);
        
        disappearingMessages.set(message.id, timer);
      }
    }
    
    setTimeout(() => {
      message.delivered = true;
      io.emit('message-status-update', { messageId: message.id, status: 'delivered' });
    }, 100);
  });
  
  // Handle voice messages
  socket.on('voice-message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const message = {
      id: Date.now() + Math.random(),
      username: user.username,
      userId: socket.id,
      timestamp: new Date(),
      delivered: false,
      read: false,
      edited: false,
      deleted: false,
      type: 'voice',
      voiceData: data.voiceData,
      duration: data.duration,
      disappearing: data.disappearing || false,
      disappearTime: data.disappearTime || null
    };
    
    messages.push(message);
    io.emit('message-received', message);
    
    if (message.disappearing && message.disappearTime) {
      if (typeof message.disappearTime === 'string' && message.disappearTime.startsWith('read_')) {
        console.log(`Voice message ${message.id} set to disappear after being read + ${message.disappearTime.split('_')[1]}s`);
      } else {
        const timer = setTimeout(() => {
          deleteMessage(message.id, true); // true indicates disappearing message
        }, message.disappearTime * 1000);
        
        disappearingMessages.set(message.id, timer);
      }
    }
    
    setTimeout(() => {
      message.delivered = true;
      io.emit('message-status-update', { messageId: message.id, status: 'delivered' });
    }, 100);
  });
  
  // Handle typing indicators
  socket.on('typing-start', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('user-typing', user.username);
    }
  });
  
  socket.on('typing-stop', () => {
    socket.broadcast.emit('user-stop-typing');
  });
  
  // Handle message read status
  socket.on('messages-read', (messageIds) => {
    const user = users.get(socket.id);
    if (!user) {
      console.log('Warning: User not found for socket ID:', socket.id);
      return;
    }
    
    console.log(`${user.username} marking messages as read:`, messageIds);
    
    messageIds.forEach(id => {
      // Convert to number for consistent comparison
      const messageId = typeof id === 'string' ? parseFloat(id) : id;
      const message = messages.find(m => m.id == messageId); // Use == for type coercion
      if (message && message.userId !== socket.id) {
        message.read = true;
        message.readAt = new Date();
        console.log(`Message ${messageId} marked as read by ${user.username}`);
        
        // Handle "after read + time" disappearing messages
        if (message.disappearing && typeof message.disappearTime === 'string' && message.disappearTime.startsWith('read_')) {
          const timeAfterRead = parseInt(message.disappearTime.split('_')[1]);
          
          console.log(`🔍 Found "after read + time" message: ${messageId}, disappearTime: ${message.disappearTime}, timeAfterRead: ${timeAfterRead}s`);
          
          // Clear existing timer if any
          if (disappearingMessages.has(messageId)) {
            clearTimeout(disappearingMessages.get(messageId));
            console.log(`🧹 Cleared existing timer for message ${messageId}`);
          }
          
          // Start new timer from read time
          const timer = setTimeout(() => {
            deleteMessage(messageId, true); // true indicates disappearing message
            console.log(`💨 Message ${messageId} disappeared after being read + ${timeAfterRead}s`);
          }, timeAfterRead * 1000);
          
          disappearingMessages.set(messageId, timer);
          console.log(`⏰ Started "after read + ${timeAfterRead}s" timer for message ${messageId}`);
        }
      } else if (!message) {
        console.log(`⚠️ Message not found for ID: ${messageId}`);
      }
    });
    
    io.emit('messages-read-update', messageIds);
    console.log('Emitted read update for messages:', messageIds);
  });
  
  // Handle message editing
  socket.on('edit-message', (data) => {
    const message = messages.find(m => m.id === data.messageId && m.userId === socket.id);
    if (message && !message.deleted) {
      message.text = data.newText;
      message.edited = true;
      message.editedAt = new Date();
      
      io.emit('message-edited', {
        messageId: data.messageId,
        newText: data.newText,
        editedAt: message.editedAt
      });
    }
  });
  
  // Handle message deletion
  socket.on('delete-message', (messageId) => {
    const message = messages.find(m => m.id === messageId && m.userId === socket.id);
    if (message) {
      deleteMessage(messageId);
    }
  });
  
  // Handle clear chat
  socket.on('clear-chat', () => {
    messages = [];
    // Clear all disappearing message timers
    disappearingMessages.forEach(timer => clearTimeout(timer));
    disappearingMessages.clear();
    
    io.emit('chat-cleared');
  });
  
  // Handle disappearing message settings sync
  socket.on('disappearing-settings-update', (data) => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`${user.username} updated disappearing settings:`, data);
      
      // Broadcast to all users (including sender to confirm)
      io.emit('disappearing-settings-sync', {
        username: user.username,
        disappearingEnabled: data.disappearingEnabled,
        disappearingTime: data.disappearingTime
      });
    }
  });

  // Handle profile picture updates
  socket.on('profile-picture-update', (data) => {
    const user = users.get(socket.id);
    if (user && user.username === data.username) {
      console.log(`${user.username} updated their profile picture`);
      
      // Broadcast to all other users
      socket.broadcast.emit('profile-picture-update', {
        username: data.username,
        profilePicture: data.profilePicture
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`${user.username} disconnected`);
      
      // Remove from active sessions if this is the current session
      if (activeSessions.get(user.username) === socket.id) {
        activeSessions.delete(user.username);
        console.log(`🔄 Removed active session for ${user.username}`);
        logActiveSessions();
      }
      
      users.delete(socket.id);
      broadcastUserList();
    }
  });
});

// Helper functions
function broadcastUserList() {
  const userList = Array.from(users.values());
  io.emit('user-list-update', userList);
}

function logActiveSessions() {
  console.log('🔄 Active Sessions:', Object.fromEntries(activeSessions));
  console.log('👥 Total Users:', users.size);
}

function deleteMessage(messageId, isDisappearing = false) {
  const message = messages.find(m => m.id === messageId);
  if (message) {
    if (isDisappearing) {
      // For disappearing messages, completely remove from array
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        messages.splice(messageIndex, 1);
      }
      io.emit('message-disappeared', messageId);
    } else {
      // For manually deleted messages, mark as deleted
      message.deleted = true;
      message.deletedAt = new Date();
      io.emit('message-deleted', messageId);
    }
    
    // Clear disappearing timer if exists
    if (disappearingMessages.has(messageId)) {
      clearTimeout(disappearingMessages.get(messageId));
      disappearingMessages.delete(messageId);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🤖 Robotic Electronics Chat Server running on http://localhost:${PORT}`);
  console.log(`📱 Access the app at: http://localhost:${PORT}`);
}); 