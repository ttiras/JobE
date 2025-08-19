alter table "public"."organizations" alter column "subscription_tier" drop not null;
alter table "public"."organizations" add column "subscription_tier" text;
