CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`filename` text NOT NULL,
	`url` text NOT NULL,
	`storage_path` text DEFAULT '' NOT NULL,
	`mime_type` text DEFAULT '' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`uploaded_by` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_blog_idx` ON `media` (`blog_id`);--> statement-breakpoint
CREATE INDEX `media_blog_created_idx` ON `media` (`blog_id`,`created_at`);