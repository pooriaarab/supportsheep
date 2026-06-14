CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`name` text NOT NULL,
	`key_preview` text NOT NULL,
	`key_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`last_used` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_keys_owner_idx` ON `api_keys` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);