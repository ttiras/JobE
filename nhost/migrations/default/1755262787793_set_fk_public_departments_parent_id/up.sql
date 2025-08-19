alter table "public"."departments"
  add constraint "departments_parent_id_fkey"
  foreign key ("parent_id")
  references "public"."departments"
  ("id") on update restrict on delete restrict;
