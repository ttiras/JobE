alter table "public"."departments"
  add constraint "departments_organization_id_fkey"
  foreign key ("organization_id")
  references "public"."organizations"
  ("id") on update cascade on delete cascade;
