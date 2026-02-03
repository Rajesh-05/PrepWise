import importlib
modules = [
    'asyncio','logging','os','queue','threading','dotenv','json','flask','flask_cors','time','math','tempfile','requests','pdfplumber','pandas','jobspy','pymongo','PyJWT','werkzeug'
]
missing = []
for m in modules:
    try:
        importlib.import_module(m)
    except Exception as e:
        missing.append({'module': m, 'error': str(e)})
print({'missing': missing})