CREATE TABLE `daily_export_counter` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateKey` varchar(8) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_export_counter_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_export_counter_dateKey_unique` UNIQUE(`dateKey`)
);
