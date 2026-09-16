"""
AstroLedger Standalone Server Entry Point
Used by PyInstaller to create a self-contained binary for client PCs.
"""
import os
import sys
from pathlib import Path

# Disable NVX C-extensions in autobahn so it doesn't look for missing .c files
os.environ['AUTOBAHN_USE_NVX'] = '0'

# PyInstaller extracts bundled files to sys._MEIPASS
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent

# Ensure stdout and stderr are available even in windowed/redirected environments
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.core.management import call_command

def main():
    print("[AstroLedger Engine] Initializing Vedic Astrology Backend Server...")
    sys.stdout.flush()

    # 1. Automatic Database Migrations (Zero-setup for fresh client installations)
    try:
        print("[AstroLedger Engine] Syncing database schema...")
        sys.stdout.flush()
        call_command('migrate', '--run-syncdb', interactive=False)
        print("[AstroLedger Engine] Database schema verified.")
        sys.stdout.flush()
    except Exception as e:
        print(f"[AstroLedger Engine] Migration warning: {e}")
        sys.stdout.flush()

    # Silently ensure Windows Firewall allows local Wi-Fi port 8000 (Zero-config for clients)
    if sys.platform == 'win32':
        try:
            import subprocess
            subprocess.run(
                ['netsh', 'advfirewall', 'firewall', 'add', 'rule', 'name=AstroLedger Server (Port 8000)', 'dir=in', 'action=allow', 'protocol=TCP', 'localport=8000', 'profile=any'],
                capture_output=True,
                creationflags=0x08000000
            )
        except Exception:
            pass

    # 2. Start HTTP/WebSocket server
    host = os.environ.get('ASTRO_HOST', '0.0.0.0')
    port = os.environ.get('ASTRO_PORT', '8000')
    bind_addr = f"{host}:{port}"

    print(f"[AstroLedger Engine] Server listening on http://{bind_addr}")
    sys.stdout.flush()

    call_command('runserver', bind_addr, '--noreload')

if __name__ == '__main__':
    main()
