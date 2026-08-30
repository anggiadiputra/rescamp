CREATE TABLE `webhook_receipts` (
	`id` varchar(255) NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','reseller','customer') DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `api_key_encrypted` text;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` int DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `users`
SET `role` = 'admin', `session_version` = `session_version` + 1
WHERE `id` = (
	SELECT `candidate`.`id`
	FROM (
		SELECT `u`.`id`
		FROM `users` `u`
		WHERE `u`.`role` = 'reseller'
			AND `u`.`parent_reseller_id` IS NULL
		ORDER BY
			CASE WHEN (`u`.`api_key` IS NOT NULL AND `u`.`api_key` <> '')
				OR (`u`.`api_key_encrypted` IS NOT NULL AND `u`.`api_key_encrypted` <> '')
				THEN 1 ELSE 0 END DESC,
			(SELECT COUNT(*) FROM `users` `child` WHERE `child`.`parent_reseller_id` = `u`.`id`) DESC,
			(SELECT COUNT(*) FROM `transactions` `txn` WHERE `txn`.`user_id` = `u`.`id`) DESC,
			(SELECT COUNT(*) FROM `customers` `customer` WHERE `customer`.`user_id` = `u`.`id`) DESC,
			`u`.`id` ASC
		LIMIT 1
	) `candidate`
)
AND NOT EXISTS (
	SELECT 1 FROM (
		SELECT `id` FROM `users` WHERE `role` = 'admin' LIMIT 1
	) `existing_admin`
);