CREATE TABLE `blog_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`token` text NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	`accepted_by` text,
	FOREIGN KEY (`blog_id`) REFERENCES `blogs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_invites_token_unique` ON `blog_invites` (`token`);--> statement-breakpoint
CREATE INDEX `blog_invites_blog_idx` ON `blog_invites` (`blog_id`);--> statement-breakpoint
CREATE INDEX `blog_invites_email_idx` ON `blog_invites` (`email`);