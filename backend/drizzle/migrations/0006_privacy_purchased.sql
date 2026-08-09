ALTER TABLE `domains` MODIFY COLUMN `status` enum('active','pending','expired','suspended','transferred','cancelled') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `payment_status` enum('pending','completed','failed','expired','cancelled') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `domains` ADD `privacy_purchased` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `domains` ADD `suspend_reason` varchar(500);--> statement-breakpoint
ALTER TABLE `domains` ADD `suspended_at` timestamp;--> statement-breakpoint
ALTER TABLE `otp_codes` ADD `code_encrypted` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `api_key_encrypted` varchar(512);
