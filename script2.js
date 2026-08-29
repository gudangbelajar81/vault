const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldOnChange = `
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
                    }}`;

const newOnChange = `
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
                      } else if (val === 'deepseek') {
                        setAiBaseUrl('https://api.deepseek.com/chat/completions');
                        setAiModel('deepseek-chat');
                      } else if (val === 'openrouter') {
                        setAiBaseUrl('https://openrouter.ai/api/v1/chat/completions');
                        setAiModel('meta-llama/llama-3.1-8b-instruct:free');
                      } else if (val === 'youtube') {
                        setAiBaseUrl('https://youtube.com/api/v1/chat/completions');
                        setAiModel('youtube-model');
                      } else if (val === 'custom') {
                        setAiBaseUrl('');
                        setAiModel('');
                      }
                    }}`;

const oldOptions = `
                  <option value="groq">Groq (Fastest)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="custom">Custom API</option>
                </select>`;

const newOptions = `
                  <option value="groq">Groq (Fastest)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="youtube">YouTube</option>
                  <option value="custom">Custom API</option>
                </select>`;

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

content = replaceFlexible(content, oldOnChange, newOnChange);
content = replaceFlexible(content, oldOptions, newOptions);

fs.writeFileSync(file, content, 'utf8');
