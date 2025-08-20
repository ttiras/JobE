alter table "public"."positions" drop constraint "positions_department_id_fkey",
  add constraint "positions_dept_fkey"
  foreign key ("department_id")
  references "public"."departments"
  ("id") on update restrict on delete restrict;
