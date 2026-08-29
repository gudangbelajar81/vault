const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Subscriptions.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexOpenEdit = /const openEdit = \(sub: Subscription\) => \{[\s\S]*?setIsModalOpen\(true\);\n  \};/;
const newOpenEdit = `const openEdit = (sub: Subscription) => {
    setEditId(sub.id);
    setFormsData([{
      id: sub.id,
      name: sub.name,
      price: sub.price,
      currency: sub.currency,
      billingCycle: sub.billingCycle,
      nextBillingDate: sub.nextBillingDate.split('T')[0],
      status: sub.status,
      accountEmail: sub.accountEmail || '',
      url: sub.decryptedNotes?.url || '',
      password: sub.decryptedNotes?.password || '',
    }]);
    setIsModalOpen(true);
  };`;

content = content.replace(regexOpenEdit, newOpenEdit);

fs.writeFileSync(file, content, 'utf8');
