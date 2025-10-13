# Repair Beam

## Overview

Repair Beam is a multi-tenant SaaS platform designed for repair businesses. It provides tools for client management, repair tracking via Kanban boards, inventory management, point-of-sale operations, and customer support. The platform is built with a React frontend, Express.js backend, and PostgreSQL database, utilizing Drizzle ORM. Its purpose is to streamline operations and enhance efficiency for repair businesses.

## Recent Changes

### September 30, 2025
- **Device History & Warranty Coverage System**: Implemented comprehensive device history tracking for returning clients with automatic warranty coverage pricing:
  - Client search now displays previous tickets with device information and "Use This Device" functionality
  - Visual indicators (badges) show previously performed services, found defects, and warranty tier status
  - Warranty coverage logic automatically matches defect+service combinations from previous tickets with active warranties
  - Cost calculations throughout the system now exclude warranty-covered services, displaying $0 for covered items
  - Warranty expiration checking ensures only active warranties provide coverage
  - Full integration with Step 4 (Price Estimation) showing warranty badges and cost exclusions

### September 06, 2025
- **Warranty System Removal**: Completely removed warranty functionality from the Kanban ticketing system to prepare for repair services integration. This includes removal of warranty coverage selection, warranty cost calculations, and warranty displays from ticket summaries.
- **Repair Services Configuration**: Enhanced repair services management with pagination (10 per page), real-time search/filtering, collapsible device type sections (default collapsed), and lazy loading with intersection observer for improved performance.
- **Timeline Section Rename**: Updated "Service Timeline & Coverage" to "Services and Timeline" with full localization support in both English and Portuguese.

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

### Inventory Management Best Practices

#### Core Principles for Repair Shop Inventory
- **Workflow-Based Organization**: Arrange parts by device type, brand, or usage frequency to match repair flow
- **Part-to-Ticket Tracking**: Every inventory item used must be tied to a specific repair ticket for accurate costing, warranties, and analytics
- **Real-Time Updates**: Inventory levels update automatically as parts are used in repairs, eliminating manual tracking
- **Predictive Alerts**: Low-stock notifications and reorder points based on historical usage patterns
- **SKU/Barcode System**: Implement from day one for instant updates and error reduction

#### Dashboard Design Patterns
**Visual Hierarchy:**
- **KPI Row** (top): Total inventory value, items in stock, low stock alerts, turnover ratio
- **Critical Alerts Section**: Items running out in <31 days with prominent visual indicators
- **Analytics Charts**: Stock levels over time (line chart), inventory by location (bar chart), category distribution (donut chart)
- **Activity Table**: Recent transactions/updates for quick reference

**Color-Coding Standards:**
- Green: Healthy stock levels (>31 days supply)
- Orange/Yellow: Low stock warning (8-31 days supply)
- Red: Critical/Out of stock (<8 days supply)
- Use consistent Aurora theme gradients for cards and headers

**UI Components:**
- Card-based responsive layout following Aurora design pattern
- Searchable/filterable tables with sort capability
- Quick action buttons (Add Stock, Reorder, Transfer, Use in Ticket)
- Real-time sync indicators
- Export functionality (CSV/Excel for reports)
- Progressive disclosure for detailed part information

#### Essential Metrics to Track
- **Stock Metrics**: On-hand quantities by SKU, physical vs. allocated stock, days until run-out projections
- **Financial Metrics**: Total inventory value, cost per repair, margin analysis, excess stock value
- **Operational Metrics**: Inventory turnover rate, stock-out frequency, parts usage by device type, reorder accuracy
- **Predictive Analytics**: Demand forecasting based on historical repair patterns, seasonal adjustments

#### Integration Architecture
- **Ticket System Integration**: Seamless part selection during repair ticket creation; automatic inventory deduction when parts are used
- **Multi-Location Support**: Track inventory across multiple warehouses or repair locations with transfer capabilities
- **Supplier Management**: Track suppliers, lead times, and purchase orders for automated reordering
- **Cost Tracking**: Link part costs to repair tickets for accurate profit/loss analysis per repair

#### Mobile-First Considerations
- Barcode/QR scanning from mobile devices for receiving and using parts
- Touch-friendly interfaces for technicians in repair area
- Offline mode capability for warehouse operations
- Push notifications for critical alerts
- Responsive card layouts that stack on mobile

#### Implementation Phases
**Phase 1 - Core Functionality:**
- Real-time inventory dashboard with essential KPIs
- Part-to-ticket tracking (critical for repair cost accuracy)
- CRUD operations with search/filter
- Low stock alerts and basic reporting

**Phase 2 - Enhanced Features:**
- Barcode/QR scanning integration
- Multi-location inventory management
- Usage analytics and demand forecasting
- Supplier management and purchase orders

**Phase 3 - Advanced:**
- Automated reordering based on predictive analytics
- Advanced cost tracking and margin analysis
- Mobile app for warehouse operations
- Integration with accounting systems

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