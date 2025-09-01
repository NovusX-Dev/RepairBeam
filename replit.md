# Repair Beam

## Overview

Repair Beam is a comprehensive SaaS platform designed to streamline operations for repair businesses. Built as a multi-tenant system, it provides tools for managing clients, tracking repairs through Kanban boards, inventory management, point-of-sale operations, and customer support. The platform follows modern web architecture with a React frontend, Express.js backend, and PostgreSQL database using Drizzle ORM.

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

### Supported Languages
Based on database analysis, the platform supports:
- English (en)
- Portuguese Brazil (pt-BR)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom color scheme (Dark Navy Blue #0A192F, Neon Blue #00FFFF)
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state, React hooks for local state
- **Design System**: Components built on Radix UI primitives with consistent theming

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL storage via connect-pg-simple
- **Development**: Hot reload with Vite integration for full-stack development

### Database Design
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM with schema-first approach
- **Multi-tenancy**: Tenant isolation through tenantId foreign keys across all entities
- **Core Entities**: Users, Tenants, Clients, Tickets, Inventory Items, Transactions, Support Tickets
- **Session Storage**: Dedicated sessions table for authentication state

### Authentication & Authorization
- **Provider**: Replit OIDC authentication integration
- **Session Management**: Server-side sessions with PostgreSQL storage
- **Multi-tenant Security**: User-tenant association with role-based access control
- **Middleware**: Authentication middleware protecting all API routes

### Application Structure
- **Monorepo Layout**: Client, server, and shared code in organized directories
- **Shared Schema**: Common TypeScript types and Drizzle schema definitions
- **API Design**: RESTful endpoints with Express route handlers
- **Error Handling**: Centralized error middleware with structured responses

### Development Features
- **Type Safety**: End-to-end TypeScript with strict configuration
- **Hot Reload**: Vite development server with Express backend integration
- **Path Aliases**: Organized imports with @, @shared, and @assets aliases
- **Code Quality**: ESLint integration and consistent file structure

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle Kit**: Database migrations and schema management
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Authentication
- **Replit OIDC**: OpenID Connect authentication provider
- **Passport.js**: Authentication middleware strategy
- **openid-client**: OIDC client implementation

### UI & Styling
- **Radix UI**: Comprehensive component primitives library
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **Google Fonts**: Inter typography with multiple font weights

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type safety and developer experience
- **PostCSS**: CSS processing with Tailwind and Autoprefixer
- **ESBuild**: Fast JavaScript bundling for production

### State Management
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema validation

## Naming Convention Standards

### Established Patterns
- **TypeScript Variables/Properties**: camelCase (e.g., `deviceType`, `listType`, `isActive`)
- **CSS Classes/File Names**: kebab-case (e.g., `device-color`, `search-input`)
- **React Components/Types**: PascalCase (e.g., `DeviceSelector`, `TicketType`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `API_BASE_URL`, `MAX_RETRIES`)
- **Database Fields**: camelCase in TypeScript schema, snake_case in actual SQL
- **API Endpoints**: kebab-case paths (e.g., `/api/device-colors`)
- **Function Names**: camelCase (e.g., `getDeviceColors`, `validateInput`)
- **Event Handlers**: camelCase with handle prefix (e.g., `handleSubmit`, `handleChange`)

### Critical Rules
- Never mix naming conventions within the same context
- Database schema must use camelCase for TypeScript compatibility
- API responses should use camelCase for consistency with frontend
- File names use kebab-case for web compatibility