CREATE TABLE `app_settings` (
	`key` varchar(100) NOT NULL,
	`value` text,
	`category` varchar(50) DEFAULT 'general',
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`liquid_customer_id` varchar(100),
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`company` varchar(255),
	`address` text,
	`city` varchar(100),
	`state` varchar(100),
	`country` char(2) NOT NULL,
	`zipcode` varchar(20),
	`phone_cc` varchar(10),
	`phone` varchar(30),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_liquid_customer_id_unique` UNIQUE(`liquid_customer_id`)
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`customer_id` int,
	`domain_name` varchar(255) NOT NULL,
	`tld` varchar(20) NOT NULL,
	`registration_date` date,
	`expiry_date` date,
	`years` tinyint DEFAULT 1,
	`status` enum('active','pending','expired','suspended','transferred') DEFAULT 'pending',
	`auto_renew` tinyint DEFAULT 0,
	`locked` tinyint DEFAULT 0,
	`theft_protection` tinyint DEFAULT 0,
	`privacy_protection` tinyint DEFAULT 0,
	`liquid_order_id` varchar(100),
	`nameservers` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `domains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`customer_id` int,
	`domain_id` int,
	`type` enum('register','renew','transfer','restore','privacy','fund','debit') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'IDR',
	`status` enum('pending_payment','processing_domain','completed','failed','cancelled','expired','action_required') DEFAULT 'pending_payment',
	`payment_gateway` varchar(50) DEFAULT 'sumopod',
	`payment_id` varchar(100),
	`payment_link_url` text,
	`payment_status` enum('pending','completed','failed','expired') DEFAULT 'pending',
	`metadata` text,
	`liquid_transaction_id` varchar(100),
	`description` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`role` enum('reseller','customer') DEFAULT 'reseller',
	`reseller_id` varchar(100),
	`api_key` varchar(255),
	`parent_reseller_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `domains` ADD CONSTRAINT `domains_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `domains` ADD CONSTRAINT `domains_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_domain_id_domains_id_fk` FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON DELETE set null ON UPDATE no action;