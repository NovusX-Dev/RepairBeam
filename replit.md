# Repair Beam

## Overview

Repair Beam is a comprehensive SaaS platform designed to streamline operations for repair businesses. Built as a multi-tenant system, it provides tools for managing clients, tracking repairs through Kanban boards, inventory management, point-of-sale operations, and customer support. The platform follows modern web architecture with a React frontend, Express.js backend, and PostgreSQL database using Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

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