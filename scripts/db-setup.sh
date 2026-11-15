#!/usr/bin/env bash
# Yerel geliştirme veritabanını hazırlar (tekrar tekrar çalıştırılabilir).
#
# 1. PostgreSQL 16 "main" cluster'ını başlatır (kapalıysa).
# 2. Yoksa uygulama kullanıcısını ve veritabanını oluşturur.
#
# Varsayılanlar .env.example'daki DATABASE_URL ile aynıdır; ortam değişkeniyle değiştirilebilir:
#   DB_USER=engineer DB_PASSWORD=engineer DB_NAME=engineer_automation scripts/db-setup.sh
#
# Ardından tabloları oluşturmak için: npm run db:migrate
set -euo pipefail

DB_USER="${DB_USER:-engineer}"
DB_PASSWORD="${DB_PASSWORD:-engineer}"
DB_NAME="${DB_NAME:-engineer_automation}"
PG_VERSION="${PG_VERSION:-16}"
PG_CLUSTER="${PG_CLUSTER:-main}"

# Kimlik doğrulama tanımlayıcıları yalnızca harf, rakam ve alt çizgi içerebilir (SQL enjeksiyonuna karşı).
for ad in "$DB_USER" "$DB_NAME"; do
  if [[ ! "$ad" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "Hata: geçersiz ad '$ad' (yalnızca harf, rakam ve _ kullanılabilir)." >&2
    exit 1
  fi
done
if [[ "$DB_PASSWORD" == *"'"* ]]; then
  echo "Hata: şifre tek tırnak (') içeremez." >&2
  exit 1
fi

# postgres sistem kullanıcısı olarak komut çalıştırır.
as_postgres() {
  if [[ "$(id -un)" == "postgres" ]]; then
    "$@"
  elif [[ "$(id -u)" == "0" ]]; then
    runuser -u postgres -- "$@"
  else
    sudo -u postgres "$@"
  fi
}

psql_postgres() {
  as_postgres psql --no-psqlrc -v ON_ERROR_STOP=1 -X -q "$@"
}

echo "PostgreSQL ${PG_VERSION}/${PG_CLUSTER} kontrol ediliyor..."
if command -v pg_lsclusters >/dev/null 2>&1; then
  if pg_lsclusters --no-header | awk -v v="$PG_VERSION" -v c="$PG_CLUSTER" '$1==v && $2==c {print $4}' | grep -q '^online'; then
    echo "Cluster zaten çalışıyor."
  else
    echo "Cluster başlatılıyor..."
    if [[ "$(id -u)" == "0" ]]; then
      pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start
    else
      sudo pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start
    fi
  fi
else
  # pg_lsclusters yoksa (Debian dışı sistemler) servis yöneticisini dene.
  service postgresql start || true
fi

# Sunucu bağlantı kabul edene kadar bekle (en fazla ~15 sn).
for _ in $(seq 1 30); do
  if as_postgres pg_isready -q; then
    break
  fi
  sleep 0.5
done
if ! as_postgres pg_isready -q; then
  echo "Hata: PostgreSQL bağlantı kabul etmiyor." >&2
  exit 1
fi

echo "Kullanıcı '${DB_USER}' kontrol ediliyor..."
if psql_postgres -tA -c "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1; then
  echo "Kullanıcı zaten var; şifresi güncelleniyor."
  psql_postgres -c "ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}'"
else
  psql_postgres -c "CREATE ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}'"
  echo "Kullanıcı oluşturuldu."
fi

echo "Veritabanı '${DB_NAME}' kontrol ediliyor..."
# CREATE DATABASE bir DO bloğu içinde çalışmaz; bu yüzden önce varlığını sorgularız.
if psql_postgres -tA -c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  echo "Veritabanı zaten var."
else
  psql_postgres -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\" ENCODING 'UTF8' TEMPLATE template0"
  echo "Veritabanı oluşturuldu."
fi
# Sahiplik sonradan değişmişse düzelt (migration'lar public şemasına yazabilmeli).
psql_postgres -c "ALTER DATABASE \"${DB_NAME}\" OWNER TO \"${DB_USER}\""
psql_postgres -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO \"${DB_USER}\""

echo
echo "Hazır. Bağlantı adresi:"
echo "  DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
echo "Tabloları oluşturmak için: npm run db:migrate"
