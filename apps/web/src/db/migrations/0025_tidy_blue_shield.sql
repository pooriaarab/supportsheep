ALTER TABLE `interviews` ADD `video_storage_path` text;--> statement-breakpoint
CREATE INDEX `interviews_tavus_conversation_idx` ON `interviews` (`tavus_conversation_id`);