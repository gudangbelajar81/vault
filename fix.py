import os
import re

files = [
    'ApiKeys.tsx',
    'Auth.tsx',
    'Courses.tsx',
    'IdentityMap.tsx',
    'Settings.tsx',
    'Shortcuts.tsx',
    'Subscriptions.tsx',
    'Vault.tsx'
]

for f in files:
    path = 'D:/PROJEK/saas/vaultpro/frontend/src/pages/' + f
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Safely re-add backticks
    content = re.sub(r'`?\$\{API_URL\}/api/([a-zA-Z0-9/_-]+)`?', r'`${API_URL}/api/\1`', content)
    
    if f == 'Auth.tsx':
        content = content.replace('`${API_URL}/api/vault`', '`${API_URL}/api/auth/login`')
        # Wait, the register endpoint might also be replaced to auth/login now. I need to be careful.
        # Let's fix Auth.tsx login/register manually in the next step.

    if f == 'IdentityMap.tsx':
        parts = content.split('axios.get(`${API_URL}/api/vault`')
        if len(parts) >= 3:
            content = parts[0] + 'axios.get(`${API_URL}/api/vault`' + parts[1] + 'axios.get(`${API_URL}/api/subscriptions`' + parts[2]
            
        content = content.replace('axios.delete(`${API_URL}/api/vault/${item.id}`', 'axios.delete(`${API_URL}/api/subscriptions/${item.id}`') 
        # Actually I can't guess exactly how it's formatted. I will fix IdentityMap.tsx manually.

    with open(path, 'w', encoding='utf-8') as file:
        file.write(content)
