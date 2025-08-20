CREATE TABLE "public"."industries" ("value" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "label_en" text NOT NULL, "label_tr" text NOT NULL, "sort_order" integer NOT NULL, "is_active" boolean NOT NULL, PRIMARY KEY ("value") );
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
CREATE TRIGGER "set_public_industries_updated_at"
BEFORE UPDATE ON "public"."industries"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_industries_updated_at" ON "public"."industries"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
