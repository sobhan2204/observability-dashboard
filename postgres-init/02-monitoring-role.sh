#!/bin/sh
# Dedicated least-privilege role for postgres_exporter. It never touches
# application data - it only needs pg_monitor (built-in since PG10, grants
# SELECT on pg_stat_*/pg_settings) plus explicit read access to
# pg_stat_statements, whose contents are not covered by pg_monitor.
# Note: role names starting with "pg_" are reserved by PostgreSQL itself,
# so the role is named "monitoring_user" rather than "pg_monitor_user".
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE monitoring_user WITH LOGIN PASSWORD '$MONITORING_PASSWORD';
    GRANT pg_monitor TO monitoring_user;
    GRANT SELECT ON pg_stat_statements TO monitoring_user;
EOSQL
