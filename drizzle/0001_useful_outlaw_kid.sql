CREATE TABLE `recovery_points` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL,
	`kind` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`actor` text NOT NULL,
	`at` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL
);
