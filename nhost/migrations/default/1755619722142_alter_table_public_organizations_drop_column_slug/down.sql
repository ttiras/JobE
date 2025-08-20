alter table "public"."organizations" add constraint "organizations_slug_key" unique (slug);
alter table "public"."organizations" alter column "slug" drop not null;
alter table "public"."organizations" add column "slug" text;
