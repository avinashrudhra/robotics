console.log('Chat script loading...');

// Global variables
let socket;
let currentUser;
let chatPartner;
let isTyping = false;
let typingTimeout;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingStartTime;
let recordingTimer;
let disappearingMessagesEnabled = false;
let disappearingTime = 0;
let soundEnabled = true;
let isDarkMode = false;
let currentBackground = 'default';
let currentMessageSize = 'medium';

// Inactivity logout variables
let inactivityTimer;
let lastActivityTime = Date.now();
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

// WebRTC Call System
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isCallActive = false;
let isCallMinimized = false;
let callType = null; // 'voice' or 'video'
let callStartTime = null;
let callTimer = null;
let isMuted = false;
let isCameraOff = false;

// ICE servers configuration
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// DOM elements
const elements = {
    userStatus: document.getElementById('userStatus'),
    typingIndicator: document.getElementById('typingIndicator'),
    messagesList: document.getElementById('messagesList'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    fileInput: document.getElementById('fileInput'),
    attachBtn: document.getElementById('attachBtn'),
    photoBtn: document.getElementById('photoBtn'),
    voiceBtn: document.getElementById('voiceBtn'),
    emojiBtn: document.getElementById('emojiBtn'),
    themeToggle: document.getElementById('themeToggle'),
    disappearingToggle: document.getElementById('disappearingToggle'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    voiceCallBtn: document.getElementById('voiceCallBtn'),
    videoCallBtn: document.getElementById('videoCallBtn'),
    
    // Modals
    imageModal: document.getElementById('imageModal'),
    settingsModal: document.getElementById('settingsModal'),
    confirmModal: document.getElementById('confirmModal'),
    voiceModal: document.getElementById('voiceModal'),
    incomingCallModal: document.getElementById('incomingCallModal'),
    activeCallModal: document.getElementById('activeCallModal'),
    
    // Modal elements
    modalImage: document.getElementById('modalImage'),
    downloadImageBtn: document.getElementById('downloadImageBtn'),
    voiceTimer: document.getElementById('voiceTimer'),
    voiceCancelBtn: document.getElementById('voiceCancelBtn'),
    voiceStopBtn: document.getElementById('voiceStopBtn'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmOk: document.getElementById('confirmOk'),
    confirmCancel: document.getElementById('confirmCancel'),
    soundToggle: document.getElementById('soundToggle'),
    
    // Call elements
    minimizedCall: document.getElementById('minimizedCall'),
    emojiPicker: document.getElementById('emojiPicker')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up login...');
    setupLogin();
    setupEventListeners();
    loadSettings();
});

// Setup login modal
function setupLogin() {
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const loginError = document.getElementById('loginError');
    
    // Always show login modal - no auto-login
    loginModal.classList.add('show');
    
    // Setup login form event listeners
    function validateForm() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        return username.length > 0 && password.length > 0;
    }
    
    usernameInput.addEventListener('input', validateForm);
    passwordInput.addEventListener('input', validateForm);
    
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            attemptLogin();
        }
    });
    
    // Setup login button
    loginBtn.addEventListener('click', attemptLogin);
    
    // Setup window close logout
    window.addEventListener('beforeunload', function() {
        // Clear any stored login data when window is closing
        localStorage.removeItem('loginData');
        
        // Disconnect socket if connected
        if (socket && socket.connected) {
            socket.disconnect();
        }
    });
    
    // Additional logout on window unload
    window.addEventListener('unload', function() {
        localStorage.removeItem('loginData');
        if (socket && socket.connected) {
            socket.disconnect();
        }
    });
    
    // Handle page visibility changes (tab switching, etc.)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            // Page is hidden (user switched tabs or minimized window)
            // Don't logout immediately, but prepare for potential logout
        }
    });
    
    // Focus on username input
    setTimeout(() => usernameInput.focus(), 300);
    
    async function attemptLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!validateForm()) {
            showLoginError('Please enter both username and password.');
            return;
        }
        
        // Show loading state
        loginBtn.classList.add('loading');
        loginBtn.disabled = true;
        loginError.style.display = 'none';
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (result.success) {
                currentUser = result.username;
                chatPartner = result.chatPartner;
                
                // Don't save login data - user must login each time
                
                // Hide login modal with animation
                loginModal.style.opacity = '0';
                loginModal.style.transform = 'scale(0.9)';
                
                setTimeout(() => {
                    loginModal.classList.remove('show');
                    initializeChat();
                }, 300);
                
            } else {
                showLoginError(result.message || 'Login failed. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showLoginError('Connection error. Please try again.');
        } finally {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    }
    
    function showLoginError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
        loginError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Initialize Socket.io connection and chat
function initializeChat() {
    socket = io();
    
    // Join the chat with the provided user data
    socket.emit('user-join', {
        username: currentUser,
        chatPartner: chatPartner
    });
    
    // Socket event listeners
    setupSocketListeners();
    
    // Update header with chat partner name
    updateChatHeader();
    
    // Load saved profile pictures
    loadProfilePictures();
    
    console.log('Chat initialized for user:', currentUser, 'chatting with:', chatPartner);
}

// Update chat header with chat partner info
function updateChatHeader() {
    const chatTitle = document.querySelector('.chat-title');
    if (chatTitle && chatPartner) {
        chatTitle.textContent = `${chatPartner}'s Chat`;
    }
}

// Setup all socket event listeners
function setupSocketListeners() {
    // Connection status
    socket.on('connect', () => {
        updateUserStatus('online', 'Online');
        playNotificationSound('connect');
    });
    
    socket.on('disconnect', () => {
        updateUserStatus('offline', 'Disconnected');
    });
    
    // Load existing messages
    socket.on('load-messages', (messages) => {
        messages.forEach(message => {
            if (!message.deleted) {
                displayMessage(message);
                
                // Handle client-side disappearing message display
                if (message.disappearing && message.disappearTime) {
                    const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
                    if (messageElement) {
                        messageElement.classList.add('disappearing-message');
                        
                        const timerElement = document.createElement('div');
                        timerElement.className = 'disappearing-timer';
                        
                        if (typeof message.disappearTime === 'string' && message.disappearTime.startsWith('read_')) {
                            const timeAfterRead = parseInt(message.disappearTime.split('_')[1]);
                            if (message.read && message.readAt) {
                                const timeSinceRead = (Date.now() - new Date(message.readAt).getTime()) / 1000;
                                const remainingTime = timeAfterRead - timeSinceRead;
                                if (remainingTime > 0) {
                                    timerElement.textContent = `👁️ ${Math.ceil(remainingTime)}s left`;
                                    
                                    const countdown = setInterval(() => {
                                        const newRemainingTime = timeAfterRead - ((Date.now() - new Date(message.readAt).getTime()) / 1000);
                                        if (newRemainingTime <= 0) {
                                            clearInterval(countdown);
                                            timerElement.textContent = '👁️ 0s';
                                        } else {
                                            timerElement.textContent = `👁️ ${Math.ceil(newRemainingTime)}s left`;
                                        }
                                    }, 1000);
                                } else {
                                    timerElement.textContent = '👁️ Expired';
                                }
                            } else {
                                timerElement.textContent = `👁️ After read + ${timeAfterRead}s`;
                            }
                        } else {
                            const messageAge = (Date.now() - new Date(message.timestamp).getTime()) / 1000;
                            const remainingTime = message.disappearTime - messageAge;
                            
                            if (remainingTime > 0) {
                                timerElement.textContent = `🕐 ${Math.ceil(remainingTime)}s`;
                                
                                const countdown = setInterval(() => {
                                    const newRemainingTime = message.disappearTime - ((Date.now() - new Date(message.timestamp).getTime()) / 1000);
                                    if (newRemainingTime <= 0) {
                                        clearInterval(countdown);
                                        timerElement.textContent = '🕐 0s';
                                    } else {
                                        timerElement.textContent = `🕐 ${Math.ceil(newRemainingTime)}s`;
                                    }
                                }, 1000);
                            }
                        }
                        
                        messageElement.querySelector('.message-meta').appendChild(timerElement);
                    }
                }
            }
        });
        scrollToBottom();
    });
    
    // New message received
    socket.on('message-received', (message) => {
        displayMessage(message);
        
        // Handle disappearing message visual indicator
        if (message.disappearing && message.disappearTime) {
            const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
            if (messageElement) {
                messageElement.classList.add('disappearing-message');
                
                // Add timer display
                const timerElement = document.createElement('div');
                timerElement.className = 'disappearing-timer';
                
                if (typeof message.disappearTime === 'string' && message.disappearTime.startsWith('read_')) {
                    const timeAfterRead = parseInt(message.disappearTime.split('_')[1]);
                    timerElement.textContent = `👁️ After read + ${timeAfterRead}s`;
                } else {
                    timerElement.textContent = `🕐 ${message.disappearTime}s`;
                    
                    // Update countdown every second for regular messages
                    let remainingTime = message.disappearTime;
                    const countdown = setInterval(() => {
                        remainingTime--;
                        if (remainingTime <= 0) {
                            clearInterval(countdown);
                            timerElement.textContent = '🕐 0s';
                        } else {
                            timerElement.textContent = `🕐 ${remainingTime}s`;
                        }
                    }, 1000);
                }
                
                messageElement.querySelector('.message-meta').appendChild(timerElement);
            }
        }
        
        // Only mark messages as read if they're not from current user
        if (message.username !== currentUser) {
            // Mark message as read after a short delay
            setTimeout(() => {
                const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
                if (messageElement && !messageElement.dataset.isRead) {
                    socket.emit('messages-read', [message.id]);
                    messageElement.dataset.isRead = 'true';
                    console.log('Marking message as read:', message.id);
                }
            }, 1500);
            
            playNotificationSound('message');
        }
        
        scrollToBottom();
    });
    
    // Message status updates
    socket.on('message-status-update', (data) => {
        updateMessageStatus(data.messageId, data.status);
    });
    
    socket.on('messages-read-update', (messageIds) => {
        console.log('Received read update for messages:', messageIds);
        messageIds.forEach(id => {
            updateMessageStatus(id, 'read');
            
            // Start countdown for "after read + time" messages
            const messageElement = document.querySelector(`[data-message-id="${id}"]`);
            if (messageElement) {
                const timerElement = messageElement.querySelector('.disappearing-timer');
                if (timerElement && timerElement.textContent.includes('After read +')) {
                    // Extract the time from the timer text
                    const timeMatch = timerElement.textContent.match(/After read \+ (\d+)s/);
                    if (timeMatch) {
                        const timeAfterRead = parseInt(timeMatch[1]);
                        console.log(`Starting countdown for message ${id}: ${timeAfterRead}s`);
                        
                        // Start countdown
                        let remainingTime = timeAfterRead;
                        timerElement.textContent = `👁️ ${remainingTime}s left`;
                        
                        const countdown = setInterval(() => {
                            remainingTime--;
                            if (remainingTime <= 0) {
                                clearInterval(countdown);
                                timerElement.textContent = '👁️ 0s';
                            } else {
                                timerElement.textContent = `👁️ ${remainingTime}s left`;
                            }
                        }, 1000);
                    }
                }
            }
            
            console.log('Updated message status to read:', id);
        });
    });
    
    // Typing indicators
    socket.on('user-typing', (username) => {
        showTypingIndicator(username);
    });
    
    socket.on('user-stop-typing', () => {
        hideTypingIndicator();
    });
    
    // Message editing and deletion
    socket.on('message-edited', (data) => {
        updateEditedMessage(data.messageId, data.newText, data.editedAt);
    });
    
    socket.on('message-deleted', (messageId) => {
        markMessageAsDeleted(messageId);
    });
    
    // Handle disappeared messages (completely remove)
    socket.on('message-disappeared', (messageId) => {
        removeMessageCompletely(messageId);
    });
    
    // Chat cleared
    socket.on('chat-cleared', () => {
        clearAllMessages();
    });
    
    // User list updates
    socket.on('user-list-update', (users) => {
        updateOnlineStatus(users);
    });
    
    // Profile picture updates
    socket.on('profile-picture-update', (data) => {
        console.log('Received profile picture update:', data);
        // Save to localStorage and update display
        localStorage.setItem(`profilePicture_${data.username}`, data.profilePicture);
        updateProfilePicture(data.username, data.profilePicture);
    });

    // Handle force logout
    socket.on('force-logout', (data) => {
        console.log('Force logout received:', data.reason);
        alert(`You have been logged out: ${data.reason}`);
        logout();
    });

    // Handle server errors
    socket.on('error', (data) => {
        console.log('Server error received:', data.message);
        alert(`Error: ${data.message}`);
        logout();
    });

    // Handle disappearing settings synchronization
    socket.on('disappearing-settings-sync', (data) => {
        console.log('Received disappearing settings sync:', data);
        
        // Update local settings
        disappearingMessagesEnabled = data.disappearingEnabled;
        disappearingTime = data.disappearingTime;
        
        // Update localStorage
        localStorage.setItem('disappearingMessages', disappearingMessagesEnabled);
        localStorage.setItem('disappearingTime', disappearingTime);
        
        // Update UI elements
        updateDisappearingToggle();
        updateDisappearingSettingsUI();
        
        // Show notification to user about the change
        const notificationText = `${data.username} ${data.disappearingEnabled ? 'enabled' : 'disabled'} disappearing messages`;
        addSystemMessage(`🔄 ${notificationText}`);
    });

    // Call-related socket events will be set up in initializeCallSystem()
}

// Setup event listeners for UI elements
function setupEventListeners() {
    if (!elements.messageInput) return;
    
    // Message input
    elements.messageInput.addEventListener('input', (e) => {
        handleTyping();
        autoResizeTextarea(e.target);
        handleInputFocus(true);
    });
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    elements.messageInput.addEventListener('focus', () => {
        handleInputFocus(true);
    });
    elements.messageInput.addEventListener('blur', () => {
        // Delay to check if input is empty
        setTimeout(() => {
            if (!elements.messageInput.value.trim()) {
                handleInputFocus(false);
            }
        }, 200);
    });
    
    // Initialize textarea height and collapsed state
    autoResizeTextarea(elements.messageInput);
    handleInputFocus(false);
    
    // Send button
    elements.sendBtn?.addEventListener('click', sendMessage);
    
    // File upload
    elements.attachBtn?.addEventListener('click', () => elements.fileInput?.click());
    elements.photoBtn?.addEventListener('click', () => elements.fileInput?.click());
    elements.fileInput?.addEventListener('change', handleFileUpload);
    
    // Voice recording
    elements.voiceBtn?.addEventListener('click', toggleVoiceRecording);
    
    // Emoji button
    elements.emojiBtn?.addEventListener('click', toggleEmojiPicker);
    
    // Quick logout button
    document.getElementById('logoutQuickBtn')?.addEventListener('click', quickLogout);
    
    // Header actions
    elements.themeToggle?.addEventListener('click', toggleDarkMode);
    elements.disappearingToggle?.addEventListener('click', toggleDisappearingMessages);
    elements.clearChatBtn?.addEventListener('click', () => {
        socket.emit('clear-chat');
    });
    elements.settingsBtn?.addEventListener('click', openSettingsModal);
    
    // Modal event listeners
    setupModalListeners();
    
    // Message context menu (right-click)
    elements.messagesList?.addEventListener('contextmenu', handleMessageContextMenu);
    
    // Initialize emoji picker
    initializeEmojiPicker();
    
    // Initialize call system
    initializeCallSystem();
}

// Setup modal event listeners
function setupModalListeners() {
    // Image modal
    document.getElementById('imageModalClose')?.addEventListener('click', () => closeModal('imageModal'));
    document.getElementById('imageModalBackdrop')?.addEventListener('click', () => closeModal('imageModal'));
    document.getElementById('downloadImageBtn')?.addEventListener('click', downloadImage);
    
    // Settings modal
    document.getElementById('settingsModalClose')?.addEventListener('click', () => closeModal('settingsModal'));
    document.getElementById('settingsModalBackdrop')?.addEventListener('click', () => closeModal('settingsModal'));
    
    // Confirm modal
    document.getElementById('confirmCancel')?.addEventListener('click', () => closeModal('confirmModal'));
    document.getElementById('confirmModalBackdrop')?.addEventListener('click', () => closeModal('confirmModal'));
    
    // Voice modal
    document.getElementById('voiceCancelBtn')?.addEventListener('click', cancelVoiceRecording);
    document.getElementById('voiceStopBtn')?.addEventListener('click', stopVoiceRecording);
    document.getElementById('voiceModalBackdrop')?.addEventListener('click', cancelVoiceRecording);
    
    // Settings form handlers
    setupSettingsHandlers();
}

// Setup settings handlers
function setupSettingsHandlers() {
    // Disappearing messages
    document.querySelectorAll('input[name="disappearTime"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value.startsWith('read_')) {
                // Handle "after read + time" format
                disappearingTime = value;
                disappearingMessagesEnabled = true;
            } else {
                // Handle regular time format
                disappearingTime = parseInt(value);
                disappearingMessagesEnabled = disappearingTime > 0;
            }
            localStorage.setItem('disappearingTime', disappearingTime);
            updateDisappearingToggle();
            
            // Broadcast settings change to all users
            socket.emit('disappearing-settings-update', {
                disappearingEnabled: disappearingMessagesEnabled,
                disappearingTime: disappearingTime
            });
        });
    });
    
    // Background options
    document.querySelectorAll('.bg-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            changeBackground(e.target.dataset.bg);
        });
    });
    
    // Message size options
    document.querySelectorAll('.size-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            changeMessageSize(e.target.dataset.size);
        });
    });
    
    // Sound toggle
    document.getElementById('soundToggle')?.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        localStorage.setItem('soundEnabled', soundEnabled);
    });
    
    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    // Profile picture change
    document.getElementById('changePictureBtn')?.addEventListener('click', () => {
        document.getElementById('profilePictureInput').click();
    });
    
    document.getElementById('profilePictureInput')?.addEventListener('change', handleProfilePictureUpload);
}

