import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sync', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConnectedDevice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('device_id', models.CharField(db_index=True, max_length=100)),
                ('device_name', models.CharField(default='Unknown Device', max_length=150)),
                ('device_type', models.CharField(default='desktop', max_length=50)),
                ('ip_address', models.CharField(blank=True, max_length=50)),
                ('user_agent', models.CharField(blank=True, max_length=255)),
                ('last_seen', models.DateTimeField(auto_now=True, db_index=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='connected_devices', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-last_seen'],
                'unique_together': {('user', 'device_id')},
                'indexes': [models.Index(fields=['user', 'last_seen'], name='sync_connec_user_id_47ab60_idx')],
            },
        ),
    ]
