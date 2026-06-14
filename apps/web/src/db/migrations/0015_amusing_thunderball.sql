CREATE TABLE `free_tool_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`tool_id` text NOT NULL,
	`day` text NOT NULL,
	`subject_hash` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first_used_at` integer NOT NULL,
	`last_used_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `free_tool_usage_blog_idx` ON `free_tool_usage` (`blog_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `free_tool_usage_lookup_idx` ON `free_tool_usage` (`blog_id`,`tool_id`,`subject_hash`,`day`);--> statement-breakpoint
CREATE TABLE `free_tools` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`template_id` text NOT NULL,
	`source` text DEFAULT 'predefined' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`meta_title` text DEFAULT '' NOT NULL,
	`meta_description` text DEFAULT '' NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`faq` text DEFAULT '[]' NOT NULL,
	`cta` text DEFAULT '{}' NOT NULL,
	`callout` text DEFAULT '{}' NOT NULL,
	`appearance` text DEFAULT '{}' NOT NULL,
	`ai` text DEFAULT '{}' NOT NULL,
	`seo` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `free_tools_blog_idx` ON `free_tools` (`blog_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `free_tools_blog_slug_idx` ON `free_tools` (`blog_id`,`slug`);