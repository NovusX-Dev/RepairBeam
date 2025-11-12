# Repair Beam

## Overview
Repair Beam is a multi-tenant SaaS platform designed to optimize operations for repair businesses. It provides integrated tools for client management, repair tracking via Kanban boards, inventory management, point-of-sale functionalities, and customer support. The platform aims to improve efficiency and streamline workflows for repair businesses.

## Recent Critical Fixes
- **2025-11-12 (Authentication Hydration Fix)**: Fixed critical bug where `hydrateAuthUser` middleware was performing redundant DB fetches and silently failing, causing intermittent 401 errors on all data endpoints (tickets, clients, inventory, suppliers) and forcing users to tenant setup page on fresh loads. Refactored middleware to directly use `req.user` (already populated by Passport's deserializeUser) instead of redundant `storage.getUser()` call. Changed error handling to "fail closed" - returns 401 immediately if auth context missing instead of silently continuing. This eliminated race conditions and ensured consistent `req.authUser` availability across all authenticated routes.
- **2025-11-11 (Authentication Refactoring)**: Completed comprehensive refactoring to support both OIDC and password-based authentication. Created `getAuthenticatedUserId()` helper to handle discriminated union types. Fixed `hydrateAuthUser` middleware to populate `req.authUser` for both auth types. Systematically replaced ~100 occurrences of `req.user.claims.sub` (OIDC-only) with `req.authUser.id` pattern in routes.ts. Employee login flow now works: login → password change modal → main app (no more "Cannot read properties of undefined (reading 'sub')" crashes).
- **2025-11-11 (Frontend Fixes)**: Fixed critical bugs - `apiRequest()` returns Response object requiring `.json()` parsing (affected password change modal in Landing.tsx and temporary password display in Users.tsx). Fixed `useTenant` hook checking non-existent `tenant.name` property (tenant table only has id/domain/settings).
- **2025-11-10 (Session Fix)**: Fixed OIDC authentication loop caused by incomplete session serialization. Updated `SessionUser` interface and passport serialize/deserialize to preserve OIDC token metadata (`expires_at`, `access_token`, `refresh_token`, `claims`) so authenticated sessions persist correctly across requests.
- **2025-11-10 (RLS Fix)**: Fixed SQL syntax error in tenant context middleware. PostgreSQL `SET LOCAL` commands don't support parameterized queries ($1), requiring `sql.raw()` with proper SQL escaping (`'` → `''`) instead.

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
- **Password Management**: Auto-generated memorable Portuguese-based passwords (e.g., "CasaSol123"), bcrypt hashing with 10 salt rounds, force password change on first login.
- **Session Management**: Server-side sessions stored in PostgreSQL with Passport.js for both Local and OIDC strategies.
- **Multi-tenant Security**: User-tenant association with role-based access control and authentication middleware.
- **Security Features**: NO plain-text password storage (returned once in API response only), OIDC user protection in password change endpoint, proper session handling with discriminated union types (OidcAuthenticatedUser | LocalAuthenticatedUser).

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
- **Password-Based Authentication**: Complete hybrid authentication system with email/password login for employees and OIDC for admins. Features auto-generated memorable passwords, force password change on first login, admin password reset capability, and secure one-time temporary password display dialog.
- **Inventory Management**: Workflow-based organization, part-to-ticket tracking, real-time updates, predictive alerts, SKU/barcode system, multi-location support, supplier management, and cost tracking. Includes automatic inventory deduction, item usage confirmation, and price override for service items on tickets.
- **Inventory Analytics**: Comprehensive audit trail, usage history APIs, and a dedicated analytics dashboard with KPIs, advanced filters, and interactive tables.
- **QR Code Tracking System**: Unique QR code generation for inventory units, automated print functionality, multi-method scanning, and secure verification. Integrated with Purchase Orders, Kanban Tickets, and Inventory Analytics.
- **Inventory Category Management**: Device-type-based categorization with backend validation, CRUD operations via a dedicated UI, and integration across purchase orders, inventory pages, and analytics.
- **Kanban Status Transition Validation**: Comprehensive workflow enforcement with defined state machine transition rules for all ticket statuses. Includes backend enforcement, enhanced drag-and-drop UX with visual feedback, and inline status change dropdowns on Kanban cards.

### Security & Production Standards
- **Multi-Tenant Security**: Database-level isolation with Row-Level Security (RLS) policies, session variables for tenant context, and application-level verification on all queries and mutations.
- **Data Validation & Integrity**: Zod schemas for input validation, TypeScript strict mode, and database constraints (foreign keys, NOT NULL).
- **API Security**: Rate limiting, mandatory authentication/authorization, error sanitization, pagination, CSRF protection, and secure headers.
- **Session Security**: HttpOnly, secure, and sameSite cookies, idle timeout, session rotation, and secure PostgreSQL storage.
- **Secrets Management**: Environment variables, Replit Secrets for production keys, secret rotation, and no logging of secrets.
- **Dependency Security**: Vulnerability scanning, automated monitoring (Dependabot/Snyk), regular updates, and license compliance.
- **Audit & Logging**: Logging of security events, audit trails for critical operations, structured logging, and log retention policies.
- **File Upload Security**: File type/size validation, virus scanning (if applicable), secure storage, and content sanitization.
- **Backup & Recovery**: Automated PostgreSQL backups with encryption, recovery testing, point-in-time recovery, and disaster recovery planning.
- **Incident Response**: Defined procedures for detection, containment, recovery, breach notification, monitoring, and forensics.
- **Testing Standards**: Security, tenant isolation, and integration tests, with regression prevention.
- **Performance & Scalability**: Pagination, query optimization, N+1 prevention, caching, and connection pooling.

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting.
- **Drizzle Kit**: Database migrations and schema management.
- **connect-pg-simple**: PostgreSQL session store.
- **PostgreSQL 16**: Database system.

### Authentication
- **Replit OIDC**: OpenID Connect provider for admin/owner authentication.
- **Passport.js**: Authentication middleware supporting both Local (password) and OIDC strategies.
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