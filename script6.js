const fs = require('fs');
const file = 'F:/BLUEPRINT APLIKASI/vaultpro/frontend/src/pages/Subscriptions.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /{ \/\* Baris 1 \(3 form\) \*\/ }[\s\S]*?{ \/\* Baris 2 \*\/ }/;
const newFormsUI = `{/* Baris 1 (4 form) */}
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
                      <label className="text-[10px] font-medium text-text-muted mb-0.5 flex items-center gap-1"><Lock size={10}/> Password</label>
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

                  {/* Baris 2 */}`;
content = content.replace(regex, newFormsUI);

fs.writeFileSync(file, content, 'utf8');
