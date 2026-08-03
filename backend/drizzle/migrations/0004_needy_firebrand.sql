ALTER TABLE `transactions` ADD `order_id` varchar(100);--> statement-breakpoint
UPDATE `transactions` SET `order_id` = JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.orderId')) WHERE `order_id` IS NULL;--> statement-breakpoint
CREATE INDEX `order_id_idx` ON `transactions` (`order_id`);--> statement-breakpoint
DELETE c1 FROM `customers` c1 JOIN `customers` c2 ON c1.`email` = c2.`email` AND c1.`id` > c2.`id`;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_email_unique` UNIQUE(`email`);