// Send text message
function sendMessage() {
    const text = elements.messageInput?.value?.trim();
    if (!text) return;
    
    const messageData = {
        text: formatMessage(text),
        disappearing: disappearingMessagesEnabled,
        disappearTime: disappearingTime,
        replyTo: currentReplyTo ? {
            id: currentReplyTo.id,
            username: currentReplyTo.username,
            content: currentReplyTo.content
        } : null
    };
    
    socket.emit('chat-message', messageData);
    elements.messageInput.value = '';
    autoResizeTextarea(elements.messageInput);
    handleInputFocus(false);
    stopTyping();
    
    // Clear reply interface after sending
    if (currentReplyTo) {
        window.cancelReply();
    }
}

// Auto-resize textarea to fit content (max 3 lines)
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    
    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate the height needed
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
    const minHeight = lineHeight; // 1 line
    const maxHeight = lineHeight * 3; // 3 lines max
    
    let newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    
    // Set the new height
    textarea.style.height = newHeight + 'px';
    
    // Show scrollbar if content exceeds 3 lines
    if (textarea.scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
}

// Handle input focus states for collapsed/expanded behavior
function handleInputFocus(isFocused) {
    const wrapper = elements.messageInput?.parentElement;
    if (!wrapper) return;
    
    if (isFocused || elements.messageInput.value.trim()) {
        wrapper.classList.remove('collapsed');
        wrapper.classList.add('focused');
    } else {
        wrapper.classList.remove('focused');
        wrapper.classList.add('collapsed');
    }
}

