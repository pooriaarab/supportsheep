CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`user_id` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`action_url` text,
	`metadata` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_blog_user_idx` ON `notifications` (`blog_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_blog_user_read_idx` ON `notifications` (`blog_id`,`user_id`,`read`);