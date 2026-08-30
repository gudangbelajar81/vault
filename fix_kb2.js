const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/KnowledgeBase.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("item.decrypted.title.toLowerCase().includes(search.toLowerCase()) || ", "(item.decrypted.title || '').toLowerCase().includes(search.toLowerCase()) || ");
content = content.replace("item.decrypted.content.toLowerCase().includes(search.toLowerCase());", "(item.decrypted.content || '').toLowerCase().includes(search.toLowerCase());");

fs.writeFileSync(file, content, 'utf8');
