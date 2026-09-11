#!/usr/bin/env python
"""
AstroLedger — Database Backup Utility

Supports:
  - SQLite:      Creates a file copy of db.sqlite3
  - PostgreSQL:  Runs pg_dump to generate a compressed SQL archive

Usage:
    python backend/scripts/backup_db.py
    python backend/scripts/backup_db.py --format custom   # pg_dump custom format
    python backend/scripts/backup_db.py --output /path/to/backup.sql
"""
import os
import sys
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

# Ensure Django settings are importable
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.conf import settings


def get_timestamp() -> str:
    return datetime.now().strftime('%Y%m%d_%H%M%S')


def backup_sqlite(db_path: Path, output_dir: Path, output_file: str | None = None) -> Path:
    """Create a file copy of the SQLite database."""
    if not db_path.exists():
        print(f'ERROR: SQLite database not found at {db_path}')
        sys.exit(1)

    if output_file:
        backup_path = Path(output_file)
    else:
        backup_path = output_dir / f'astroledger_sqlite_{get_timestamp()}.db'

    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(db_path), str(backup_path))
    return backup_path


def backup_postgres(db_settings: dict, output_dir: Path, fmt: str = 'plain', output_file: str | None = None) -> Path:
    """Run pg_dump to backup the PostgreSQL database."""
    db_name = db_settings.get('NAME', 'astroledger')
    host = db_settings.get('HOST', 'localhost') or 'localhost'
    port = str(db_settings.get('PORT', 5432))
    user = db_settings.get('USER', 'postgres')
    password = db_settings.get('PASSWORD', '')

    ext = '.dump' if fmt == 'custom' else '.sql'
    if output_file:
        backup_path = Path(output_file)
    else:
        backup_path = output_dir / f'astroledger_pg_{get_timestamp()}{ext}'

    backup_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        'pg_dump',
        f'--host={host}',
        f'--port={port}',
        f'--username={user}',
        f'--dbname={db_name}',
        f'--file={backup_path}',
        '--no-password',
    ]

    if fmt == 'custom':
        cmd.append('--format=custom')

    env = os.environ.copy()
    if password:
        env['PGPASSWORD'] = password

    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            print(f'ERROR: pg_dump failed:\n{result.stderr}')
            sys.exit(1)
    except FileNotFoundError:
        print('ERROR: pg_dump not found. Ensure PostgreSQL client tools are installed.')
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print('ERROR: pg_dump timed out after 120 seconds.')
        sys.exit(1)

    return backup_path


def main():
    import argparse

    parser = argparse.ArgumentParser(description='AstroLedger Database Backup Utility')
    parser.add_argument(
        '--format', choices=['plain', 'custom'], default='plain',
        help='pg_dump output format (PostgreSQL only). Default: plain SQL.'
    )
    parser.add_argument(
        '--output', type=str, default=None,
        help='Custom output file path. Default: backend/backups/<timestamp>.<ext>'
    )
    args = parser.parse_args()

    db_config = settings.DATABASES['default']
    engine = db_config.get('ENGINE', '')
    backup_dir = getattr(settings, 'BACKUP_DIR', BACKEND_DIR / 'backups')

    print('=' * 60)
    print('  AstroLedger -- Database Backup')
    print('=' * 60)

    if 'sqlite' in engine:
        db_path = Path(db_config['NAME'])
        print(f'  Engine:   SQLite')
        print(f'  Source:   {db_path}')
        backup_path = backup_sqlite(db_path, backup_dir, args.output)
    elif 'postgresql' in engine:
        print(f'  Engine:   PostgreSQL')
        print(f'  Host:     {db_config.get("HOST", "localhost")}:{db_config.get("PORT", 5432)}')
        print(f'  Database: {db_config.get("NAME")}')
        print(f'  Format:   {args.format}')
        backup_path = backup_postgres(db_config, backup_dir, args.format, args.output)
    else:
        print(f'ERROR: Unsupported database engine: {engine}')
        sys.exit(1)

    size_mb = backup_path.stat().st_size / (1024 * 1024)
    print(f'\n  [OK] Backup created successfully')
    print(f'  File: {backup_path}')
    print(f'  Size: {size_mb:.2f} MB')
    print('=' * 60)


if __name__ == '__main__':
    main()
