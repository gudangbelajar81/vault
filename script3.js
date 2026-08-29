const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Vault.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldState = `
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
`;
const newState = `
  const { masterPassword } = useVaultStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
`;

const oldInput = `
        {/* Search & Filter bar */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search vault..." 
              className="w-full bg-surface/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>
`;
const newInput = `
        {/* Search & Filter bar */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari password, username, url..." 
              className="w-full bg-surface/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>
`;

const oldList = `
                <tbody className="divide-y divide-border block md:table-row-group">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group flex md:table-row items-center justify-between py-2 px-2 md:py-0 md:px-0 border-b border-border/50 md:border-none">
`;
const newList = `
                <tbody className="divide-y divide-border block md:table-row-group">
                  {items
                    .filter(item => {
                      if (!search) return true;
                      const s = search.toLowerCase();
                      const titleMatch = item.title.toLowerCase().includes(s);
                      const userMatch = item.decrypted?.username?.toLowerCase().includes(s);
                      const urlMatch = item.decrypted?.url?.toLowerCase().includes(s);
                      const descMatch = item.decrypted?.description?.toLowerCase().includes(s);
                      return titleMatch || userMatch || urlMatch || descMatch;
                    })
                    .map((item) => (
                    <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group flex md:table-row items-center justify-between py-2 px-2 md:py-0 md:px-0 border-b border-border/50 md:border-none">
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

content = replaceFlexible(content, oldState, newState);
content = replaceFlexible(content, oldInput, newInput);
content = replaceFlexible(content, oldList, newList);

fs.writeFileSync(file, content, 'utf8');
