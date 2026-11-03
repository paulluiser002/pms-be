# PostgreSQL draft

Apply `schema.sql` to an empty PostgreSQL database with `psql -v ON_ERROR_STOP=1 -f database/schema.sql`. Apply `seed.sql` afterwards for sample data. The seed can be rerun. This is a preliminary domain model, not a production migration; authorization, audit history, workflow transitions, and existing backend integration still need design and implementation. The NestJS backend remains configured for SQL Server.
