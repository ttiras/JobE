alter table "public"."positions"
  add constraint "positions_reports_to_fkey"
  foreign key ("reports_to_id")
  references "public"."positions"
  ("id") on update no action on delete set null;
