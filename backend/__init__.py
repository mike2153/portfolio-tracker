import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from the apikeys file first
apikeys_path = Path(__file__).resolve().parent / 'apikeys'
if apikeys_path.exists():
    load_dotenv(apikeys_path)

if 'DJANGO_SETTINGS_MODULE' not in os.environ:
    os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.core.settings'


