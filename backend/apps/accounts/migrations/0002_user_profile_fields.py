from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='title',
            field=models.CharField(blank=True, default='Vedic Astrologer', max_length=150),
        ),
        migrations.AddField(
            model_name='user',
            name='phone',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='user',
            name='bio',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='timezone',
            field=models.CharField(default='Asia/Kolkata', max_length=100),
        ),
    ]
