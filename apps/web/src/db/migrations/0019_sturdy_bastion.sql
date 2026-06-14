CREATE TABLE `async_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`interview_id` text NOT NULL,
	`question_id` text NOT NULL,
	`audio_storage_path` text NOT NULL,
	`transcript` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `async_responses_blog_iv_idx` ON `async_responses` (`blog_id`,`interview_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `async_responses_iv_q_idx` ON `async_responses` (`interview_id`,`question_id`);