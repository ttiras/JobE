alter table "public"."departments" drop constraint "departments_organization_id_fkey",
  add constraint "departments_org_fkey"
  foreign key ("organization_id")
  references "public"."organizations"
  ("id") on update no action on delete cascade;
