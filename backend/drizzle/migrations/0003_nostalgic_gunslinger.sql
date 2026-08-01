DELETE d1 FROM `domains` d1 JOIN `domains` d2 ON d1.`domain_name` = d2.`domain_name` AND d1.`id` > d2.`id`;--> statement-breakpoint
ALTER TABLE `domains` ADD CONSTRAINT `domain_name_unique` UNIQUE(`domain_name`);--> statement-breakpoint
DELETE t1 FROM `transactions` t1 JOIN `transactions` t2 ON t1.`liquid_transaction_id` = t2.`liquid_transaction_id` AND t1.`liquid_transaction_id` IS NOT NULL AND t1.`id` > t2.`id`;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `liquid_transaction_id_unique` UNIQUE(`liquid_transaction_id`);