-- Enables query-level performance tracking for the whole cluster.
-- shared_preload_libraries is set via the postgres command in docker-compose.yml
-- (it cannot be set with ALTER SYSTEM/CREATE EXTENSION alone - it requires a restart,
-- which is why the library is preloaded from container start).
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
