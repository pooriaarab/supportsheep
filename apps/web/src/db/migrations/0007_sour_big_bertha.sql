CREATE TABLE `writing_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'custom' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT 'claude' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `writing_skills_blog_idx` ON `writing_skills` (`blog_id`);