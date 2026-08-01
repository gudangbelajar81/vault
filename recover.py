import json

log_file = r'C:\Users\User\.gemini\antigravity\brain\ec91a56c-5804-4130-9623-16e872f8f1fe\.system_generated\logs\transcript_full.jsonl'

files_to_recover = ['Courses.tsx', 'Shortcuts.tsx', 'ApiKeys.tsx', 'Vault.tsx', 'Settings.tsx', 'Subscriptions.tsx', 'Auth.tsx']
recovered = {}

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'PLANNER_RESPONSE' and 'tool_calls' in data:
                for tc in data['tool_calls']:
                    if tc.get('function', {}).get('name') == 'default_api:write_to_file':
                        args_str = tc['function']['arguments']
                        try:
                            args = json.loads(args_str)
                            target = args.get('TargetFile', '')
                            for f_name in files_to_recover:
                                if target.endswith(f_name):
                                    recovered[f_name] = args.get('CodeContent', '')
                        except:
                            pass
        except:
            pass

for f_name, content in recovered.items():
    if content:
        # Before saving, let's inject import { API_URL } from '../config'; and replace http://localhost:5001 with API_URL
        content = content.replace("import axios from 'axios';", "import axios from 'axios';\nimport { API_URL } from '../config';")
        content = content.replace("http://localhost:5001", "${API_URL}")
        content = content.replace("'http://localhost:5001/api/", "${API_URL}/api/")
        content = content.replace("', { withCredentials", ", { withCredentials")
        
        path = f'D:/PROJEK/saas/vaultpro/frontend/src/pages/{f_name}'
        with open(path, 'w', encoding='utf-8') as f_out:
            f_out.write(content)
            print(f"Recovered {f_name}")
