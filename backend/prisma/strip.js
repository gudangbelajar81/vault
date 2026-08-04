const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Strip all @db.xxx
content = content.replace(/@db\.\w+(\(\d+\))?/g, '');

fs.writeFileSync(schemaPath, content);
console.log('Stripped @db.* annotations');
