CREATE TABLE `magic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`share_link_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`email` text,
	`expires_at` text,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `magic_links_token_hash_idx` ON `magic_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `magic_links_blog_sl_idx` ON `magic_links` (`blog_id`,`share_link_id`);