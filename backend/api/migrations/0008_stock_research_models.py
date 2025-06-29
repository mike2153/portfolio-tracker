# Generated migration for stock research models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_holding_sector'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserWatchlist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.CharField(db_index=True, max_length=255)),
                ('ticker', models.CharField(db_index=True, max_length=20)),
                ('company_name', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'user_watchlist',
            },
        ),
        migrations.CreateModel(
            name='StockNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.CharField(db_index=True, max_length=255)),
                ('ticker', models.CharField(db_index=True, max_length=20)),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'stock_notes',
            },
        ),
        migrations.AddIndex(
            model_name='userwatchlist',
            index=models.Index(fields=['user_id', 'ticker'], name='user_watchlist_user_id_ticker_idx'),
        ),
        migrations.AddIndex(
            model_name='userwatchlist',
            index=models.Index(fields=['user_id'], name='user_watchlist_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='stocknote',
            index=models.Index(fields=['user_id', 'ticker'], name='stock_notes_user_id_ticker_idx'),
        ),
        migrations.AddIndex(
            model_name='stocknote',
            index=models.Index(fields=['user_id'], name='stock_notes_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='stocknote',
            index=models.Index(fields=['ticker'], name='stock_notes_ticker_idx'),
        ),
        migrations.AddConstraint(
            model_name='userwatchlist',
            constraint=models.UniqueConstraint(fields=('user_id', 'ticker'), name='unique_user_ticker_watchlist'),
        ),
    ]