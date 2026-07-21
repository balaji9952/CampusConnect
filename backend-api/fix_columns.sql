ALTER TABLE [dbo].[complaint_categories] ADD [routing_type] VARCHAR(50) NOT NULL CONSTRAINT [DF_complaint_categories_routing_type] DEFAULT 'DEPARTMENT_ROUTED';
ALTER TABLE [dbo].[complaint_categories] ADD [routing_key] VARCHAR(100) NULL;
