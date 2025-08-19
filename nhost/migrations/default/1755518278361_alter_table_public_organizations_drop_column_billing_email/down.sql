alter table "public"."organizations" alter column "billing_email" drop not null;
alter table "public"."organizations" add column "billing_email" text;
