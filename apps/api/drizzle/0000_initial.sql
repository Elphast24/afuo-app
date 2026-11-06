CREATE TYPE "public"."listing_status" AS ENUM('ACTIVE', 'SOLD', 'EXPIRED', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "public"."produce_category" AS ENUM('VEGETABLES', 'FRUITS', 'GRAINS', 'LEGUMES', 'DAIRY', 'LIVESTOCK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('KG', 'TONS', 'CRATES', 'BAGS_90KG', 'PIECES', 'LITRES', 'BUNCHES');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('FARMER', 'BUYER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produce_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"produce_type" varchar(100) NOT NULL,
	"category" "produce_category" NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" "unit_type" NOT NULL,
	"price_per_unit" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"location" varchar(100) NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"available_from" date NOT NULL,
	"available_to" date NOT NULL,
	"is_organic" boolean DEFAULT false NOT NULL,
	"description" text,
	"status" "listing_status" DEFAULT 'ACTIVE' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(500) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewee_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"name" varchar(100),
	"role" "user_role" DEFAULT 'FARMER' NOT NULL,
	"avatar_url" varchar(500),
	"location" varchar(100),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_produce_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."produce_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_produce_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."produce_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_produce_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."produce_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_buyer_listing_idx" ON "conversations" USING btree ("buyer_id","listing_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "listings_produce_type_idx" ON "produce_listings" USING btree ("produce_type");--> statement-breakpoint
CREATE INDEX "listings_category_idx" ON "produce_listings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "listings_location_idx" ON "produce_listings" USING btree ("location");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "produce_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_farmer_idx" ON "produce_listings" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "listings_availability_idx" ON "produce_listings" USING btree ("available_from","available_to");--> statement-breakpoint
CREATE INDEX "listings_geo_idx" ON "produce_listings" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_reviewer_listing_idx" ON "reviews" USING btree ("reviewer_id","listing_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");