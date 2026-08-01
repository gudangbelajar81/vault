const fs = require('fs');

const files = [
    'ApiKeys.tsx',
    'Auth.tsx',
    'Courses.tsx',
    'IdentityMap.tsx',
    'Settings.tsx',
    'Shortcuts.tsx',
    'Subscriptions.tsx',
    'Vault.tsx'
];

files.forEach(f => {
    let p = 'D:/PROJEK/saas/vaultpro/frontend/src/pages/' + f;
    let content = fs.readFileSync(p, 'utf8');
    
    // Convert /api/... back to ${API_URL}/api/...
    // Match exactly /api/vault or other endpoints, but only if they are not already wrapped in backticks
    content = content.replace(/(?<!)\$\{API_URL\}\/api\/[a-zA-Z0-9\/]+/g, (match) => {
        return '' + match + '';
    });
    
    fs.writeFileSync(p, content, 'utf8');
});
