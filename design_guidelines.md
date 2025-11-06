# Repair Shop Management - Kanban Board Design Guidelines

## Design Approach
**System**: Custom dark UI inspired by Linear's precision + Trello's board clarity
**Rationale**: Utility-focused tool requiring clear information hierarchy and immediate task comprehension. Dark navy (#0A1128) base with neon cyan (#00FFFF) for active states creates high-contrast, fatigue-reducing interface for all-day use.

## Typography
- **Primary Font**: Inter (Google Fonts) - technical clarity
- **Hierarchy**:
  - Board title: text-2xl font-bold
  - Column headers: text-lg font-semibold tracking-tight
  - Card titles: text-base font-medium
  - Metadata: text-sm font-normal
  - Status badges: text-xs font-semibold uppercase tracking-wide

## Layout System
**Spacing Primitives**: Use Tailwind units 1, 2, 3, 4, 6, 8, 12
- Card padding: p-4
- Column spacing: gap-4
- Board container: p-6
- Tight elements: gap-2
- Section separation: gap-8

## Core Components

### Kanban Board Structure
**Board Container**: Full-height viewport (h-screen), horizontal scroll with snap points, px-6 py-4

**Column Layout**:
- Fixed width: w-80 (320px)
- Flex-shrink-0 to prevent compression
- Vertical stack with gap-3
- Column header: sticky top-0, Aurora gradient (navy to lighter navy), h-16, rounded-t-lg
- Cards container: overflow-y-auto, pb-4, min-h-[200px]

### Aurora Card Pattern
**Card Structure**:
- Background: Slightly lighter than base navy
- Border: 1px solid with subtle gradient border-top (cyan tint)
- Rounded corners: rounded-lg
- Shadow: Elevated on hover (shadow-lg)
- Padding: p-4
- Gap between elements: gap-3

**Card Header**:
- Ticket ID badge: Small pill, cyan background with 20% opacity
- Title: Truncate after 2 lines
- Priority indicator: Right-aligned dot (8px diameter)

**Card Body**:
- Customer name: text-sm with subtle opacity
- Device info: Icon + text-sm in horizontal layout
- Issue description: text-xs, 3-line clamp
- Status metadata: Grid layout (2 columns for assigned tech, due date)

**Card Footer**:
- Tags: Horizontal scroll, gap-2, text-xs pills
- Action buttons: Right-aligned, icon-only, opacity transitions

### Drag-and-Drop Visual Feedback

**Dragging State**:
- Active card: Scale 1.02, rotate 2deg, shadow-2xl, cursor-grabbing
- Source column: Reduced opacity 0.5 on drop zone
- Ghost placeholder: Dashed border (2px), same height as card, cyan border with 30% opacity

**Drop Zones**:
- Valid target: Cyan glow border (2px), pulse animation
- Invalid target: Red-tinted border, shake animation on attempt
- Between cards: Horizontal line indicator (2px, cyan, 60% opacity)

**Validation Feedback**:
- Blocked transition: Toast notification (top-right), icon + message
- Success: Brief cyan flash on column header
- Required fields missing: Yellow warning badge on card during drag

### Status Columns (Standard Flow)
1. **Intake** - New tickets
2. **Diagnosed** - Assessment complete
3. **Parts Ordered** - Waiting for components
4. **In Repair** - Active work
5. **Quality Check** - Testing phase
6. **Ready** - Pickup available
7. **Completed** - Closed tickets

Each column header includes:
- Status name + count badge
- Add ticket button (+ icon, right-aligned)
- Column menu (3-dot, settings/filters)

### Navigation & Controls
**Top Bar**: Fixed, h-16, flex justify-between
- Left: App logo + "Kanban Board" breadcrumb
- Center: Search bar (w-96, icon-left, cyan focus ring)
- Right: Filter dropdown, View toggle, User avatar

**Sidebar** (Collapsible, w-64):
- Dashboard link
- Board views
- Reports
- Settings
- Metrics summary cards (gap-4, stacked)

## Images
**No hero image** - This is a utility application, direct entry to board.

**Card Thumbnails**: Device photos (96x96px, rounded, object-cover) in card header when available. Placeholder icon if no image.

## Interaction States
- **Hover**: Slight lift (translateY -2px), increased shadow
- **Active/Selected**: Cyan left border (4px), background lightened 5%
- **Disabled**: 40% opacity, cursor-not-allowed
- **Loading**: Skeleton screens with shimmer (subtle cyan gradient)

## Responsive Adaptation
- Desktop (>1024px): 4-5 columns visible
- Tablet (768-1024px): 3 columns, horizontal scroll
- Mobile (<768px): Single column stack, swipe navigation between statuses