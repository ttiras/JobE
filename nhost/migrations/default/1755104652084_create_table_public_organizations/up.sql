CREATE TABLE "public"."organizations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "name" text NOT NULL, "slug" text NOT NULL, "created_by" uuid NOT NULL, "industry" text NOT NULL, "country" text NOT NULL, "trial_evaluations_used" integer NOT NULL DEFAULT 0, "trial_evaluations_limit" integer NOT NULL DEFAULT 3, "subscription_type" text NOT NULL DEFAULT 'trial', "subscription_status" text NOT NULL DEFAULT 'active', "subscription_tier" text NOT NULL, "subscription_expires_at" timestamptz, "next_billing_date" timestamptz NOT NULL, "billing_email" Text NOT NULL, "size" text NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "parent_organization_id" uuid, "settings" jsonb, PRIMARY KEY ("id") , FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON UPDATE cascade ON DELETE set null, UNIQUE ("slug"));
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_organizations_updated_at"
BEFORE UPDATE ON "public"."organizations"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_organizations_updated_at" ON "public"."organizations"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
