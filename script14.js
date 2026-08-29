const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/DashboardLayout.tsx';
let content = fs.readFileSync(file, 'utf8');

const elementRegex = /<UpdateManager onUpdateStateChange=\{setHasUpdate\} \/>/;
content = content.replace(elementRegex, "<UpdateManager onUpdateStateChange={setHasUpdate} />\n      <SubscriptionAlarm />");

fs.writeFileSync(file, content, 'utf8');
