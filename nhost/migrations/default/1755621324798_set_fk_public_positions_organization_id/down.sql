alter table "public"."positions" drop constraint "positions_organization_id_fkey",
  add constraint "positions_org_fkey"
  foreign key ("organization_id")
  references "public"."organizations"
  ("id") on update restrict on delete restrict;
