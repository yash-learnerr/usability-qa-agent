import json
from dashboard import server

rows = server._load_all_reports()
print(json.dumps([{"id": r.get('id'), "filename": r.get('filename'), "seed_url": r.get('seed_url')} for r in rows], indent=2))
