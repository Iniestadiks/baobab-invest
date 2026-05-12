#!/bin/bash
BACKUP_DIR="/home/baobab-invest/backups"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

mkdir -p $BACKUP_DIR

PGPASSWORD="BaobabSecure2025x" pg_dump \
  -h localhost -p 5432 \
  -U baobab_user \
  baobab_db | gzip > "$BACKUP_DIR/baobab_$DATE.sql.gz"

if [ $? -eq 0 ] && [ -s "$BACKUP_DIR/baobab_$DATE.sql.gz" ]; then
  SIZE=$(du -h "$BACKUP_DIR/baobab_$DATE.sql.gz" | cut -f1)
  echo "✅ Backup créé: baobab_$DATE.sql.gz ($SIZE)"
  find $BACKUP_DIR -name "*.sql.gz" -mtime +$KEEP_DAYS -delete
  echo "Backups disponibles:"
  ls -lh $BACKUP_DIR/*.sql.gz 2>/dev/null
else
  echo "❌ Échec du backup"
  rm -f "$BACKUP_DIR/baobab_$DATE.sql.gz"
fi
