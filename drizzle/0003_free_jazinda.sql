ALTER TABLE `locations` ADD `export_site_id` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `export_site_name` text;--> statement-breakpoint
ALTER TABLE `records` ADD `project_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE locations SET parent_id=NULL WHERE kind='project';
--> statement-breakpoint
UPDATE users SET active=0,role='chef' WHERE role NOT IN ('admin','chef');
--> statement-breakpoint
DELETE FROM sessions;
