alter table "public"."organizations"
  add constraint "organizations_industry_fkey"
  foreign key ("industry")
  references "public"."industries"
  ("value") on update restrict on delete restrict;
