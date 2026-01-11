CREATE TYPE "public"."role" AS ENUM('student', 'teacher');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "role" NOT NULL;