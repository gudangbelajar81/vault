const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Subscriptions.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldBlock = `
    const openEdit = (sub: Subscription) => {
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
      }]);
      setIsModalOpen(true);
    };
`;

const newBlock = `
    const openEdit = (sub: Subscription) => {
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
    };
`;

function replaceFlexible(content, oldStr, newStr) {
    const normalize = str => str.replace(/\s+/g, ' ').trim();
    const oldNorm = normalize(oldStr);
    
    let startIdx = 0;
    while(startIdx < content.length) {
        let p = startIdx;
        let q = 0;
        while(p < content.length && q < oldNorm.length) {
            if (/\s/.test(content[p])) { p++; continue; }
            if (/\s/.test(oldNorm[q])) { q++; continue; }
            if (content[p] === oldNorm[q]) { p++; q++; } else { break; }
        }
        if (q >= oldNorm.length) {
            return content.substring(0, startIdx) + '\n' + newStr + '\n' + content.substring(p);
        }
        startIdx++;
    }
    return content;
}

content = replaceFlexible(content, oldBlock, newBlock);

fs.writeFileSync(file, content, 'utf8');
