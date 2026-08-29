const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Subscriptions.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFetch = `
  const fetchItems = async () => {
    try {
      const res = await axios.get(API, { withCredentials: true });
      setItems(res.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
`;
const newFetch = `
  const fetchItems = async () => {
    try {
      const res = await axios.get(API, { withCredentials: true });
      const itemsList = res.data.data || [];
      
      // Decrypt notes if available
      if (masterPassword) {
        for (const item of itemsList) {
          if (item.encryptedNotes) {
            try {
              const decrypted = await decryptData(item.encryptedNotes, masterPassword);
              item.decryptedNotes = JSON.parse(decrypted);
            } catch(e) {}
          }
        }
      }
      setItems(itemsList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
`;

const oldHandleSave = `
    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        if (editId) {
          await axios.put(\`\${API}/\${editId}\`, formsData[0], { withCredentials: true });
        } else {
          await Promise.all(
            formsData.map(data => axios.post(API, data, { withCredentials: true }))
          );
        }
        setIsModalOpen(false);
        fetchItems();
      } catch (error) {
        alert('Gagal menyimpan data');
      } finally {
        setSaving(false);
      }
    };
`;
const newHandleSave = `
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const processedForms = await Promise.all(formsData.map(async (data: any) => {
        let encryptedNotes = '';
        if (data.url || data.password) {
          if (!masterPassword) {
            throw new Error('Master password diperlukan untuk enkripsi');
          }
          const notesObj = { url: data.url, password: data.password };
          encryptedNotes = await encryptData(JSON.stringify(notesObj), masterPassword);
        }
        
        return {
          ...data,
          encryptedNotes: encryptedNotes || undefined
        };
      }));

      if (editId) {
        await axios.put(\`\${API}/\${editId}\`, processedForms[0], { withCredentials: true });
      } else {
        await Promise.all(
          processedForms.map(data => axios.post(API, data, { withCredentials: true }))
        );
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (error: any) {
      alert(error.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
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

content = replaceFlexible(content, oldFetch, newFetch);
content = replaceFlexible(content, oldHandleSave, newHandleSave);

fs.writeFileSync(file, content, 'utf8');
