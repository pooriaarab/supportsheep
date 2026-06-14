CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_bucket_idx` ON `rate_limits` (`bucket`);