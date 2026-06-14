ALTER TABLE `blogs` ADD `custom_domain_last_checked_at` integer;--> statement-breakpoint
ALTER TABLE `blogs` ADD `custom_domain_notified_status` text;--> statement-breakpoint
ALTER TABLE `blogs` ADD `custom_domain_failure_reason` text;