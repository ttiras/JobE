alter table "public"."organizations"
  add constraint "organizations_currency_fkey"
  foreign key ("currency")
  references "public"."currencies"
  ("code") on update restrict on delete restrict;
