alter table "public"."positions" drop constraint "positions_org_fkey",
  add constraint "positions_organization_id_fkey"
  foreign key ("organization_id")
  references "public"."organizations"
  ("id") on update cascade on delete cascade;
