import importlib, json
pkgs = ['fastapi','uvicorn','sqlalchemy','pydantic','scapy','bcrypt']
res = {}
for p in pkgs:
    try:
        importlib.import_module(p)
        res[p] = 'OK'
    except Exception as e:
        res[p] = f'{type(e).__name__}: {e}'
print(json.dumps(res))
