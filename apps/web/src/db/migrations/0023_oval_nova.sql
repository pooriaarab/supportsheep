CREATE TABLE `wordpress_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`source` text DEFAULT 'wordpress' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`total_posts` integer DEFAULT 0 NOT NULL,
	`imported_posts` integer DEFAULT 0 NOT NULL,
	`rehosted_images` integer DEFAULT 0 NOT NULL,
	`failed_posts` text DEFAULT '[]' NOT NULL,
	`created_by` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wordpress_imports_blog_idx` ON `wordpress_imports` (`blog_id`);--> statement-breakpoint
CREATE INDEX `wordpress_imports_blog_created_idx` ON `wordpress_imports` (`blog_id`,`created_at`);