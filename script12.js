const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Subscriptions.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexInt = /interface Subscription \{[\s\S]*?\}/;
const newInt = `interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string;
  status: string;
  accountEmail?: string;
  encryptedNotes?: string;
  decryptedNotes?: any;
}`;

content = content.replace(regexInt, newInt);

fs.writeFileSync(file, content, 'utf8');
