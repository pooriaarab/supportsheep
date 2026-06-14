CREATE TABLE `ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_chat_messages_blog_thread_idx` ON `ai_chat_messages` (`blog_id`,`thread_id`);--> statement-breakpoint
CREATE TABLE `ai_chat_settings` (
	`blog_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_chat_threads_blog_user_idx` ON `ai_chat_threads` (`blog_id`,`user_id`);