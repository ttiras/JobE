alter table "public"."positions" alter column "deleted_at" drop not null;
alter table "public"."positions" add column "deleted_at" timestamptz;
