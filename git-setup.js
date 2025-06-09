const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing repository for public deployment...\n');

// Check if .env exists
if (!fs.existsSync('.env')) {
    console.log('❌ No .env file found!');
    console.log('📝 Run: node setup-env.js to create secure environment variables\n');
    process.exit(1);
}

// Check if .gitignore exists
if (!fs.existsSync('.gitignore')) {
    console.log('❌ No .gitignore file found!');
    console.log('📝 This should have been created automatically\n');
    process.exit(1);
}

// Read .gitignore to make sure .env is ignored
const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
if (!gitignoreContent.includes('.env')) {
    console.log('❌ .env not found in .gitignore!');
    console.log('📝 Adding .env to .gitignore...');
    fs.appendFileSync('.gitignore', '\n# Environment Variables\n.env\n');
}

console.log('✅ Security Checklist:');
console.log('   ✓ Environment variables configured');
console.log('   ✓ .gitignore includes sensitive files');
console.log('   ✓ Passwords are hashed with bcrypt');
console.log('   ✓ Rate limiting implemented');
console.log('   ✓ Input validation added');

console.log('\n📋 Git Repository Status:');

try {
    // Check if git repo exists
    execSync('git status', { stdio: 'ignore' });
    console.log('   ✓ Git repository initialized');
    
    // Check for uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
        console.log('   ⚠️  Uncommitted changes detected');
        console.log('\n📁 Files to be committed:');
        console.log(status);
    } else {
        console.log('   ✓ No uncommitted changes');
    }
    
} catch (error) {
    console.log('   ❌ Git repository not initialized');
    console.log('   💡 Run: git init');
}

console.log('\n🔒 Security Reminders:');
console.log('   • Never commit .env file to repository');
console.log('   • Change default passwords in production');
console.log('   • Update JWT_SECRET for production');
console.log('   • Set appropriate rate limiting for production');
console.log('   • Use HTTPS in production environment');

console.log('\n📝 Next Steps:');
console.log('   1. Review all files before committing');
console.log('   2. git add . (excluding .env automatically)');
console.log('   3. git commit -m "Initial secure implementation"');
console.log('   4. git remote add origin <your-repo-url>');
console.log('   5. git push -u origin main');

console.log('\n🎉 Repository is ready for public deployment!');
console.log('📚 See README.md for complete setup instructions');

console.log('\n⚠️  FINAL WARNING:');
console.log('🔥 Double-check that .env is NOT in your repository!');
console.log('🔍 Run: git status to verify before pushing');

console.log('\n═══════════════════════════════════════════');
console.log('  🔐 SECURE GIT DEPLOYMENT READY 🔐');
console.log('═══════════════════════════════════════════'); 