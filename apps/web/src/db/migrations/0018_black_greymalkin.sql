CREATE TABLE `interview_events` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`interview_id` text NOT NULL,
	`kind` text NOT NULL,
	`ts` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `interview_events_blog_iv_ts_idx` ON `interview_events` (`blog_id`,`interview_id`,`ts`);--> statement-breakpoint
CREATE INDEX `interview_events_blog_iv_kind_ts_idx` ON `interview_events` (`blog_id`,`interview_id`,`kind`,`ts`);