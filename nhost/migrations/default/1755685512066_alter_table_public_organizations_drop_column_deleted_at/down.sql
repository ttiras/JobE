alter table "public"."organizations" alter column "deleted_at" drop not null;
alter table "public"."organizations" add column "deleted_at" timestamptz;
