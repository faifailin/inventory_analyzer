CREATE TABLE `special_product_ids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` varchar(50) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `special_product_ids_id` PRIMARY KEY(`id`),
	CONSTRAINT `special_product_ids_productId_unique` UNIQUE(`productId`)
);
