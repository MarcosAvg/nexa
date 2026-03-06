-- Add the "enlaces" table to manage administrative contacts and their extensions

CREATE TABLE IF NOT EXISTS "public"."enlaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_id" "uuid" NOT NULL,
    "extension" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."enlaces" OWNER TO "postgres";

ALTER TABLE ONLY "public"."enlaces"
    ADD CONSTRAINT "enlaces_person_id_key" UNIQUE ("person_id");

ALTER TABLE ONLY "public"."enlaces"
    ADD CONSTRAINT "enlaces_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."enlaces"
    ADD CONSTRAINT "enlaces_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE CASCADE;

CREATE INDEX "idx_enlaces_person_id" ON "public"."enlaces" USING "btree" ("person_id");

-- Enable RLS
ALTER TABLE "public"."enlaces" ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (or based on role as needed)
CREATE POLICY "Enable all for authenticated users on enlaces" ON "public"."enlaces"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
