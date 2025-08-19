alter table "public"."organizations" alter column "subscription_status" set default ''active'::text';
alter table "public"."organizations" alter column "subscription_status" drop not null;
alter table "public"."organizations" add column "subscription_status" text;
