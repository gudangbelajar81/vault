const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFetch = `
        if (item.type === 'api' && item.title === 'Groq API Key (Omni Router)') {
          setOmniRouterItemId(item.id);
          const dataStr = await decryptData(item.encryptedData, masterPassword);
          const parsed = JSON.parse(dataStr);
          setGroqApiKey(parsed.key || '');
          break;
        }`;

const newFetch = `
        if (item.type === 'api' && item.title === 'Groq API Key (Omni Router)') {
          setOmniRouterItemId(item.id);
          const dataStr = await decryptData(item.encryptedData, masterPassword);
          const parsed = JSON.parse(dataStr);
          setGroqApiKey(parsed.key || parsed.keys || '');
          if (parsed.provider) setAiProvider(parsed.provider);
          if (parsed.baseUrl) setAiBaseUrl(parsed.baseUrl);
          if (parsed.model) setAiModel(parsed.model);
          break;
        }`;

const oldSave = `
    try {
      const dataToEncrypt = JSON.stringify({
        key: groqApiKey,
        notes: 'Konfigurasi otomatis untuk AI Omni Router Gateway.'
      });`;

const newSave = `
    try {
      const dataToEncrypt = JSON.stringify({
        keys: groqApiKey,
        provider: aiProvider,
        baseUrl: aiBaseUrl,
        model: aiModel,
        notes: 'Konfigurasi lengkap Omni Router Gateway.'
      });`;

const oldUI = `
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Groq API Keys (Sistem Rotasi Cerdas)</label>
                <textarea 
                  value={groqApiKey}
                  onChange={e => setGroqApiKey(e.target.value)}
                  placeholder="gsk_xxxxx1...&#10;gsk_xxxxx2...&#10;(Pisahkan tiap kunci dengan baris baru untuk fitur Auto-Failover)"
                  rows={4}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-y"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  *Masukkan beberapa kunci sekaligus. Jika kunci pertama limit/habis, sistem akan otomatis merotasi ke kunci berikutnya.
                </p>
              </div>`;

const newUI = `
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-muted mb-1 block">AI Provider</label>
                  <select 
                    value={aiProvider}
                    onChange={e => {
                      const val = e.target.value;
                      setAiProvider(val);
                      if (val === 'groq') {
                        setAiBaseUrl('https://api.groq.com/openai/v1/chat/completions');
                        setAiModel('llama-3.3-70b-versatile');
                      } else if (val === 'openai') {
                        setAiBaseUrl('https://api.openai.com/v1/chat/completions');
                        setAiModel('gpt-4o-mini');
                      } else if (val === 'gemini') {
                        setAiBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
                        setAiModel('gemini-2.5-flash');
                      } else if (val === 'custom') {
                        setAiBaseUrl('');
                        setAiModel('');
                      }
                    }}
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                  >
                    <option value="groq">Groq (Fastest)</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="custom">Custom API</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-muted mb-1 block">Model Name</label>
                  <input 
                    type="text" 
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    placeholder="llama-3.3-70b..."
                    className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Base Endpoint URL</label>
                <input 
                  type="text" 
                  value={aiBaseUrl}
                  onChange={e => setAiBaseUrl(e.target.value)}
                  placeholder="https://api.groq.com/..."
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1 flex items-center justify-between">
                  <span>API Keys (Rotator Pool)</span>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Auto-Failover ON</span>
                </label>
                <textarea 
                  value={groqApiKey}
                  onChange={e => setGroqApiKey(e.target.value)}
                  placeholder="sk-xxxxx1...&#10;sk-xxxxx2...&#10;(Pisahkan dengan Enter)"
                  rows={4}
                  className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-y font-mono text-xs"
                />
              </div>

              {/* Status Visualizer */}
              {groqApiKey && (
                <div className="bg-black/10 dark:bg-white/5 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-text-muted">Status Kunci (Live)</span>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {groqApiKey.split(/[\n,]+/).map(k => k.trim()).filter(Boolean).map((key, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-surface p-1.5 rounded border border-border">
                        <span className="font-mono text-text-muted truncate w-3/4">
                          {key.substring(0, 8)}...{key.substring(key.length - 4)}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-green-500">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          Alive
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}`;

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

content = replaceFlexible(content, oldFetch, newFetch);
content = replaceFlexible(content, oldSave, newSave);
content = replaceFlexible(content, oldUI, newUI);

fs.writeFileSync(file, content, 'utf8');