// Format message text
function formatMessage(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

// Handle typing indicators
function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing-start');
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 1000);
}

function stopTyping() {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing-stop');
    }
}

function showTypingIndicator(username) {
    if (elements.typingIndicator) {
        elements.typingIndicator.querySelector('.typing-text').textContent = `${username} is typing`;
        elements.typingIndicator.style.display = 'block';
    }
}

function hideTypingIndicator() {
    if (elements.typingIndicator) {
        elements.typingIndicator.style.display = 'none';
    }
}

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('Only image files are supported');
        return;
    }
    
    try {
        const base64 = await fileToBase64(file);
        
        const messageData = {
            imageData: base64,
            imageName: file.name,
            disappearing: disappearingMessagesEnabled,
            disappearTime: disappearingTime
        };
        
        socket.emit('image-message', messageData);
        
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Error uploading file');
    }
    
    event.target.value = '';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Voice recording functionality
async function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecording = true;
        recordingStartTime = Date.now();
        
        elements.voiceBtn?.classList.add('recording');
        openModal('voiceModal');
        
        recordingTimer = setInterval(updateRecordingTimer, 100);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const base64 = await blobToBase64(audioBlob);
            const duration = Math.round((Date.now() - recordingStartTime) / 1000);
            
            const messageData = {
                voiceData: base64,
                duration: duration,
                disappearing: disappearingMessagesEnabled,
                disappearTime: disappearingTime
            };
            
            socket.emit('voice-message', messageData);
            
            stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            elements.voiceBtn?.classList.remove('recording');
            closeModal('voiceModal');
            clearInterval(recordingTimer);
        };
        
        mediaRecorder.start();
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone');
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
    }
}

function cancelVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        elements.voiceBtn?.classList.remove('recording');
        closeModal('voiceModal');
        clearInterval(recordingTimer);
    }
}

function updateRecordingTimer() {
    const elapsed = Date.now() - recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    const timerElement = document.getElementById('voiceTimer');
    if (timerElement) {
        timerElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Display message in chat
function displayMessage(message) {
    const messageElement = createMessageElement(message);
    elements.messagesList?.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.style.animationPlayState = 'running';
    }, 10);
}

// Create message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    // Check if message is from current user based on username, not socket ID
    const isOwnMessage = message.username === currentUser;
    messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;
    
    // Add profile indicator
    const profileIndicator = document.createElement('div');
    profileIndicator.className = 'profile-indicator';
    
    // Get first letter of username and assign color
    const firstLetter = message.username ? message.username.charAt(0).toUpperCase() : 'U';
    profileIndicator.textContent = firstLetter;
    
    // Assign colors based on username
    const userColors = {
        'P': '#4CAF50', // Green for Pavi
        'M': '#2196F3', // Blue for Manu
        'U': '#9E9E9E'  // Gray for unknown
    };
    
    profileIndicator.style.backgroundColor = userColors[firstLetter] || '#9E9E9E';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    let content = '';
    
    if (message.deleted) {
        content = '<div class="message-deleted">This message was deleted</div>';
    } else {
        // Add reply block if this message is a reply
        let replyBlock = '';
        if (message.replyTo) {
            replyBlock = `
                <div class="reply-block" style="
                    background: rgba(0, 0, 0, 0.05);
                    border-left: 3px solid #25d366;
                    margin-bottom: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                ">
                    <div class="reply-username" style="
                        color: #25d366;
                        font-weight: 600;
                        margin-bottom: 2px;
                    ">${message.replyTo.username}</div>
                    <div class="reply-content" style="
                        color: #666;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">${message.replyTo.content}</div>
                </div>
            `;
        }
        
        switch (message.type) {
            case 'text':
                content = `${replyBlock}<div class="message-content">${message.text}</div>`;
                break;
            case 'image':
                content = `
                    ${replyBlock}
                    <div class="message-content">
                        <img src="${message.imageData}" 
                             alt="${message.imageName}" 
                             class="message-image"
                             onclick="openImageModal('${message.imageData}', '${message.imageName}')">
                    </div>
                `;
                break;
            case 'voice':
                content = `
                    ${replyBlock}
                    <div class="message-content">
                        <div class="voice-message">
                            <button class="voice-play-btn" onclick="playVoiceMessage('${message.voiceData}')">
                                ▶️
                            </button>
                            <div class="voice-waveform">
                                <div class="voice-progress"></div>
                            </div>
                            <span class="voice-duration">${formatDuration(message.duration)}</span>
                        </div>
                    </div>
                `;
                break;
        }
    }
    
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    let statusIcon = '';
    if (isOwnMessage && !message.deleted) {
        if (message.read) {
            statusIcon = '<span class="message-status read"><span style="color: #53bdeb;">✓✓</span></span>';
        } else if (message.delivered) {
            statusIcon = '<span class="message-status delivered">✓✓</span>';
        } else {
            statusIcon = '<span class="message-status">✓</span>';
        }
    }
    
    const editedLabel = message.edited ? '<span class="message-edited">(edited)</span>' : '';
    
    meta.innerHTML = `
        <span class="message-time">${time}</span>
        ${editedLabel}
        ${statusIcon}
    `;
    
    bubble.innerHTML = content;
    bubble.appendChild(meta);
    
    // Add profile indicator and bubble to message div
    messageDiv.appendChild(profileIndicator);
    messageDiv.appendChild(bubble);
    
    return messageDiv;
}

