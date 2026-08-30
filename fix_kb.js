const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/KnowledgeBase.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexSearch = /const matchesSearch = item\.decrypted\.title\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\) \|\| \n\s*item\.decrypted\.content\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\);/g;

const newSearch = `const matchesSearch = (item.decrypted.title || '').toLowerCase().includes(search.toLowerCase()) || 
                          (item.decrypted.content || '').toLowerCase().includes(search.toLowerCase());`;

content = content.replace(regexSearch, newSearch);

fs.writeFileSync(file, content, 'utf8');
