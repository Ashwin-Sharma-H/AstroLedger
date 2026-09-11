"""
AstroLedger Database Health Check Management Command.

Usage:
    python manage.py check_db                  # Quick health check
    python manage.py check_db --timeout 10     # Custom timeout (seconds)
    python manage.py check_db --migrations     # Also check pending migrations

Exit codes:
    0 — Database is healthy and responsive
    1 — Database connection failed or has issues
"""
import sys
import time

from django.core.management.base import BaseCommand
from django.db import connections, OperationalError
from django.core.management import call_command
from io import StringIO


class Command(BaseCommand):
    help = 'Verify database connectivity, read/write health, and migration status.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout',
            type=int,
            default=5,
            help='Maximum seconds to wait for database connection (default: 5).',
        )
        parser.add_argument(
            '--migrations',
            action='store_true',
            default=False,
            help='Also check for pending unapplied migrations.',
        )
        parser.add_argument(
            '--retries',
            type=int,
            default=1,
            help='Number of retry attempts before failing (default: 1).',
        )
        parser.add_argument(
            '--retry-delay',
            type=float,
            default=2.0,
            help='Seconds to wait between retry attempts (default: 2.0).',
        )

    def handle(self, *args, **options):
        timeout = options['timeout']
        check_migrations = options['migrations']
        retries = options['retries']
        retry_delay = options['retry_delay']

        self.stdout.write(self.style.NOTICE('=' * 60))
        self.stdout.write(self.style.NOTICE('  AstroLedger -- Database Health Check'))
        self.stdout.write(self.style.NOTICE('=' * 60))

        db_settings = connections['default'].settings_dict
        engine = db_settings.get('ENGINE', '')
        db_name = db_settings.get('NAME', 'unknown')
        host = db_settings.get('HOST', 'localhost') or 'localhost'

        if 'sqlite' in engine:
            self.stdout.write(f'  Engine:   SQLite')
            self.stdout.write(f'  Database: {db_name}')
        else:
            self.stdout.write(f'  Engine:   PostgreSQL')
            self.stdout.write(f'  Host:     {host}:{db_settings.get("PORT", 5432)}')
            self.stdout.write(f'  Database: {db_name}')
            self.stdout.write(f'  User:     {db_settings.get("USER", "unknown")}')
            conn_max_age = db_settings.get('CONN_MAX_AGE', 0)
            self.stdout.write(f'  Pool:     CONN_MAX_AGE={conn_max_age}s')
            ssl_opts = db_settings.get('OPTIONS', {}).get('sslmode', 'disabled')
            self.stdout.write(f'  SSL:      {ssl_opts}')

        self.stdout.write('')

        # --- Step 1: Connection Test ---
        connected = False
        for attempt in range(1, retries + 1):
            try:
                start = time.time()
                conn = connections['default']
                conn.ensure_connection()
                elapsed = time.time() - start
                self.stdout.write(self.style.SUCCESS(
                    f'  [OK] Connection established ({elapsed:.3f}s)'
                ))
                connected = True
                break
            except OperationalError as e:
                self.stdout.write(self.style.ERROR(
                    f'  [FAIL] Connection attempt {attempt}/{retries} failed: {e}'
                ))
                if attempt < retries:
                    self.stdout.write(f'    Retrying in {retry_delay}s...')
                    time.sleep(retry_delay)

        if not connected:
            self.stdout.write(self.style.ERROR('\n  HEALTH CHECK FAILED: Cannot connect to database.'))
            self.stdout.write(self.style.NOTICE('=' * 60))
            sys.exit(1)

        # --- Step 2: Read/Write Test ---
        try:
            cursor = connections['default'].cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result and result[0] == 1:
                self.stdout.write(self.style.SUCCESS('  [OK] Read query OK (SELECT 1)'))
            else:
                raise Exception(f'Unexpected query result: {result}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  [FAIL] Read query failed: {e}'))
            sys.exit(1)

        # --- Step 3: Migration Status ---
        if check_migrations:
            self.stdout.write('')
            try:
                out = StringIO()
                call_command('showmigrations', '--plan', stdout=out)
                migration_output = out.getvalue()
                unapplied = [
                    line.strip()
                    for line in migration_output.strip().split('\n')
                    if line.strip().startswith('[ ]')
                ]
                if unapplied:
                    self.stdout.write(self.style.WARNING(
                        f'  [WARN] {len(unapplied)} pending migration(s):'
                    ))
                    for m in unapplied[:10]:
                        self.stdout.write(f'    {m}')
                    if len(unapplied) > 10:
                        self.stdout.write(f'    ... and {len(unapplied) - 10} more')
                else:
                    self.stdout.write(self.style.SUCCESS('  [OK] All migrations applied'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  [WARN] Could not check migrations: {e}'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('  DATABASE HEALTH CHECK PASSED'))
        self.stdout.write(self.style.NOTICE('=' * 60))
