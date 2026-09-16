"""
AstroLedger Backend Packaging Script
Compiles the Django backend into a standalone, portable Windows executable directory using PyInstaller.
"""
import os
import sys
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def build():
    print("===================================================")
    print("      Building AstroLedger Standalone Server       ")
    print("===================================================")

    # 1. Ensure pyinstaller is available
    try:
        import PyInstaller
        print(f"[*] PyInstaller version: {PyInstaller.__version__}")
    except ImportError:
        print("[*] PyInstaller not found. Installing into virtual environment...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # 2. Comprehensive hidden imports for Django, DRF, Channels & AstroLedger apps
    hidden_imports = [
        'config',
        'config.settings',
        'config.urls',
        'config.asgi',
        'config.wsgi',
        'apps',
        'apps.accounts',
        'apps.accounts.apps',
        'apps.accounts.models',
        'apps.accounts.views',
        'apps.accounts.serializers',
        'apps.accounts.urls',
        'apps.clients',
        'apps.clients.apps',
        'apps.clients.models',
        'apps.clients.views',
        'apps.clients.serializers',
        'apps.clients.urls',
        'apps.consultations',
        'apps.consultations.apps',
        'apps.consultations.models',
        'apps.consultations.views',
        'apps.consultations.serializers',
        'apps.consultations.urls',
        'apps.sync',
        'apps.sync.apps',
        'apps.sync.models',
        'apps.sync.authentication',
        'apps.sync.views',
        'apps.sync.urls',
        'apps.dashboard',
        'apps.dashboard.apps',
        'apps.dashboard.views',
        'apps.dashboard.urls',
        'apps.attachments',
        'apps.attachments.apps',
        'apps.attachments.models',
        'apps.attachments.views',
        'apps.attachments.urls',
        'apps.core',
        'apps.core.apps',
        'apps.core.views',
        'apps.core.urls',
        'django.contrib.admin',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.messages',
        'django.contrib.staticfiles',
        'django.db.backends.sqlite3',
        'django.core.management',
        'django.core.management.commands',
        'django.core.management.commands.runserver',
        'django.core.management.commands.migrate',
        'django.core.management.commands.check',
        'rest_framework',
        'rest_framework.permissions',
        'rest_framework.authentication',
        'rest_framework.parsers',
        'rest_framework.renderers',
        'rest_framework_simplejwt',
        'rest_framework_simplejwt.authentication',
        'corsheaders',
        'corsheaders.middleware',
        'channels',
        'channels.routing',
        'channels.layers',
        'daphne',
        'daphne.server',
    ]

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=astroledger-server",
        "--onedir",
        "--noconfirm",
        "--clean",
        f"--add-data={BASE_DIR / 'apps'};apps",
        f"--add-data={BASE_DIR / 'config'};config",
        f"--add-data={BASE_DIR.parent / 'frontend' / 'dist'};frontend_dist",
        "--collect-all=autobahn",
        "--collect-all=daphne",
    ]

    excludes = [
        'tkinter',
        'django.db.backends.oracle',
        'django.db.backends.mysql',
        'django.db.backends.dummy',
        'test',
        'tests',
    ]

    for exc in excludes:
        cmd.extend(["--exclude-module", exc])

    for imp in hidden_imports:
        cmd.extend(["--hidden-import", imp])

    entry_point = str(BASE_DIR / "server_entry.py")
    cmd.append(entry_point)

    # Set up environment with Django settings module so PyInstaller hooks analyze cleanly
    env = os.environ.copy()
    env['DJANGO_SETTINGS_MODULE'] = 'config.settings'
    env['AUTOBAHN_USE_NVX'] = '0'
    env['PYTHONPATH'] = str(BASE_DIR) + os.pathsep + env.get('PYTHONPATH', '')

    print("[*] Compiling backend into standalone distribution folder...")
    subprocess.check_call(cmd, cwd=str(BASE_DIR), env=env)

    output_dir = BASE_DIR / "dist" / "astroledger-server"
    if output_dir.exists():
        print("===================================================")
        print(f"[SUCCESS] Standalone backend built at:")
        print(f"          {output_dir}")
        print("===================================================")
    else:
        print("[ERROR] Build failed: output directory not found.")
        sys.exit(1)

if __name__ == '__main__':
    build()
