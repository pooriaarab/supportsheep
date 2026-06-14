CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`connected_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integrations_blog_idx` ON `integrations` (`blog_id`);--> statement-breakpoint
CREATE INDEX `integrations_blog_type_idx` ON `integrations` (`blog_id`,`type`);