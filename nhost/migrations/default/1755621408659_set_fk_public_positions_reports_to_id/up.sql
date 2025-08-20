alter table "public"."positions" drop constraint "positions_reports_to_fkey",
  add constraint "positions_reports_to_id_fkey"
  foreign key ("reports_to_id")
  references "public"."positions"
  ("id") on update cascade on delete set null;
