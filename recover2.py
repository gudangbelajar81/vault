import json
import os

log_file = r'C:\Users\User\.gemini\antigravity\brain\ec91a56c-5804-4130-9623-16e872f8f1fe\.system_generated\logs\transcript_full.jsonl'

files_to_recover = ['Courses.tsx', 'Shortcuts.tsx', 'Subscriptions.tsx', 'Settings.tsx', 'Vault.tsx']

for f_name in files_to_recover:
    content = ""
    with open(log_file, 'r', encoding='utf-8') as f:
        for line in f:
            if 'write_to_file' in line and f_name in line:
                try:
                    data = json.loads(line)
                    if 'tool_calls' in data:
                        for tc in data['tool_calls']:
                            if tc.get('function', {}).get('name') == 'default_api:write_to_file':
                                args = json.loads(tc['function']['arguments'])
                                if args.get('TargetFile', '').endswith(f_name):
                                    content = args.get('CodeContent', '')
                except:
                    pass
    
    if content:
        # Format the endpoints correctly to use API_URL
        content = content.replace("import axios from 'axios';", "import axios from 'axios';\nimport { API_URL } from '../config';")
        content = content.replace("'http://localhost:5001/api/", "${API_URL}/api/")
        content = content.replace("', { withCredentials", ", { withCredentials")
        content = content.replace("http://localhost:5001/api/", "${API_URL}/api/")
        
        path = f'D:/PROJEK/saas/vaultpro/frontend/src/pages/{f_name}'
        with open(path, 'w', encoding='utf-8') as f_out:
            f_out.write(content)
        print(f"Recovered {f_name}")
