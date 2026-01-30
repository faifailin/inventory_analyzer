CREATE TABLE `analysis_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalFileUrl` text NOT NULL,
	`originalFileName` varchar(255) NOT NULL,
	`resultFileUrl` text,
	`minMonths` decimal(5,2) NOT NULL,
	`maxMonths` decimal(5,2) NOT NULL,
	`matchedItemsCount` int,
	`status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysis_records_id` PRIMARY KEY(`id`)
);
