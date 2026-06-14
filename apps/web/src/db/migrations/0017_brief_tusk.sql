CREATE TABLE `interview_session_locks` (
	`interview_id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`heartbeat_id` text NOT NULL,
	`last_beat_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `interview_session_locks_blog_idx` ON `interview_session_locks` (`blog_id`);--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`status` text DEFAULT 'consent' NOT NULL,
	`started_by_uid` text,
	`started_by_role` text,
	`share_link_id` text,
	`guest_email` text,
	`guest_name` text,
	`topic` text,
	`goal` text,
	`style` text DEFAULT 'smart' NOT NULL,
	`recording_config` text DEFAULT 'transcript' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`mode` text DEFAULT 'live' NOT NULL,
	`max_duration_sec` integer DEFAULT 300 NOT NULL,
	`canvas_snapshot` text,
	`canvas_snapshot_at` integer,
	`article_id` text,
	`published_direct` integer,
	`requires_review` integer,
	`ended_at` integer,
	`started_at` integer,
	`responses_count` integer DEFAULT 0 NOT NULL,
	`video_provider` text,
	`tavus_conversation_id` text,
	`cost_usd` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `interviews_blog_idx` ON `interviews` (`blog_id`);--> statement-breakpoint
CREATE INDEX `interviews_blog_uid_idx` ON `interviews` (`blog_id`,`started_by_uid`);--> statement-breakpoint
CREATE INDEX `interviews_blog_status_idx` ON `interviews` (`blog_id`,`status`);--> statement-breakpoint
CREATE INDEX `interviews_blog_share_link_idx` ON `interviews` (`blog_id`,`share_link_id`);--> statement-breakpoint
CREATE INDEX `interviews_blog_created_idx` ON `interviews` (`blog_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`type` text NOT NULL,
	`created_by` text NOT NULL,
	`workspace_id` text DEFAULT 'default' NOT NULL,
	`topic` text,
	`goal` text,
	`style` text DEFAULT 'smart' NOT NULL,
	`auth_mode` text DEFAULT 'anonymous' NOT NULL,
	`recording_config` text DEFAULT 'transcript' NOT NULL,
	`max_duration_sec` integer DEFAULT 300 NOT NULL,
	`expires_at` text,
	`max_uses` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`token_hash` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`scheduled_at` text,
	`scheduled_guest_email` text,
	`mode` text DEFAULT 'live' NOT NULL,
	`async_questions` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `share_links_blog_idx` ON `share_links` (`blog_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_hash_idx` ON `share_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `share_links_blog_created_by_idx` ON `share_links` (`blog_id`,`created_by`);--> statement-breakpoint
CREATE INDEX `share_links_blog_status_idx` ON `share_links` (`blog_id`,`status`);