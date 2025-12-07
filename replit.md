# Repair Beam

## Overview
Repair Beam is a multi-tenant SaaS platform designed to optimize operations for repair businesses. It provides integrated tools for client management, repair tracking via Kanban boards, inventory management, point-of-sale functionalities, and customer support. The platform aims to improve efficiency and streamline workflows, offering significant market potential by consolidating essential business functions into a single, comprehensive solution.

## User Preferences
Preferred communication style: Simple, everyday language.

### Work Methodology Requirements
- **Methodological Approach**: Always follow systematic, step-by-step processes when working on tasks
- **Research & Documentation**: Research documentation whenever necessary and add findings to memory for future optimization
- **Comprehensive Debugging**: During debugging, check ALL places that could cause the issue, not just obvious ones
- **Consistency Validation**: Always check for inconsistencies with work and fixes across the entire codebase
- **Double-Check Protocol**: Always verify work thoroughly before considering tasks complete
- **Localization Requirements**: Always add localizations and translations when necessary, ensuring support for only the configured languages (currently: en, pt-BR)
- **Database Query Integrity**: Always ensure that lookups and queries are properly structured and do not break existing lookups
- **Naming Convention Consistency**: Adhere to the same naming convention throughout the codebase, never mix different naming patterns
- **Permission Template Updates**: When adding new sections or features with permissions, ALWAYS update the existing user permission group templates in the database (Administrator, Manager, Technician, Receptionist, Viewer) to include the new permissions. This prevents users from losing access to new features due to missing permissions in their groups.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **UI Library**: Radix UI components with shadcn/ui styling.
- **Styling**: Tailwind CSS, custom dark navy blue and neon blue color scheme.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query for server state; React hooks for local state.
- **Design System**: Components built on Radix UI primitives with consistent theming.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **Database ORM**: Drizzle ORM for type-safe operations.
- **Session Management**: Express sessions with PostgreSQL storage.
- **Development**: Hot reload with Vite integration for full-stack development.

### Database
- **Type**: PostgreSQL hosted on Neon.
- **ORM**: Drizzle ORM with a schema-first approach.
- **Multi-tenancy**: Tenant isolation via `tenantId` foreign keys and Row-Level Security (RLS).
- **Core Entities**: Users, Tenants, Clients, Tickets, Inventory Items, Transactions, Support Tickets.
- **Configuration Storage**: JSONB columns for flexible settings in `store_settings` table.

### Authentication & Authorization
- **Hybrid Authentication System**: Dual authentication supporting both password-based login (for regular users/employees) and Replit OIDC (for admins/owners).
- **Password Management**: Auto-generated memorable Portuguese-based passwords, bcrypt hashing, force password change on first login.
- **Session Management**: Server-side sessions stored in PostgreSQL with Passport.js for both Local and OIDC strategies.
- **Multi-tenant Security**: User-tenant association with role-based access control and authentication middleware.

### Application Structure
- **Monorepo Layout**: Organized client, server, and shared code directories.
- **Shared Schema**: Common TypeScript types and Drizzle schema definitions.
- **API Design**: RESTful endpoints with Express route handlers.
- **Error Handling**: Centralized error middleware.

### UI/UX Design Principles
- **"Aurora Card Layout" Pattern**: Card-based structure with gradient headers, consistent spacing, and a dark navy blue to neon blue gradient. Applied to dialogs, forms, and content areas.
- **Configuration Sections**: Emphasize visual hierarchy, clear grouping, consistent control components, brief labeling, real-time feedback, and responsive design.

### Naming Convention Standards
- **TypeScript Variables/Properties**: `camelCase`
- **CSS Classes/File Names**: `kebab-case`
- **React Components/Types**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Database Fields**: `camelCase` in TypeScript schema, `snake_case` in SQL
- **API Endpoints**: `kebab-case` paths
- **Function Names**: `camelCase`
- **Event Handlers**: `camelCase` with `handle` prefix
- **Critical Rule**: Maintain consistent naming within the same context; database schema and API responses use `camelCase` for TypeScript/frontend consistency.

### Key Features and Implementations
- **Password-Based Authentication**: Hybrid system with email/password login for employees and OIDC for admins, including auto-generated passwords and force password change.
- **Client Management (CRM)**: Full-featured client database with KPI dashboard, searchable/filterable list, client profile sheets, and comprehensive add/edit functionalities.
- **Inventory Management**: Workflow-based organization, part-to-ticket tracking, real-time updates, SKU/barcode system, multi-location support, and supplier management. Includes automatic inventory deduction and price override.
- **Inventory Analytics**: Comprehensive audit trail, usage history APIs, and a dedicated analytics dashboard with KPIs.
- **QR Code Tracking System**: Unique QR code generation for inventory units, automated print functionality, multi-method scanning, and secure verification, integrated with Purchase Orders, Kanban Tickets, and Inventory Analytics.
- **Inventory Category Management**: Device-type-based categorization with backend validation and CRUD operations.
- **Kanban Status Transition Validation**: Comprehensive workflow enforcement with defined state machine transition rules for ticket statuses, including backend enforcement and enhanced drag-and-drop UX.

### Security & Production Standards
- **Multi-Tenant Security**: Database-level isolation with Row-Level Security (RLS) policies and application-level verification.
- **Data Validation & Integrity**: Zod schemas for input validation and database constraints.
- **API Security**: Rate limiting, mandatory authentication/authorization, error sanitization, pagination, CSRF protection, and secure headers.
- **Session Security**: HttpOnly, secure, and sameSite cookies, idle timeout, session rotation, and secure PostgreSQL storage.
- **Secrets Management**: Environment variables, Replit Secrets for production keys.
- **Dependency Security**: Vulnerability scanning and automated monitoring.
- **Audit & Logging**: Logging of security events and audit trails for critical operations.
- **Testing Standards**: Security, tenant isolation, and integration tests.
- **Performance & Scalability**: Pagination, query optimization, N+1 prevention, caching, and connection pooling.

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting.
- **Drizzle Kit**: Database migrations and schema management.
- **connect-pg-simple**: PostgreSQL session store.
- **PostgreSQL 16**: Database system.

### Authentication
- **Replit OIDC**: OpenID Connect provider for admin/owner authentication.
- **Passport.js**: Authentication middleware supporting Local and OIDC strategies.
- **openid-client**: OIDC client implementation.
- **bcryptjs**: Password hashing and validation.

### UI & Styling
- **Radix UI**: Component primitives library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **Google Fonts**: Inter typography.

### Development Tools
- **Vite**: Build tool and development server.
- **TypeScript**: Language.
- **PostCSS**: CSS processing.
- **ESBuild**: JavaScript bundling.

### State Management
- **TanStack Query**: Server state management.
- **React Hook Form**: Form state management.
- **Zod**: Runtime type validation.