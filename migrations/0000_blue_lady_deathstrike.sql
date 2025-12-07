CREATE TABLE "accounts_payable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"supplier_id" varchar,
	"purchase_order_id" varchar,
	"description" varchar NOT NULL,
	"category" varchar,
	"original_amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"balance_due" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"payment_method" varchar,
	"reference_number" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_receivable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"pos_invoice_id" varchar,
	"ticket_id" varchar,
	"description" varchar NOT NULL,
	"original_amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"balance_due" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"payment_terms_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"icon" varchar NOT NULL,
	"category" varchar NOT NULL,
	"required_value" integer NOT NULL,
	"experience_reward" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "achievements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"action" varchar NOT NULL,
	"resource" varchar NOT NULL,
	"resource_id" varchar,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "authorization_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"client_phone" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"whatsapp_message_id" varchar,
	"ticket_summary_format" varchar DEFAULT 'message' NOT NULL,
	"sent_at" timestamp,
	"responded_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auto_gen_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"list_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"brand" varchar,
	"items" text[] NOT NULL,
	"excluded_brands" text[] DEFAULT '{}',
	"last_generated" timestamp DEFAULT now(),
	"next_update" timestamp NOT NULL,
	"refresh_interval" varchar DEFAULT 'quarterly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"device_type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"cpf" varchar,
	"email" varchar,
	"phone" varchar,
	"street_address" varchar,
	"street_number" varchar,
	"apartment" varchar,
	"birthday" varchar,
	"notes" text,
	"status" varchar DEFAULT 'active',
	"preferred_language" varchar DEFAULT 'en',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"marketing_opt_in" boolean DEFAULT false,
	"last_visit_at" timestamp,
	"total_spend_cents" integer DEFAULT 0,
	"ticket_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "completion_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"device_type" varchar NOT NULL,
	"estimated_hours" integer,
	"actual_hours" integer NOT NULL,
	"hours_variance" integer NOT NULL,
	"hours_variance_percentage" numeric(5, 2),
	"estimated_cost" numeric(10, 2),
	"final_actual_cost" numeric(10, 2) NOT NULL,
	"cost_variance" numeric(10, 2) NOT NULL,
	"cost_variance_percentage" numeric(5, 2),
	"accuracy_score" numeric(5, 2),
	"completed_by" varchar NOT NULL,
	"selected_services" jsonb DEFAULT '[]',
	"service_complexity" varchar DEFAULT 'medium',
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_checklist_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"device_type" varchar NOT NULL,
	"components" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_colors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"device_type" varchar NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"colors" text[] NOT NULL,
	"source" varchar DEFAULT 'manual' NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "filter_presets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"page_type" varchar NOT NULL,
	"filter_config" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_system_group" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_group_name_per_tenant" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"device_type" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"supplier_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"sku" varchar,
	"category" varchar,
	"device_type" varchar,
	"brand" varchar,
	"model" varchar,
	"item_type" varchar,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 2),
	"price" numeric(10, 2),
	"supplier" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_sku_per_tenant" UNIQUE("tenant_id","sku"),
	CONSTRAINT "quantity_non_negative" CHECK ("inventory_items"."quantity" >= 0),
	CONSTRAINT "min_quantity_non_negative" CHECK ("inventory_items"."min_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"inventory_item_id" varchar NOT NULL,
	"supplier_id" varchar,
	"purchase_order_item_id" varchar,
	"unique_tag" varchar NOT NULL,
	"status" varchar DEFAULT 'in_stock' NOT NULL,
	"device_type" varchar,
	"item_type" varchar DEFAULT 'Service' NOT NULL,
	"description" text,
	"received_at" timestamp DEFAULT now(),
	"used_at" timestamp,
	"ticket_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_tag_per_tenant" UNIQUE("tenant_id","unique_tag")
);
--> statement-breakpoint
CREATE TABLE "inventory_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"inventory_item_id" varchar NOT NULL,
	"inventory_unit_id" varchar,
	"ticket_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"usage_type" varchar DEFAULT 'repair' NOT NULL,
	"cost" numeric(10, 2),
	"occurred_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"invoice_number" varchar NOT NULL,
	"type" varchar NOT NULL,
	"issued_date" timestamp DEFAULT now() NOT NULL,
	"issued_by" varchar NOT NULL,
	"subtotal" numeric(10, 2),
	"tax_amount" numeric(10, 2),
	"total_amount" numeric(10, 2),
	"status" varchar DEFAULT 'issued' NOT NULL,
	"pdf_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_invoice_number_per_tenant" UNIQUE("tenant_id","invoice_number")
);
--> statement-breakpoint
CREATE TABLE "issue_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"device_type" varchar NOT NULL,
	"question_order" integer NOT NULL,
	"question_key" varchar NOT NULL,
	"question_type" varchar DEFAULT 'boolean' NOT NULL,
	"is_conditional" boolean DEFAULT false NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"options" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "issue_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "localizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"language" varchar NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"provider_config" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"allow_installments" boolean DEFAULT false NOT NULL,
	"max_installments" integer DEFAULT 12,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"days_until_due" integer DEFAULT 30 NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payment_term_name_per_tenant" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"payment_number" varchar NOT NULL,
	"pos_invoice_id" varchar,
	"ticket_id" varchar,
	"client_id" varchar,
	"payment_method_id" varchar,
	"payment_method_type" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"gateway_provider" varchar,
	"gateway_transaction_id" varchar,
	"gateway_response" jsonb DEFAULT '{}'::jsonb,
	"installments" integer DEFAULT 1,
	"installment_amount" numeric(10, 2),
	"pix_qr_code" text,
	"pix_qr_code_url" varchar,
	"pix_expires_at" timestamp,
	"processed_at" timestamp,
	"processed_by" varchar,
	"failure_reason" text,
	"refunded_at" timestamp,
	"refund_amount" numeric(10, 2),
	"refund_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payment_number_per_tenant" UNIQUE("tenant_id","payment_number")
);
--> statement-breakpoint
CREATE TABLE "pos_invoice_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"description" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"total_price" numeric(10, 2) NOT NULL,
	"inventory_item_id" varchar,
	"repair_service_id" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pos_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invoice_number" varchar NOT NULL,
	"client_id" varchar,
	"ticket_id" varchar,
	"quote_id" varchar,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"discount_percentage" numeric(5, 2) DEFAULT '0.00',
	"tax_amount" numeric(10, 2) DEFAULT '0.00',
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"balance_due" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"payment_terms_id" varchar,
	"due_date" timestamp,
	"issued_date" timestamp,
	"issued_by" varchar,
	"paid_date" timestamp,
	"notes" text,
	"internal_notes" text,
	"pdf_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_pos_invoice_number_per_tenant" UNIQUE("tenant_id","invoice_number")
);
--> statement-breakpoint
CREATE TABLE "possible_defects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"device_type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar NOT NULL,
	"item_name" varchar,
	"inventory_item_id" varchar,
	"ordered_quantity" integer NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"device_type" varchar,
	"brand" varchar,
	"model" varchar,
	"item_type" varchar DEFAULT 'Service' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"supplier_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"order_date" timestamp DEFAULT now(),
	"expected_date" timestamp,
	"received_date" timestamp,
	"total_cost" numeric(10, 2) DEFAULT '0.00',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar NOT NULL,
	"description" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"total_price" numeric(10, 2) NOT NULL,
	"inventory_item_id" varchar,
	"repair_service_id" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"quote_number" varchar NOT NULL,
	"client_id" varchar,
	"ticket_id" varchar,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"title" varchar,
	"description" text,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"discount_percentage" numeric(5, 2) DEFAULT '0.00',
	"tax_amount" numeric(10, 2) DEFAULT '0.00',
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"valid_until" timestamp,
	"notes" text,
	"terms_and_conditions" text,
	"issued_date" timestamp,
	"issued_by" varchar,
	"accepted_date" timestamp,
	"converted_to_invoice_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_quote_number_per_tenant" UNIQUE("tenant_id","quote_number")
);
--> statement-breakpoint
CREATE TABLE "repair_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"device_type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"estimated_labor_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"estimated_completion_time_hours" integer DEFAULT 0 NOT NULL,
	"estimated_completion_time_minutes" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"device_meta" jsonb,
	"metadata" jsonb,
	"occurred_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar,
	"client_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"token" varchar NOT NULL,
	"sms_message_sid" varchar,
	"client_phone" varchar NOT NULL,
	"signature_png" text,
	"signer_device_meta" jsonb,
	"expires_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"signed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "signature_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"shop_name" varchar,
	"shop_alias" varchar,
	"shop_description" text,
	"shop_logo_url" varchar,
	"address" text,
	"business_hours" jsonb DEFAULT '{"monday":{"open":"09:00","close":"18:00","closed":false},"tuesday":{"open":"09:00","close":"18:00","closed":false},"wednesday":{"open":"09:00","close":"18:00","closed":false},"thursday":{"open":"09:00","close":"18:00","closed":false},"friday":{"open":"09:00","close":"18:00","closed":false},"saturday":{"open":"10:00","close":"16:00","closed":false},"sunday":{"open":"","close":"","closed":true}}',
	"preferred_language" varchar DEFAULT 'en',
	"invoice_prefix" varchar DEFAULT 'INV',
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"invoice_footer_text" text,
	"warranty_terms_text" text,
	"default_country_code" varchar DEFAULT '+55',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"address" text,
	"phone" varchar,
	"cellphone" varchar,
	"email" varchar,
	"cnpj" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"description" text NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "ticket_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"inventory_item_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"inventory_unit_ids" jsonb DEFAULT '[]',
	"confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'backlog' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar,
	"estimated_cost" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"device_type" varchar,
	"device_brand" varchar,
	"device_model" varchar,
	"device_color" varchar,
	"device_memory" varchar,
	"device_storage_capacity" varchar,
	"issue_description" text,
	"client_deadline" timestamp,
	"technician_estimated_hours" integer,
	"selected_services" jsonb DEFAULT '[]',
	"selected_items" jsonb DEFAULT '[]',
	"warranty_type" varchar DEFAULT 'standard',
	"cost_estimation" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"cost_explanation" text,
	"service_checklist" jsonb,
	"completed_at" timestamp,
	"completed_by" varchar,
	"final_actual_cost" numeric(10, 2),
	"completion_notes" text,
	"actual_hours" integer,
	"dropoff_signature_id" varchar,
	"pickup_signature_id" varchar,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"client_id" varchar,
	"ticket_id" varchar,
	"total" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_method" varchar NOT NULL,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"achievement_id" varchar NOT NULL,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"entity_type" varchar,
	"entity_id" varchar,
	"experience_gained" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"group_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_group" UNIQUE("user_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"phone" varchar,
	"telegram" varchar,
	"invited_by_user_id" varchar NOT NULL,
	"group_ids" jsonb DEFAULT '[]' NOT NULL,
	"token" varchar NOT NULL,
	"temporary_password" varchar,
	"expires_at" timestamp NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"total_actions" integer DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_active_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"tenant_id" varchar NOT NULL,
	"role" varchar DEFAULT 'user' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"password_hash" varchar,
	"must_change_password" boolean DEFAULT false,
	"phone" varchar,
	"telegram" varchar,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "warranty_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"device_type" varchar NOT NULL,
	"tier_type" varchar NOT NULL,
	"duration_months" integer NOT NULL,
	"price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_pos_invoice_id_pos_invoices_id_fk" FOREIGN KEY ("pos_invoice_id") REFERENCES "public"."pos_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_payment_terms_id_payment_terms_id_fk" FOREIGN KEY ("payment_terms_id") REFERENCES "public"."payment_terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_pos_invoice_id_pos_invoices_id_fk" FOREIGN KEY ("pos_invoice_id") REFERENCES "public"."pos_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoice_items" ADD CONSTRAINT "pos_invoice_items_invoice_id_pos_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."pos_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoice_items" ADD CONSTRAINT "pos_invoice_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoice_items" ADD CONSTRAINT "pos_invoice_items_repair_service_id_repair_services_id_fk" FOREIGN KEY ("repair_service_id") REFERENCES "public"."repair_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_payment_terms_id_payment_terms_id_fk" FOREIGN KEY ("payment_terms_id") REFERENCES "public"."payment_terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_repair_service_id_repair_services_id_fk" FOREIGN KEY ("repair_service_id") REFERENCES "public"."repair_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ap_tenant" ON "accounts_payable" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ap_supplier" ON "accounts_payable" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_ap_status" ON "accounts_payable" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ap_due_date" ON "accounts_payable" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_ap_category" ON "accounts_payable" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_ar_tenant" ON "accounts_receivable" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ar_client" ON "accounts_receivable" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ar_status" ON "accounts_receivable" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ar_due_date" ON "accounts_receivable" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_tenant" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_auto_gen_list_type" ON "auto_gen_lists" USING btree ("list_type");--> statement-breakpoint
CREATE INDEX "idx_auto_gen_category" ON "auto_gen_lists" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_auto_gen_brand" ON "auto_gen_lists" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "idx_auto_gen_lists_tenant_id" ON "auto_gen_lists" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_completion_analytics_tenant" ON "completion_analytics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_completion_analytics_ticket" ON "completion_analytics" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_completion_analytics_device_type" ON "completion_analytics" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "idx_completion_analytics_completed_by" ON "completion_analytics" USING btree ("completed_by");--> statement-breakpoint
CREATE INDEX "idx_completion_analytics_completed_at" ON "completion_analytics" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "idx_completion_analytics_accuracy" ON "completion_analytics" USING btree ("accuracy_score");--> statement-breakpoint
CREATE INDEX "idx_device_checklist_type" ON "device_checklist_templates" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "idx_device_checklist_templates_tenant_id" ON "device_checklist_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_device_colors_lookup" ON "device_colors" USING btree ("device_type","brand","model");--> statement-breakpoint
CREATE INDEX "idx_device_colors_brand" ON "device_colors" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "idx_device_colors_tenant_id" ON "device_colors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_filter_presets_user" ON "filter_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_filter_presets_page" ON "filter_presets" USING btree ("page_type");--> statement-breakpoint
CREATE INDEX "idx_filter_presets_tenant" ON "filter_presets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_groups_tenant" ON "groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_ticket" ON "invoices" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_tenant" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_issue_questions_device_type" ON "issue_questions" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "idx_issue_questions_order" ON "issue_questions" USING btree ("question_order");--> statement-breakpoint
CREATE INDEX "idx_issue_questions_tenant_id" ON "issue_questions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_issue_responses_ticket" ON "issue_responses" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_issue_responses_question" ON "issue_responses" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_localization_key_language" ON "localizations" USING btree ("key","language");--> statement-breakpoint
CREATE INDEX "idx_payment_methods_tenant" ON "payment_methods" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payment_methods_type" ON "payment_methods" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_payment_terms_tenant" ON "payment_terms" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payments_tenant" ON "payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "payments" USING btree ("pos_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payments_ticket" ON "payments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_payments_client" ON "payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_gateway_tx" ON "payments" USING btree ("gateway_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_pos_invoice_items_invoice" ON "pos_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_pos_invoices_tenant" ON "pos_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_pos_invoices_client" ON "pos_invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_pos_invoices_status" ON "pos_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pos_invoices_due_date" ON "pos_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_quote_items_quote" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_tenant" ON "quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_client" ON "quotes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_status" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotes_ticket" ON "quotes" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_signature_audit_events_request" ON "signature_audit_events" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "idx_signature_audit_events_tenant" ON "signature_audit_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_signature_audit_events_occurred" ON "signature_audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_token" ON "signature_requests" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_ticket" ON "signature_requests" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_tenant" ON "signature_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_achievements_user" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_achievements_tenant" ON "user_achievements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_activities_user" ON "user_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_activities_type" ON "user_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_user_activities_date" ON "user_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_user_groups_user" ON "user_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_groups_group" ON "user_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_user_groups_tenant" ON "user_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_invitations_token" ON "user_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_user_invitations_tenant" ON "user_invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_invitations_email" ON "user_invitations" USING btree ("email");