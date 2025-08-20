alter table "public"."departments" drop constraint "departments_parent_id_fkey",
  add constraint "departments_parent_id_fkey"
  foreign key ("parent_id")
  references "public"."departments"
  ("id") on update cascade on delete set null;
