CREATE TABLE IF NOT EXISTS "users" (
	"user_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_username" "citext" NOT NULL,
	"user_email" "citext" NOT NULL,
	"user_password" varchar NOT NULL,
	"user_bio" varchar DEFAULT '',
	"user_image" varchar,
	CONSTRAINT "users_user_username_unique" UNIQUE("user_username"),
	CONSTRAINT "users_user_email_unique" UNIQUE("user_email")
);
