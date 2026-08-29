const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Subscriptions.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
  "import { Plus, X, CreditCard, Calendar, TrendingUp, AlertCircle, Edit2, Trash2, CheckCircle, PauseCircle } from 'lucide-react';",
  "import { Plus, X, CreditCard, Calendar, TrendingUp, AlertCircle, Edit2, Trash2, CheckCircle, PauseCircle, ExternalLink, Copy, Eye, EyeOff, Lock } from 'lucide-react';\nimport { useVaultStore } from '../store/vaultStore';\nimport { encryptData, decryptData } from '../utils/crypto';\nimport toast from 'react-hot-toast';"
);

// 2. Interface Subscription
content = content.replace(
  "  accountEmail?: string;\n}",
  "  accountEmail?: string;\n  encryptedNotes?: string;\n  decryptedNotes?: any;\n}"
);

// 3. getEmptyForm
content = content.replace(
  "const getEmptyForm = () => ({ id: Date.now().toString() + Math.random(), name: '', price: '' as number | '', currency: 'IDR', billingCycle: 'monthly', nextBillingDate: '', status: 'active', accountEmail: '' });",
  "const getEmptyForm = () => ({ id: Date.now().toString() + Math.random(), name: '', price: '' as number | '', currency: 'IDR', billingCycle: 'monthly', nextBillingDate: '', status: 'active', accountEmail: '', url: '', password: '' });"
);

// 4. Subscriptions component
content = content.replace(
  "export const Subscriptions = () => {",
  "export const Subscriptions = () => {\n  const { masterPassword } = useVaultStore();\n  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});"
);

// 5. fetchItems
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
content = content.replace(oldFetch.trim(), newFetch.trim());

// 6. openEdit
const oldOpenEdit = `
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
const newOpenEdit = `
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
content = content.replace(oldOpenEdit.trim(), newOpenEdit.trim());

// 7. handleSave
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
content = content.replace(oldHandleSave.trim(), newHandleSave.trim());

// 8. Form UI replacing "Baris 1" up to "Baris 2"
const oldBaris1Start = `                  {/* Baris 1 (3 form) */}`;
const oldBaris1End = `                  {/* Baris 2 */}`;
let idx1 = content.indexOf(oldBaris1Start);
let idx2 = content.indexOf(oldBaris1End);
if(idx1 !== -1 && idx2 !== -1) {
  const newFormsUI = `                  {/* Baris 1 (4 form) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Nama Layanan *</label>
                      <input
                        type="text" required value={formData.name}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].name = e.target.value;
                          setFormsData(newForms);
                        }}
                        placeholder="Netflix..."
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Harga</label>
                      <input
                        type="text" value={formData.price === '' || formData.price === undefined ? '' : formatCurrency(formData.price as number, formData.currency || 'IDR')}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          const rawValue = e.target.value.replace(/[^0-9]/g, '');
                          newForms[index].price = rawValue === '' ? '' : parseFloat(rawValue);
                          setFormsData(newForms);
                        }}
                        placeholder="0"
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Email Akun</label>
                      <input
                        type="email" value={formData.accountEmail || ''}
                        onChange={(e) => {
                          const newForms = [...formsData];
                          newForms[index].accountEmail = e.target.value;
                          setFormsData(newForms);
                        }}
                        placeholder="@"
                        className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 block flex items-center gap-1"><Lock size={10}/> Password</label>
                      <div className="relative">
                        <input
                          type={showPasswordMap['form_'+index] ? "text" : "password"} 
                          value={formData.password || ''}
                          onChange={(e) => {
                            const newForms = [...formsData];
                            newForms[index].password = e.target.value;
                            setFormsData(newForms);
                          }}
                          placeholder="***"
                          className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg pl-2 pr-7 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                        <button type="button" onClick={() => setShowPasswordMap({...showPasswordMap, ['form_'+index]: !showPasswordMap['form_'+index]})} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                          {showPasswordMap['form_'+index] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* URL Akses */}
                  <div>
                    <label className="text-[10px] font-medium text-text-muted mb-0.5 block truncate">Link Akses URL</label>
                    <input
                      type="url" value={formData.url || ''}
                      onChange={(e) => {
                        const newForms = [...formsData];
                        newForms[index].url = e.target.value;
                        setFormsData(newForms);
                      }}
                      placeholder="https://netflix.com/login"
                      className="w-full bg-black/5 dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>

                  `;
  content = content.substring(0, idx1) + newFormsUI + content.substring(idx2);
}

// 9. Table Row UI to include URL & Copy buttons
const oldTrEnd = `
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
`;
const newTrEnd = `
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {item.decryptedNotes?.url && (
                          <a 
                            href={item.decryptedNotes.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-1.5 text-info hover:bg-info/10 rounded transition-colors"
                            title="Buka Link Akses"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {item.decryptedNotes?.password && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.decryptedNotes.password);
                              toast.success('Password tersalin!');
                            }}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                            title="Salin Password"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                          title="Edit Langganan"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
`;
content = content.replace(oldTrEnd.trim(), newTrEnd.trim());

fs.writeFileSync(file, content, 'utf8');
