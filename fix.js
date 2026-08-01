const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Replace broken import.meta stuff
    content = content.replace(/\$\{import\.meta\.env\.VITE_API_URL \|\| 'http:\/\/localhost:5001'\}/g, '${API_URL}/api/vault');
    
    // Now we need to manually fix Auth and Subscriptions
    if (filePath.includes('Auth.tsx')) {
        content = content.replace(/\$\{API_URL\}\/api\/vault/g, '/api/auth/login');
    }
    
    if (filePath.includes('Subscriptions.tsx')) {
        content = content.replace(/\$\{API_URL\}\/api\/vault/g, '/api/subscriptions');
    }
    
    if (filePath.includes('Settings.tsx')) {
        // Settings uses multiple
        // Wait, Settings has GET /api/vault and POST /api/vault/bulk
        // Let's just fix Settings manually
    }
    
    // Replace the remaining template literals http://localhost:5001...
    content = content.replace(/http:\/\/localhost:5001([^]*)/g, '${API_URL}');
    
    // Add import { API_URL } if not exists
    if (content !== original && !content.includes("import { API_URL }")) {
        content = content.replace(/import axios from 'axios';/, "import axios from 'axios';\nimport { API_URL } from '../config';");
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
}

['Auth.tsx', 'Courses.tsx', 'IdentityMap.tsx', 'Settings.tsx', 'Shortcuts.tsx', 'Subscriptions.tsx', 'Vault.tsx'].forEach(f => {
    replaceInFile('D:/PROJEK/saas/vaultpro/frontend/src/pages/' + f);
});

