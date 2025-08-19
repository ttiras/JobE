alter table "public"."organizations" alter column "next_billing_date" drop not null;
alter table "public"."organizations" add column "next_billing_date" timestamptz;
