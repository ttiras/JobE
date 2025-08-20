alter table "public"."positions"
  add constraint "positions_department_id_fkey"
  foreign key ("department_id")
  references "public"."departments"
  ("id") on update cascade on delete cascade;