// Modal and utility functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal?.classList.add('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal?.classList.remove('show');
}

function updateUserStatus(status, text) {
    const indicator = elements.userStatus?.querySelector('.status-indicator');
    const statusText = elements.userStatus?.querySelector('.status-text');
    
    if (indicator) indicator.className = `status-indicator ${status}`;
    if (statusText) statusText.textContent = text;
}

function updateOnlineStatus(users) {
    const onlineCount = users.filter(user => user.online).length;
    if (onlineCount > 1) {
        updateUserStatus('online', `${onlineCount} users online`);
    } else {
        updateUserStatus('online', 'Online');
    }
}

function scrollToBottom() {
    setTimeout(() => {
        // Try multiple elements to ensure scroll works
        const messagesList = document.getElementById('messagesList');
        const messagesContainer = elements.messagesContainer;
        
        if (messagesList) {
            messagesList.scrollTop = messagesList.scrollHeight + 500;
        }
        
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight + 500;
        }
        
        // Also try scrolling the last message into view
        const lastMessage = document.querySelector('.message:last-child');
        if (lastMessage) {
            lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        
        // Mark all visible messages as read
        markVisibleMessagesAsRead();
    }, 150);
}

// Mark visible messages as read
function markVisibleMessagesAsRead() {
    if (!socket || !socket.connected) return;
    
    const messageElements = document.querySelectorAll('.message.received[data-message-id]');
    const messagesToMarkRead = [];
    
    messageElements.forEach(messageElement => {
        const messageId = messageElement.dataset.messageId;
        
        // Check if message is not already marked as read using data attribute
        if (!messageElement.dataset.isRead) {
            messagesToMarkRead.push(messageId);
            messageElement.dataset.isRead = 'true';
        }
    });
    
    if (messagesToMarkRead.length > 0) {
        console.log('Marking visible messages as read:', messagesToMarkRead);
        socket.emit('messages-read', messagesToMarkRead);
    }
}

function addSystemMessage(text) {
    const systemMsg = document.createElement('div');
    systemMsg.className = 'system-message';
    systemMsg.innerHTML = `<span>${text}</span>`;
    elements.messagesList?.appendChild(systemMsg);
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function playNotificationSound(type) {
    if (!soundEnabled) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const frequencies = {
            message: [800, 600],
            connect: [400, 600, 800]
        };
        
        const freq = frequencies[type] || [400];
        
        freq.forEach((f, i) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(f, audioContext.currentTime);
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            }, i * 100);
        });
    } catch (error) {
        console.log('Audio context not supported');
    }
}

function loadSettings() {
    isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark');
        const themeIcon = elements.themeToggle?.querySelector('.theme-icon');
        if (themeIcon) themeIcon.textContent = '☀️';
    }
    
    soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.checked = soundEnabled;
    
    disappearingMessagesEnabled = localStorage.getItem('disappearingMessages') === 'true';
    const savedTime = localStorage.getItem('disappearingTime');
    if (savedTime && savedTime.startsWith('read_')) {
        disappearingTime = savedTime;
        disappearingMessagesEnabled = true;
    } else {
        disappearingTime = parseInt(savedTime) || 0;
        disappearingMessagesEnabled = disappearingTime > 0;
    }
    updateDisappearingToggle();
    
    // Set the correct radio button
    const radioButton = document.querySelector(`input[name="disappearTime"][value="${disappearingTime}"]`);
    if (radioButton) {
        radioButton.checked = true;
    }
    
    currentBackground = localStorage.getItem('chatBackground') || 'default';
    changeBackground(currentBackground);
    
    currentMessageSize = localStorage.getItem('messageSize') || 'medium';
    changeMessageSize(currentMessageSize);
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark', isDarkMode);
    
    const themeIcon = elements.themeToggle?.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = isDarkMode ? '☀️' : '🌙';
    }
    
    localStorage.setItem('darkMode', isDarkMode);
}

