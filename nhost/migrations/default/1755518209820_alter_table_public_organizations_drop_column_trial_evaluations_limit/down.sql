alter table "public"."organizations" alter column "trial_evaluations_limit" set default 3;
alter table "public"."organizations" alter column "trial_evaluations_limit" drop not null;
alter table "public"."organizations" add column "trial_evaluations_limit" int4;
