alter table "public"."departments" drop constraint "departments_org_fkey",
  add constraint "departments_organization_id_fkey"
  foreign key ("organization_id")
  references "public"."organizations"
  ("id") on update cascade on delete cascade;
