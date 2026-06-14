CREATE TABLE `context_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`name` text NOT NULL,
	`target_audience` text DEFAULT '',
	`tone` text DEFAULT 'professional',
	`style` text DEFAULT 'informative',
	`language` text DEFAULT 'English',
	`custom_prompt` text DEFAULT '',
	`article_length` text,
	`cta` text,
	`image_settings` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `context_tags_blog_idx` ON `context_tags` (`blog_id`);