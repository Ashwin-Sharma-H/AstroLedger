#!/usr/bin/env python
"""
AstroLedger — Database Restore Utility

Supports:
  - SQLite:      Replaces db.sqlite3 with the specified backup file
  - PostgreSQL:  Runs psql (plain) or pg_restore (custom) to restore from backup

Usage:
    python backend/scripts/restore_db.py backup_file.db
    python backend/scripts/restore_db.py backup_file.sql
    python backend/scripts/restore_db.py backup_file.dump --format custom
    python backend/scripts/restore_db.py backup_file.sql --yes   # Skip confirmation
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

# Ensure Django settings are importable
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.conf import settings


def restore_sqlite(backup_path: Path, db_path: Path) -> None:
    """Replace the SQLite database with a backup copy."""
    if not backup_path.exists():
        print(f'ERROR: Backup file not found: {backup_path}')
        sys.exit(1)

    if db_path.exists():
        # Create a safety copy before overwriting
        safety_path = db_path.with_suffix('.pre_restore.db')
        shutil.copy2(str(db_path), str(safety_path))
        print(f'  Safety copy saved: {safety_path}')

    shutil.copy2(str(backup_path), str(db_path))


def restore_postgres(backup_path: Path, db_settings: dict, fmt: str = 'plain') -> None:
    """Restore a PostgreSQL database from pg_dump output."""
    if not backup_path.exists():
        print(f'ERROR: Backup file not found: {backup_path}')
        sys.exit(1)

    db_name = db_settings.get('NAME', 'astroledger')
    host = db_settings.get('HOST', 'localhost') or 'localhost'
    port = str(db_settings.get('PORT', 5432))
    user = db_settings.get('USER', 'postgres')
    password = db_settings.get('PASSWORD', '')

    env = os.environ.copy()
    if password:
        env['PGPASSWORD'] = password

    if fmt == 'custom':
        cmd = [
            'pg_restore',
            f'--host={host}',
            f'--port={port}',
            f'--username={user}',
            f'--dbname={db_name}',
            '--clean',
            '--if-exists',
            '--no-owner',
            '--no-password',
            str(backup_path),
        ]
    else:
        cmd = [
            'psql',
            f'--host={host}',
            f'--port={port}',
            f'--username={user}',
            f'--dbname={db_name}',
            '--no-password',
            '-f', str(backup_path),
        ]

    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            tool_name = 'pg_restore' if fmt == 'custom' else 'psql'
            print(f'WARNING: {tool_name} returned non-zero exit code.')
            if result.stderr:
                print(f'  stderr: {result.stderr[:500]}')
    except FileNotFoundError:
        tool_name = 'pg_restore' if fmt == 'custom' else 'psql'
        print(f'ERROR: {tool_name} not found. Ensure PostgreSQL client tools are installed.')
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print('ERROR: Restore timed out after 300 seconds.')
        sys.exit(1)


def main():
    import argparse

    parser = argparse.ArgumentParser(description='AstroLedger Database Restore Utility')
    parser.add_argument('backup_file', help='Path to the backup file to restore from.')
    parser.add_argument(
        '--format', choices=['plain', 'custom'], default='plain',
        help='Backup format (PostgreSQL only). Default: plain SQL.'
    )
    parser.add_argument(
        '--yes', action='store_true', default=False,
        help='Skip confirmation prompt.'
    )
    args = parser.parse_args()

    backup_path = Path(args.backup_file).resolve()
    if not backup_path.exists():
        print(f'ERROR: Backup file not found: {backup_path}')
        sys.exit(1)

    db_config = settings.DATABASES['default']
    engine = db_config.get('ENGINE', '')

    print('=' * 60)
    print('  AstroLedger -- Database Restore')
    print('=' * 60)
    print(f'  Backup:   {backup_path}')
    print(f'  Size:     {backup_path.stat().st_size / (1024 * 1024):.2f} MB')

    if 'sqlite' in engine:
        db_path = Path(db_config['NAME'])
        print(f'  Engine:   SQLite')
        print(f'  Target:   {db_path}')
    elif 'postgresql' in engine:
        print(f'  Engine:   PostgreSQL')
        print(f'  Host:     {db_config.get("HOST", "localhost")}:{db_config.get("PORT", 5432)}')
        print(f'  Database: {db_config.get("NAME")}')
        print(f'  Format:   {args.format}')
    else:
        print(f'ERROR: Unsupported database engine: {engine}')
        sys.exit(1)

    if not args.yes:
        print('')
        print('  ⚠  WARNING: This will OVERWRITE the current database.')
        response = input('  Proceed? (type "yes" to confirm): ')
        if response.strip().lower() != 'yes':
            print('  Restore cancelled.')
            sys.exit(0)

    print('')
    if 'sqlite' in engine:
        restore_sqlite(backup_path, Path(db_config['NAME']))
    else:
        restore_postgres(backup_path, db_config, args.format)

    print('  [OK] Database restored successfully')
    print('=' * 60)


if __name__ == '__main__':
    main()