function updateDisappearingToggle() {
    if (elements.disappearingToggle) {
        elements.disappearingToggle.style.opacity = disappearingMessagesEnabled ? '1' : '0.5';
    }
}

function updateDisappearingSettingsUI() {
    // Update radio buttons in settings modal
    const radioButtons = document.querySelectorAll('input[name="disappearTime"]');
    radioButtons.forEach(radio => {
        if (radio.value == disappearingTime) {
            radio.checked = true;
        }
    });
}

function toggleDisappearingMessages() {
    disappearingMessagesEnabled = !disappearingMessagesEnabled;
    updateDisappearingToggle();
    
    if (disappearingMessagesEnabled && disappearingTime === 0) {
        disappearingTime = 30;
    }
    
    localStorage.setItem('disappearingMessages', disappearingMessagesEnabled);
    localStorage.setItem('disappearingTime', disappearingTime);
    
    // Broadcast settings change to all users
    socket.emit('disappearing-settings-update', {
        disappearingEnabled: disappearingMessagesEnabled,
        disappearingTime: disappearingTime
    });
}

function changeBackground(background) {
    currentBackground = background;
    
    document.querySelectorAll('.bg-option').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedBtn = document.querySelector(`[data-bg="${background}"]`);
    if (selectedBtn) selectedBtn.classList.add('active');
    
    if (elements.messagesContainer) {
        elements.messagesContainer.className = `messages-container bg-${background}`;
    }
    
    localStorage.setItem('chatBackground', background);
}

