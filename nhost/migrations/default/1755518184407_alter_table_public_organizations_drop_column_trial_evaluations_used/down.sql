alter table "public"."organizations" alter column "trial_evaluations_used" set default 0;
alter table "public"."organizations" alter column "trial_evaluations_used" drop not null;
alter table "public"."organizations" add column "trial_evaluations_used" int4;
