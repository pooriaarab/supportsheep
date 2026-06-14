CREATE TABLE `function_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`function_name` text NOT NULL,
	`status` text NOT NULL,
	`executed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `function_logs_blog_fn_executed_idx` ON `function_logs` (`blog_id`,`function_name`,`executed_at`);--> statement-breakpoint
CREATE TABLE `tool_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`interview_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`call_id` text,
	`args_summary` text NOT NULL,
	`status` text NOT NULL,
	`error_kind` text,
	`duration_ms` integer NOT NULL,
	`cost_usd` integer,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tool_executions_blog_iv_ts_idx` ON `tool_executions` (`blog_id`,`interview_id`,`timestamp`);