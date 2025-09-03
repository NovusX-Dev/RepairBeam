# Repair Beam

## Overview

Repair Beam is a multi-tenant SaaS platform designed for repair businesses. It provides tools for client management, repair tracking via Kanban boards, inventory management, point-of-sale operations, and customer support. The platform is built with a React frontend, Express.js backend, and PostgreSQL database, utilizing Drizzle ORM. Its purpose is to streamline operations and enhance efficiency for repair businesses.

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

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **UI Library**: Radix UI components with shadcn/ui styling.
- **Styling**: Tailwind CSS with a custom dark navy blue and neon blue color scheme.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query for server state; React hooks for local state.
- **Design System**: Components built on Radix UI primitives with consistent theming.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **Database ORM**: Drizzle ORM for type-safe operations.
- **Session Management**: Express sessions with PostgreSQL storage.
- **Development**: Hot reload with Vite integration for full-stack development.

### Database Design
- **Database**: PostgreSQL hosted on Neon.
- **ORM**: Drizzle ORM with a schema-first approach.
- **Multi-tenancy**: Tenant isolation via `tenantId` foreign keys and Row-Level Security (RLS).
- **Core Entities**: Users, Tenants, Clients, Tickets, Inventory Items, Transactions, Support Tickets.
- **Session Storage**: Dedicated sessions table.
- **Configuration Storage**: JSONB columns for flexible settings in `store_settings` table.

### Authentication & Authorization
- **Provider**: Replit OIDC authentication.
- **Session Management**: Server-side sessions stored in PostgreSQL.
- **Multi-tenant Security**: User-tenant association with role-based access control and authentication middleware.

### Application Structure
- **Monorepo Layout**: Organized client, server, and shared code directories.
- **Shared Schema**: Common TypeScript types and Drizzle schema definitions.
- **API Design**: RESTful endpoints with Express route handlers.
- **Error Handling**: Centralized error middleware.

### Development Features
- **Type Safety**: End-to-end TypeScript.
- **Hot Reload**: Vite development server integration.
- **Path Aliases**: Organized imports (`@`, `@shared`, `@assets`).
- **Code Quality**: ESLint integration.

### UI/UX Design Principles
- **"Aurora Card Layout" Pattern**: Card-based structure with gradient headers, consistent spacing, and specific color themes (Dark Navy Blue to Neon Blue gradient). Used for dialogs, forms, and content areas.
- **Configuration Sections**: Emphasize visual hierarchy, clear grouping, consistent control components (toggles, dropdowns), brief and meaningful labeling, real-time feedback, and responsive design. Prioritize user experience with good defaults, accessibility, and potential for advanced features like version control.

### Naming Convention Standards
- **TypeScript Variables/Properties**: camelCase
- **CSS Classes/File Names**: kebab-case
- **React Components/Types**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Database Fields**: camelCase in TypeScript schema, snake_case in SQL
- **API Endpoints**: kebab-case paths
- **Function Names**: camelCase
- **Event Handlers**: camelCase with `handle` prefix
- **Critical Rule**: Never mix naming conventions within the same context; database schema and API responses use camelCase for TypeScript/frontend consistency.

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting.
- **Drizzle Kit**: Database migrations and schema management.
- **connect-pg-simple**: PostgreSQL session store.
- **PostgreSQL 16**: Database system.

### Authentication
- **Replit OIDC**: OpenID Connect provider.
- **Passport.js**: Authentication middleware.
- **openid-client**: OIDC client implementation.

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