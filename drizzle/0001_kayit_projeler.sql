CREATE TABLE "kayitli_hesap" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"proje_id" text,
	"hesap_slug" text NOT NULL,
	"hesap_id" text NOT NULL,
	"ad" text NOT NULL,
	"notlar" text,
	"girdiler" jsonb NOT NULL,
	"cikti_birimleri" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proje" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ad" text NOT NULL,
	"aciklama" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "decimals" SET DEFAULT 4;--> statement-breakpoint
ALTER TABLE "kayitli_hesap" ADD CONSTRAINT "kayitli_hesap_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kayitli_hesap" ADD CONSTRAINT "kayitli_hesap_proje_id_proje_id_fk" FOREIGN KEY ("proje_id") REFERENCES "public"."proje"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proje" ADD CONSTRAINT "proje_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kayitli_hesap_userId_idx" ON "kayitli_hesap" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kayitli_hesap_projeId_idx" ON "kayitli_hesap" USING btree ("proje_id");--> statement-breakpoint
CREATE INDEX "proje_userId_idx" ON "proje" USING btree ("user_id");