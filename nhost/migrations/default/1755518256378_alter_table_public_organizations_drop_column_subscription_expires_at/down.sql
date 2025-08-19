alter table "public"."organizations" alter column "subscription_expires_at" drop not null;
alter table "public"."organizations" add column "subscription_expires_at" timestamptz;
