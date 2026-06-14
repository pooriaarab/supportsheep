CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`category` text,
	`primary_category` text,
	`post_type` text,
	`author_id` text,
	`published_at` text,
	`scheduled_at` text,
	`word_count` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_blog_slug_idx` ON `articles` (`blog_id`,`slug`);--> statement-breakpoint
CREATE INDEX `articles_blog_status_idx` ON `articles` (`blog_id`,`status`);--> statement-breakpoint
CREATE INDEX `articles_blog_updated_idx` ON `articles` (`blog_id`,`updated_at`);