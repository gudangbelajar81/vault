const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/DashboardLayout.tsx';
let content = fs.readFileSync(file, 'utf8');

const importRegex = /import \{ UpdateManager, performHardRefresh \} from '\.\.\/components\/UpdateManager';/;
content = content.replace(importRegex, "import { UpdateManager, performHardRefresh } from '../components/UpdateManager';\nimport { SubscriptionAlarm } from '../components/SubscriptionAlarm';");

const elementRegex = /<UpdateManager \/>/;
content = content.replace(elementRegex, "<UpdateManager />\n      <SubscriptionAlarm />");

fs.writeFileSync(file, content, 'utf8');
