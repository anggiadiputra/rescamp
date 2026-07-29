CREATE TABLE `otp_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`code` varchar(128) NOT NULL,
	`purpose` enum('login','reset','register') NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `email_idx` ON `otp_codes` (`email`);--> statement-breakpoint
CREATE INDEX `code_idx` ON `otp_codes` (`code`);--> statement-breakpoint
CREATE INDEX `purpose_idx` ON `otp_codes` (`purpose`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `customers` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `domains` (`user_id`);--> statement-breakpoint
CREATE INDEX `customer_id_idx` ON `domains` (`customer_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `domains` (`status`);--> statement-breakpoint
CREATE INDEX `domain_name_idx` ON `domains` (`domain_name`);