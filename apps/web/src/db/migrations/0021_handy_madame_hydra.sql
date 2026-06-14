CREATE TABLE `content_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`posts` text DEFAULT '[]' NOT NULL,
	`provider` text DEFAULT 'claude' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_plans_blog_idx` ON `content_plans` (`blog_id`);--> statement-breakpoint
CREATE INDEX `content_plans_blog_created_idx` ON `content_plans` (`blog_id`,`created_at`);