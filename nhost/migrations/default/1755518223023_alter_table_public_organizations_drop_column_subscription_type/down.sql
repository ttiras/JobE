alter table "public"."organizations" alter column "subscription_type" set default ''trial'::text';
alter table "public"."organizations" alter column "subscription_type" drop not null;
alter table "public"."organizations" add column "subscription_type" text;
