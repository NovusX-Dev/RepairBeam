# Repair Beam

## Overview
Repair Beam is a multi-tenant SaaS platform designed to streamline operations for repair businesses. It offers comprehensive tools for client management, repair tracking via Kanban boards, inventory management, point-of-sale operations, and customer support. The platform aims to enhance efficiency for repair businesses through its integrated features.

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

### UI/UX Design Principles
- **"Aurora Card Layout" Pattern**: Card-based structure with gradient headers, consistent spacing, and specific color themes (Dark Navy Blue to Neon Blue gradient). Used for dialogs, forms, and content areas.
- **Configuration Sections**: Emphasize visual hierarchy, clear grouping, consistent control components (toggles, dropdowns), brief and meaningful labeling, real-time feedback, and responsive design.

### Naming Convention Standards
- **TypeScript Variables/Properties**: `camelCase`
- **CSS Classes/File Names**: `kebab-case`
- **React Components/Types**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Database Fields**: `camelCase` in TypeScript schema, `snake_case` in SQL
- **API Endpoints**: `kebab-case` paths
- **Function Names**: `camelCase`
- **Event Handlers**: `camelCase` with `handle` prefix
- **Critical Rule**: Never mix naming conventions within the same context; database schema and API responses use `camelCase` for TypeScript/frontend consistency.

### Inventory Management
- **Core Principles**: Workflow-based organization, part-to-ticket tracking, real-time updates, predictive alerts, SKU/barcode system.
- **Dashboard Design**: Visual hierarchy (KPI row, critical alerts, analytics charts, activity table) with color-coding standards (Green: Healthy, Orange/Yellow: Low, Red: Critical).
- **Integration**: Seamless integration with the ticket system for automatic inventory deduction, multi-location support, supplier management, and cost tracking.

### Repair Ticket & Inventory Integration (Phase 3)
- **Service Items on Tickets**: Technicians can add service items (parts/materials) to tickets during price estimation with device-type filtering and "Other" category support.
- **Automatic Inventory Deduction**: Items are automatically deducted from inventory when tickets are created, with unique unit ID tracking for precise inventory management.
- **Item Usage Confirmation**: During ticket finalization (Step 1 of completion wizard), technicians confirm which allocated items were actually used. Unchecked items are automatically returned to inventory.
- **Usage Timestamp Tracking**: When service items are confirmed during finalization, the system records the `usedAt` timestamp and maintains the ticket link, creating a permanent audit trail from purchase through finalization.
- **Price Override**: Service items can have their prices overridden per ticket, allowing flexibility for discounts or special pricing.
- **Cost Calculation**: Ticket total cost includes: service charges + service items subtotal + extra costs, displayed in the price estimation step.
- **Automatic Cleanup**: If a ticket is deleted, all allocated service items are automatically returned to inventory.
- **UI Implementation**: Aurora design pattern with gradient headers, cyan accents, searchable item selection dialog, quantity selectors, and real-time stock display.

### Inventory Analytics (Phase 4)
- **Complete Audit Trail**: Track every inventory unit from purchase order through ticket finalization with timestamps, supplier attribution, and client details.
- **Usage History API**: Two dedicated endpoints for usage tracking:
  - `GET /api/inventory-units/:unitId/history` - Complete history for a single unit with supplier, ticket, and client context
  - `GET /api/inventory/:itemId/usage-stats` - Aggregated usage statistics for an inventory item with full usage timeline
- **Analytics Dashboard**: Full-featured page (`/inventory-analytics`) with:
  - KPI Cards: Total Items Tracked, Total Inventory Value, Low Stock Items
  - Advanced Filters: Search by name/SKU, filter by supplier, filter by category
  - Interactive Item Table: Click "View Usage" to see detailed history
  - Usage Timeline Modal: Complete audit trail showing unit tag → supplier → ticket → client → device → finalization date
- **Tenant Isolation**: All queries enforce tenant boundaries to prevent cross-tenant data leakage
- **Multi-Language Support**: Complete localization for en and pt-BR with 77 translation entries
- **Aurora Design Implementation**: Navy gradients, cyan accents, consistent card styling, and status color coding throughout

### QR Code Tracking System (Phase 5)
- **QR Code Generation**: Inventory units are assigned unique tags encoded into QR codes (2.5cm × 2.5cm) for physical labeling
- **Print Functionality**: Automated QR code sheet generation after purchase order finalization with enforced physical sizing via CSS print media rules
- **Multi-Method Scanning**: Supports three scanning methods:
  - Smartphone camera (primary method with responsive camera API)
  - PC webcam (browser-based html5-qrcode integration)
  - USB barcode scanner (keyboard wedge mode with manual entry fallback)
- **Security**: QR verification endpoint (`GET /api/inventory-units/verify/:uniqueTag`) enforces tenant isolation through inventory item lookup
- **Integration Points**:
  - Purchase Orders: Print QR codes immediately after PO finalization for created inventory units
  - Kanban Tickets: Scan-to-add functionality in item selection dialog with Browse/Scan tabs
  - Inventory Analytics: "Scan to Find" feature with visual highlighting of matched items (cyan background + left border)
- **Components**:
  - `QRCodeScanner`: Reusable dialog component with camera/manual entry modes
  - `QRCodePrintSheet`: Print-optimized component with exact 2.5cm × 2.5cm sizing
- **UX Enhancements**: Auto-clear highlighting when manual search is performed, real-time feedback with toast notifications, Aurora design consistency

### Inventory Category Management (Phase 6)
- **Device-Type-Based Organization**: Categories are specific to device types (Phone, Laptop, Desktop, Other), preventing cross-device misclassification
- **Database Schema**: `inventoryCategories` table with fields: id, tenantId, name, deviceType, isActive, createdAt, updatedAt
- **Backend Validation**: Server-side enforcement ensures categories can only be assigned to items with matching device types
- **Configuration UI**: Dedicated "Inventory Categories" tab in Configurations page with:
  - Device-type grouping (visual separation by Phone/Laptop/Desktop/Other)
  - CRUD operations (Create, Edit, Delete with confirmation dialogs)
  - Active/inactive status toggles for soft-delete functionality
  - Aurora card design pattern with gradient headers
- **Integration Points**:
  - Purchase Orders: Category dropdown during PO finalization, filtered by item's device type
  - Inventory Page: Category column display, category filter dropdown with "Uncategorized" option
  - Inventory Edit Dialog: Editable category dropdown filtered by item's device type
  - Analytics Page: Category display and filtering with device-type awareness
- **API Endpoints**: Full CRUD via `/api/inventory-categories` with tenant isolation
- **Multi-Language Support**: 17 translation keys added for en and pt-BR (category_name, add_category, edit_category, etc.)
- **Data Integrity**: Both frontend filtering and backend validation prevent assigning categories to items with mismatched device types
- **User Experience**: Seamless categorization workflow from purchase through analytics with consistent Aurora design

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