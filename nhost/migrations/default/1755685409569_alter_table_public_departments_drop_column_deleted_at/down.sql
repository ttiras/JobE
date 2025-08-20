alter table "public"."departments" alter column "deleted_at" drop not null;
alter table "public"."departments" add column "deleted_at" text;
