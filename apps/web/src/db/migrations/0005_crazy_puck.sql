CREATE TABLE `authors` (
	`pk` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`job_title` text DEFAULT '',
	`bio` text DEFAULT '' NOT NULL,
	`avatar_url` text DEFAULT '',
	`email` text DEFAULT '',
	`same_as` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_blog_slug_idx` ON `authors` (`blog_id`,`slug`);