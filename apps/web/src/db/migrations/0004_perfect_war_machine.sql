CREATE TABLE `blog_members` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`blog_id`) REFERENCES `blogs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_members_blog_user_idx` ON `blog_members` (`blog_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `blog_members_user_idx` ON `blog_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `blogs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`custom_domain` text,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blogs_slug_unique` ON `blogs` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `blogs_custom_domain_unique` ON `blogs` (`custom_domain`);
--> statement-breakpoint
INSERT INTO blogs (id, slug, custom_domain, display_name, created_at, updated_at)
VALUES ('default', 'default', NULL, 'BlogBat', '2026-06-02T00:00:00.000Z', '2026-06-02T00:00:00.000Z')
ON CONFLICT(id) DO NOTHING;