function changeMessageSize(size) {
    currentMessageSize = size;
    
    // Remove active class from all size options
    document.querySelectorAll('.size-option').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to selected option
    const selectedBtn = document.querySelector(`[data-size="${size}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    // Apply size class to chat container
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        // Remove existing size classes
        chatContainer.className = chatContainer.className.replace(/\bmessage-size-\w+/g, '');
        // Add new size class
        chatContainer.classList.add(`message-size-${size}`);
    }
    
    // Save preference
    localStorage.setItem('messageSize', size);
}

// Emoji data organized by categories
const emojiData = {
    smileys: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
        '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
        '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
        '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'
    ],
    people: [
        '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
        '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
        '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀',
        '👁️', '👅', '👄', '💋', '🩸', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵'
    ],
    animals: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵',
        '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
        '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖',
        '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆'
    ],
    food: [
        '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
        '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐',
        '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭',
        '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲'
    ],
    travel: [
        '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵',
        '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛰️', '🚢', '⛵',
        '🚤', '🛥️', '🛳️', '⛴️', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✊', '🚍',
        '🚘', '🚖', '🚡', '🚠', '🚟', '🎠', '🎡', '🎢', '💈', '🎪', '🚩', '🎌', '🏴', '🏳️', '🏁', '🚁'
    ],
    objects: [
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
        '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿',
        '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣',
        '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭'
    ],
    symbols: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
        '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
        '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
        '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️'
    ],
    flags: [
        '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲',
        '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭',
        '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨',
        '🇨🇩', '🇨🇫', '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷', '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽'
    ]
};

let currentEmojiCategory = 'smileys';

function initializeEmojiPicker() {
    populateEmojiGrid(currentEmojiCategory);
    setupEmojiTabListeners();
    setupEmojiClickListeners();
}

function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiPicker.classList.contains('show')) {
        hideEmojiPicker();
    } else {
        showEmojiPicker();
    }
}

function showEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.classList.add('show');
    
    // Close picker when clicking outside
    setTimeout(() => {
        document.addEventListener('click', handleEmojiPickerOutsideClick);
    }, 100);
}

function hideEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.classList.remove('show');
    document.removeEventListener('click', handleEmojiPickerOutsideClick);
}

function handleEmojiPickerOutsideClick(event) {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtn = elements.emojiBtn;
    
    if (!emojiPicker.contains(event.target) && !emojiBtn.contains(event.target)) {
        hideEmojiPicker();
    }
}

function populateEmojiGrid(category) {
    const emojiGrid = document.getElementById('emojiGrid');
    const emojis = emojiData[category] || emojiData.smileys;
    
    emojiGrid.innerHTML = '';
    
    emojis.forEach(emoji => {
        const button = document.createElement('button');
        button.className = 'emoji-item';
        button.textContent = emoji;
        button.onclick = () => insertEmojiToInput(emoji);
        emojiGrid.appendChild(button);
    });
}

function setupEmojiTabListeners() {
    document.querySelectorAll('.emoji-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Remove active class from all tabs
            document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            e.target.classList.add('active');
            
            // Update current category and populate grid
            currentEmojiCategory = e.target.dataset.category;
            populateEmojiGrid(currentEmojiCategory);
        });
    });
}

function setupEmojiClickListeners() {
    // This is handled by the onclick in populateEmojiGrid
}

function insertEmojiToInput(emoji) {
    if (elements.messageInput) {
        const input = elements.messageInput;
        const cursorPos = input.selectionStart;
        const textBefore = input.value.substring(0, cursorPos);
        const textAfter = input.value.substring(cursorPos);
        
        input.value = textBefore + emoji + textAfter;
        input.focus();
        input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        
        // Auto-resize textarea and handle focus
        autoResizeTextarea(input);
        handleInputFocus(true);
        
        // Hide emoji picker after selection
        hideEmojiPicker();
    }
}

function clearAllMessages() {
    if (elements.messagesList) {
        elements.messagesList.innerHTML = '';
    }
}

function openSettingsModal() {
    const currentSetting = document.querySelector(`input[name="disappearTime"][value="${disappearingTime}"]`);
    if (currentSetting) currentSetting.checked = true;
    
    const currentBg = document.querySelector(`[data-bg="${currentBackground}"]`);
    if (currentBg) currentBg.classList.add('active');
    
    const currentSize = document.querySelector(`[data-size="${currentMessageSize}"]`);
    if (currentSize) currentSize.classList.add('active');
    
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.checked = soundEnabled;
    
    // Update user info display
    const currentUserName = document.getElementById('currentUserName');
    const chatPartnerName = document.getElementById('chatPartnerName');
    
    if (currentUserName && currentUser) {
        currentUserName.textContent = currentUser;
    }
    
    if (chatPartnerName && chatPartner) {
        chatPartnerName.textContent = chatPartner;
    }
    
    // Load current user's profile picture in settings
    const savedUserImage = localStorage.getItem(`profilePicture_${currentUser}`);
    if (savedUserImage && currentUserPicture) {
        currentUserPicture.src = savedUserImage;
    }
    
    openModal('settingsModal');
}

function handleMessageContextMenu(event) {
    event.preventDefault();
    
    const messageElement = event.target.closest('.message');
    if (!messageElement) return;
    
    const messageId = messageElement.dataset.messageId;
    const isOwnMessage = messageElement.classList.contains('sent');
    showMessageContextMenu(event.clientX, event.clientY, messageId, isOwnMessage);
}

function showMessageContextMenu(x, y, messageId, isOwnMessage = false) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        z-index: 1001;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 0.5rem 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    let menuItems = `
        <div class="context-menu-item" onclick="replyToMessage('${messageId}')" style="padding: 0.7rem 1rem; cursor: pointer;">
            <span>↩️ Reply</span>
        </div>
    `;
    
    if (isOwnMessage) {
        menuItems += `
            <div class="context-menu-item" onclick="editMessage('${messageId}')" style="padding: 0.7rem 1rem; cursor: pointer;">
                <span>✏️ Edit</span>
            </div>
            <div class="context-menu-item" onclick="deleteMessage('${messageId}')" style="padding: 0.7rem 1rem; cursor: pointer;">
                <span>🗑️ Delete</span>
            </div>
        `;
    }
    
    menu.innerHTML = menuItems;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 10);
}

function updateMessageStatus(messageId, status) {
    console.log(`Updating message ${messageId} status to: ${status}`);
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const statusElement = messageElement.querySelector('.message-status');
        if (statusElement) {
            statusElement.className = `message-status ${status}`;
            if (status === 'read') {
                statusElement.innerHTML = '<span style="color: #53bdeb;">✓✓</span>';
                messageElement.dataset.isRead = 'true';
                console.log('Set blue ticks for message:', messageId);
            } else if (status === 'delivered') {
                statusElement.textContent = '✓✓';
                console.log('Set delivered ticks for message:', messageId);
            } else {
                statusElement.textContent = '✓';
                console.log('Set sent tick for message:', messageId);
            }
        } else {
            console.log('Status element not found for message:', messageId);
        }
    } else {
        console.log('Message element not found:', messageId);
    }
}

function updateEditedMessage(messageId, newText, editedAt) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const contentElement = messageElement.querySelector('.message-content');
        if (contentElement) {
            contentElement.innerHTML = newText;
        }
        
        const metaElement = messageElement.querySelector('.message-meta');
        if (metaElement && !metaElement.querySelector('.message-edited')) {
            const editedSpan = document.createElement('span');
            editedSpan.className = 'message-edited';
            editedSpan.textContent = '(edited)';
            metaElement.insertBefore(editedSpan, metaElement.querySelector('.message-time'));
        }
    }
}

function markMessageAsDeleted(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const bubble = messageElement.querySelector('.message-bubble');
        bubble.innerHTML = `
            <div class="message-deleted">This message was deleted</div>
            <div class="message-meta">
                <span class="message-time">${new Date().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })}</span>
            </div>
        `;
    }
}

function removeMessageCompletely(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        // Add fade out animation
        messageElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(-20px)';
        
        // Remove the element after animation
        setTimeout(() => {
            messageElement.remove();
        }, 300);
        
        // Remove context menu if exists
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) existingMenu.remove();
        
        console.log('Message completely removed:', messageId);
    }
}

// Global functions for HTML onclick handlers
window.openImageModal = function(imageSrc, imageName) {
    const modalImage = document.getElementById('modalImage');
    const downloadBtn = document.getElementById('downloadImageBtn');
    
    if (modalImage) {
        modalImage.src = imageSrc;
        modalImage.alt = imageName;
    }
    
    if (downloadBtn) {
        downloadBtn.onclick = () => downloadImageFile(imageSrc, imageName);
    }
    
    openModal('imageModal');
};

window.playVoiceMessage = function(voiceData) {
    const audio = new Audio(voiceData);
    audio.play().catch(error => {
        console.error('Error playing voice message:', error);
    });
};

window.editMessage = function(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    const contentElement = messageElement?.querySelector('.message-content');
    const currentText = contentElement?.textContent || '';
    
    const newText = prompt('Edit message:', currentText);
    if (newText && newText !== currentText) {
        socket.emit('edit-message', { messageId, newText });
    }
};

window.deleteMessage = function(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
        socket.emit('delete-message', messageId);
    }
};

window.replyToMessage = function(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    // Find the message data from our messages array or determine username from message type
    const messageContent = messageElement.querySelector('.message-content')?.textContent || '';
    const messageTime = messageElement.querySelector('.message-time')?.textContent || '';
    
    // Determine username based on message alignment
    let messageUser;
    if (messageElement.classList.contains('sent')) {
        messageUser = currentUser; // Current user's message
    } else {
        messageUser = chatPartner; // Partner's message
    }
    
    // Close context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();
    
    // Show reply interface
    showReplyInterface(messageId, messageUser, messageContent, messageTime);
};

function downloadImage() {
    const modalImage = document.getElementById('modalImage');
    if (modalImage) {
        downloadImageFile(modalImage.src, modalImage.alt || 'image.png');
    }
}

function downloadImageFile(imageSrc, imageName) {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = imageName || 'image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Handle profile picture upload
async function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('Profile picture must be smaller than 2MB');
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    try {
        // Convert to base64 and resize
        const resizedImage = await resizeImage(file, 200, 200);
        
        // Update current user's profile picture
        updateProfilePicture(currentUser, resizedImage);
        
        // Save to localStorage
        localStorage.setItem(`profilePicture_${currentUser}`, resizedImage);
        
        // Broadcast update to other users
        if (socket && socket.connected) {
            socket.emit('profile-picture-update', {
                username: currentUser,
                profilePicture: resizedImage
            });
        }
        
        console.log('Profile picture updated for:', currentUser);
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        alert('Error uploading profile picture. Please try again.');
    }
}

// Resize image to specified dimensions
function resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and resize image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64
            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataURL);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Update profile picture display
function updateProfilePicture(username, imageData) {
    if (username === currentUser) {
        // Update current user's picture in settings
        const currentUserPicture = document.getElementById('currentUserPicture');
        if (currentUserPicture) {
            currentUserPicture.src = imageData;
        }
    } else if (username === chatPartner) {
        // Update chat partner's picture in header
        const chatPartnerPicture = document.getElementById('chatPartnerPicture');
        if (chatPartnerPicture) {
            chatPartnerPicture.src = imageData;
        }
    }
}

// Load saved profile pictures
function loadProfilePictures() {
    // Load current user's picture
    const currentUserImage = localStorage.getItem(`profilePicture_${currentUser}`);
    if (currentUserImage) {
        updateProfilePicture(currentUser, currentUserImage);
    }
    
    // Load chat partner's picture
    const partnerImage = localStorage.getItem(`profilePicture_${chatPartner}`);
    if (partnerImage) {
        updateProfilePicture(chatPartner, partnerImage);
    }
}

// Setup inactivity tracking
function setupInactivityTracking() {
    // Activity events to track
    const activityEvents = [
        'mousedown', 'mousemove', 'keypress', 'scroll', 
        'touchstart', 'click', 'keydown', 'keyup'
    ];
    
    // Reset activity timer on any user interaction
    function resetActivityTimer() {
        lastActivityTime = Date.now();
        
        // Clear existing timer
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
        
        // Only set timer if user is logged in
        if (currentUser) {
            inactivityTimer = setTimeout(() => {
                autoLogout();
            }, INACTIVITY_TIMEOUT);
        }
    }
    
    // Add event listeners for activity tracking
    activityEvents.forEach(event => {
        document.addEventListener(event, resetActivityTimer, true);
    });
    
    console.log('Inactivity tracking setup complete - 5 minute timeout');
}

// Start inactivity timer after login
function startInactivityTimer() {
    lastActivityTime = Date.now();
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    inactivityTimer = setTimeout(() => {
        autoLogout();
    }, INACTIVITY_TIMEOUT);
    
    // Update status to show timer is active
    updateSessionStatus();
    
    console.log('Inactivity timer started - will logout after 5 minutes of inactivity');
}

// Update session status display
function updateSessionStatus() {
    const statusText = document.querySelector('.status-text');
    if (statusText && currentUser) {
        statusText.textContent = 'Online';
        statusText.title = 'Currently online';
    }
}

// Stop inactivity timer
function stopInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    console.log('Inactivity timer stopped');
}

// Auto logout due to inactivity (disabled)
function autoLogout() {
    // Auto-logout functionality disabled
    console.log('Auto-logout disabled - users stay logged in');
}

function logout() {
    // Stop inactivity timer
    stopInactivityTimer();
    
    // Disconnect socket
    if (socket && socket.connected) {
        socket.disconnect();
    }
    
    // Clear variables
    currentUser = null;
    chatPartner = null;
    
    // Show loading state briefly
    document.body.style.opacity = '0.7';
    
    // Redirect to landing page (index.html)
    setTimeout(() => {
        window.location.href = '/';
    }, 500);
}

function quickLogout() {
    // Immediate logout without confirmation
    logout();
}

// Reply functionality
let currentReplyTo = null;

function showReplyInterface(messageId, username, content, time) {
    currentReplyTo = {
        id: messageId,
        username: username,
        content: content.substring(0, 100) + (content.length > 100 ? '...' : ''), // Truncate long messages
        time: time
    };
    
    // Create or update reply preview
    let replyPreview = document.getElementById('replyPreview');
    if (!replyPreview) {
        replyPreview = document.createElement('div');
        replyPreview.id = 'replyPreview';
        replyPreview.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(replyPreview);
    }
    
    replyPreview.innerHTML = `
        <div style="flex: 1; padding-right: 12px;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="color: #25d366; font-weight: 600; font-size: 14px;">↩️ Replying to ${username}</span>
            </div>
            <div style="color: #666; font-size: 13px; line-height: 1.3;">${content}</div>
        </div>
        <button onclick="cancelReply()" style="
            background: none; 
            border: none; 
            color: #999; 
            font-size: 18px; 
            cursor: pointer;
            padding: 4px;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        ">×</button>
    `;
    
    // Focus on input
    elements.messageInput?.focus();
}

window.cancelReply = function() {
    currentReplyTo = null;
    const replyPreview = document.getElementById('replyPreview');
    if (replyPreview) {
        replyPreview.remove();
    }
};

// WebRTC Call System
console.log('🤖 Robotic Chat Client loaded!'); 