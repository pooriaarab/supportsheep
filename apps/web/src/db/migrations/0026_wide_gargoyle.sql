CREATE TABLE `signup_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`blog_id` text NOT NULL,
	`role` text DEFAULT 'author' NOT NULL,
	`note` text,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signup_codes_code_idx` ON `signup_codes` (`code`);--> statement-breakpoint
CREATE INDEX `signup_codes_blog_idx` ON `signup_codes` (`blog_id`);