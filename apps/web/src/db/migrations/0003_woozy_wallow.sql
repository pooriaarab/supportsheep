CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text DEFAULT '{}',
	`ip` text,
	`result` text NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
