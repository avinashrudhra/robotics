# 🤖 Robotic Electronics Training Institute (RETI)

A professional robotic training institute website with secure real-time chat functionality, featuring modern UI, comprehensive course information, and advanced security measures.

## 🌟 Features

### 🎓 Institute Website
- **Professional Landing Page**: Complete institute information with programs, faculty, facilities
- **Responsive Design**: Mobile-friendly interface with robotic theme
- **Interactive Elements**: Animated cards, particle effects, smooth scrolling
- **Multiple Sections**: Programs, Faculty, Facilities, Research, Contact information

### 💬 Secure Chat System
- **Real-time Messaging**: Instant text and image communication
- **Voice Messages**: Record and send voice notes
- **Disappearing Messages**: Self-destructing messages (5s, 30s, 1min)
- **Message Features**: Edit, delete, read receipts, typing indicators
- **Profile Pictures**: Upload and sync profile photos
- **Dark Mode**: Toggle between light and dark themes

### 🔐 Security Features
- **Password Hashing**: Bcrypt with configurable salt rounds
- **Rate Limiting**: Protection against brute force attacks
- **Environment Variables**: Sensitive data stored securely
- **Input Validation**: Comprehensive data validation
- **Session Management**: Secure user session handling

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd robotic-institute-chat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up secure environment**
   ```bash
   node setup-env.js
   ```
   This will create a `.env` file with secure hashed passwords.

4. **Start the server**
   ```bash
   npm start
   # or
   node server.js
   ```

5. **Access the application**
   - Institute Website: `http://localhost:3000`
   - Chat Portal: `http://localhost:3000/chat`

## 🔑 Default Credentials

After running `setup-env.js`, use these credentials for testing:

- **Username**: `Pavi` | **Password**: `SecurePass123!`
- **Username**: `Manu` | **Password**: `SecurePass123!`

⚠️ **Important**: Change these credentials in production!

## ⚙️ Configuration

### Environment Variables

The application uses the following environment variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Security Configuration
JWT_SECRET=your_secure_jwt_secret

# User Credentials (Hashed)
USER_PAVI_PASSWORD_HASH=bcrypt_hash_here
USER_MANU_PASSWORD_HASH=bcrypt_hash_here

# Chat Configuration
SESSION_TIMEOUT=300000
MAX_FILE_SIZE=2097152

# Security Settings
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOGIN_COOLDOWN=900000
```

### Customizing Users

To add or modify users:

1. **Using the setup script** (Recommended):
   ```bash
   node setup-env.js
   ```

2. **Manual setup**:
   ```javascript
   const bcrypt = require('bcrypt');
   const hashedPassword = await bcrypt.hash('your_password', 12);
   console.log(hashedPassword);
   ```
   Add the hash to your `.env` file.

## 📁 Project Structure

```
robotic-institute-chat/
├── public/
│   ├── index.html          # Institute landing page
│   ├── about.html          # About us page
│   ├── chat.html           # Chat interface
│   ├── style.css           # Comprehensive styling
│   └── script.js           # Client-side chat logic
├── server.js               # Main server application
├── setup-env.js            # Environment setup script
├── package.json            # Dependencies and scripts
├── .env                    # Environment variables (not in repo)
├── .env.example            # Environment template
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## 🛡️ Security Features

### Password Security
- **Bcrypt Hashing**: Industry-standard password hashing
- **Configurable Salt Rounds**: Adjustable security level
- **No Plain Text Storage**: Passwords never stored in plain text

### Rate Limiting
- **Login Attempts**: Maximum 5 attempts per IP
- **Cooldown Period**: 15-minute lockout after limit reached
- **Automatic Reset**: Counter resets after successful login

### Data Validation
- **Input Sanitization**: All user inputs validated
- **File Type Restrictions**: Only images and audio files allowed
- **Size Limits**: Configurable file size restrictions

### Environment Security
- **Sensitive Data Protection**: All secrets in environment variables
- **Git Ignore**: Automatic exclusion of sensitive files
- **Example Templates**: Safe templates for deployment

## 🔧 Development

### Running in Development
```bash
npm run dev
# or
NODE_ENV=development node server.js
```

### Building for Production
1. Set environment variables for production
2. Update passwords and JWT secret
3. Configure appropriate file size limits
4. Deploy with process manager (PM2, forever, etc.)

## 🚀 Deployment

### Environment Setup for Production
1. Copy `.env.example` to `.env`
2. Run `node setup-env.js` to generate secure credentials
3. Update environment variables for production settings
4. Ensure `.env` is not committed to version control

### Recommended Production Settings
```env
NODE_ENV=production
PORT=3000
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=3
LOGIN_COOLDOWN=1800000  # 30 minutes
```

## 📋 Features Overview

### Institute Website
- ✅ Professional landing page with institute information
- ✅ Comprehensive program listings with details
- ✅ Faculty profiles with expertise areas
- ✅ State-of-the-art facility descriptions
- ✅ Research areas and achievements
- ✅ Contact information and statistics
- ✅ Responsive design for all devices
- ✅ Animated elements and particle effects

### Chat Application
- ✅ Real-time messaging with Socket.io
- ✅ Image and voice message support
- ✅ Disappearing messages functionality
- ✅ Message editing and deletion
- ✅ Read receipts and delivery status
- ✅ Typing indicators
- ✅ Profile picture management
- ✅ Dark/light mode toggle
- ✅ Custom chat backgrounds

### Security Implementation
- ✅ Bcrypt password hashing
- ✅ Rate limiting protection
- ✅ Environment variable configuration
- ✅ Input validation and sanitization
- ✅ Secure file upload handling
- ✅ Session management
- ✅ Git security best practices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the issues section
- Create a new issue with detailed description
- Include system information and error logs

## 🔄 Updates

### v3.0.1 (Current)
- ✅ Added comprehensive security measures
- ✅ Implemented bcrypt password hashing
- ✅ Added rate limiting for login attempts
- ✅ Environment variable configuration
- ✅ Professional institute website design
- ✅ Enhanced chat features and UI
- ✅ Mobile-responsive design
- ✅ Complete documentation

---

**⚠️ Security Note**: Always change default credentials before deploying to production. Keep your `.env` file secure and never commit it to version control. 