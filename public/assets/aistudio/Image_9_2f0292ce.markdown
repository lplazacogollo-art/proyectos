---
name: VentaSmart Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  financial-numeric:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets mid-market to enterprise organizations requiring high-throughput billing, inventory control, and sales intelligence. The visual language balances institutional reliability with contemporary SaaS elegance, rejecting both antiquated enterprise grayness and frivolous consumer micro-trends.

The core aesthetic aligns with **Modern Corporate SaaS**:
- Deep navy structure providing authority and visual anchoring.
- High-clarity micro-contrast ensuring effortless prolonged scanning of dense transactional data.
- Subtle elevation through layered white-on-slate planes rather than loud borders.
- Strict financial clarity optimized for Colombian Peso (COP) accounting standards (e.g., `$ 1.250.000 COP`).

## Colors

The color architecture is built for dense enterprise workflows where semantic intent must be instantaneous.

### Palette Implementation
- **Deep Navy Structural Base (`#172554`):** Used primarily for navigation sidebars, major header zones, and active global states. It sets a secure, institutional posture.
- **Action Blues (`#2563EB` & `#3B82F6`):** The primary blue (`#2563EB`) commands primary interactive elements (active buttons, focused inputs, selected table rows). The secondary blue (`#3B82F6`) provides focus rings, secondary interactive indicators, and graphical accents.
- **Surfaces & Neutral Text:**
  - App Canvas: `#F8FAFC` (Slate 50) delivers an anti-glare, softened field.
  - Surface Card / Container: `#FFFFFF` (Pure White).
  - Primary Typography: `#0F172A` (Slate 900) for highest legible contrast.
  - Secondary Typography & Borders: `#64748B` (Slate 500) for metadata, labels, and `#E2E8F0` (Slate 200) for structural lines.
- **Semantic Feedback:**
  - Success / Invoiced / Paid: Emerald (`#10B981`).
  - Critical / Overdue / Error: Coral Red (`#EF4444`).
  - Warning / Stock Depletion: Amber Orange (`#F59E0B`).

Monetary amounts in COP should leverage bold slate tones for totals, paired with emerald accents strictly for completed inflows or receivables.

## Typography

Inter serves as the unified typographic engine across all levels. It delivers balanced x-height, clear numeric tabular layouts, and precise legibility across dense data interfaces.

### Hierarchy & Usage
- **Financial & Data Display:** Numbers, invoice totals, and inventory counts must apply tabular numbers (`font-variant-numeric: tabular-nums`) to preserve column alignment across decimal and thousand-point dividers.
- **COP Formatting:** Format Colombian Peso values with a space after the currency indicator and full stop thousand dividers: `$ 150.000` or `$ 12.450.000 COP`.
- **Labels:** Use `label-sm` with subtle uppercase tracking for table headers, form group titles, and status tags to ensure quick categorization without visual clutter.

## Layout & Spacing

The layout is built on a responsive 12-column fluid grid system pinned to an enterprise shell (collapsible fixed-width 260px sidebar and a 64px persistent top navigation bar).

### Grid & Breakpoints
- **Desktop (1280px+):** 12 columns, 24px (`1.5rem`) gutters, 32px (`2rem`) screen margins. Side navigation remains expanded by default.
- **Tablet (768px - 1279px):** 8 columns, 16px (`1rem`) gutters, 24px (`1.5rem`) margins. Sidebar collapses to a 72px icon rail.
- **Mobile (< 768px):** 4 columns, 16px (`1rem`) gutters, 16px (`1rem`) margins. Navigation condenses to a slide-over drawer triggered from the top utility bar.

### Spacing Principles
- Use `space-xs` and `space-sm` for micro-relationships (e.g., badge padding, icon-to-label gaps, cell vertical padding in dense modes).
- Use `space-md` for standard form control gaps and card internal padding.
- Use `space-lg` and `space-xl` for dashboard card separation and section decoupling.

## Elevation & Depth

Depth is established via clean ambient shadows paired with razor-thin surface borders. Pure drop shadows are never used in isolation; they are always anchored by an outline to maintain structural definition on calibrated enterprise displays.

### Elevation Hierarchy
- **Level 0 (Base Canvas):** Background `#F8FAFC`. Zero elevation.
- **Level 1 (Cards, Data Tables, Panels):** Background `#FFFFFF`, border `1px solid #E2E8F0`, shadow `shadow-sm` (`0 1px 2px 0 rgba(15, 23, 42, 0.05)`).
- **Level 2 (Hovered Cards, Dropdown Menus, Context Popovers):** Background `#FFFFFF`, border `1px solid #CBD5E1`, shadow `shadow-md` (`0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)`).
- **Level 3 (Modals, Slide-over Invoicing Drawers):** Background `#FFFFFF`, backdrop overlay `rgba(15, 23, 42, 0.45)`, shadow `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`.

## Shapes

The design uses an intentional, dual-tier corner radius language that reflects an approachable yet polished enterprise feel.

### Geometric Rules
- **Base Components (`rounded-lg` / 0.5rem - 8px):** Input fields, buttons, dropdown selects, and badge tags.
- **Containers & Surfaces (`rounded-xl` / 1rem - 16px):** Metric summary cards, standard white data blocks, alert boxes.
- **Macro Enclosures (`rounded-2xl` / 1.5rem - 24px):** Invoicing invoice-creation modals, master analytical dashboard wrappers, and marketing/onboarding banners.
- **Table Cells & List Rows:** Interior rows maintain a sharp inner structure (`rounded-none`) while the outer wrapper card commands `rounded-xl` with clipped overflow.

## Components

### Buttons
- **Primary:** Background `#2563EB`, text `#FFFFFF`, radius `rounded-lg`, hover `#1D4ED8`, focus ring `2px solid #3B82F6` with `2px` offset.
- **Secondary:** Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`, hover `#F8FAFC`.
- **Destructive:** Background `#EF4444`, text `#FFFFFF`, hover `#DC2626`.
- **Height & Padding:** Standard height `40px` (padding: `0 16px`), compact table-action height `32px` (padding: `0 12px`).

### Chips & Status Badges
- Pill-shaped or `rounded-md` with `space-xs` vertical and `space-sm` horizontal padding.
- **Paid / Completed:** Background `#ECFDF5`, text `#065F46`, dot `#10B981`.
- **Pending / In Review:** Background `#EFF6FF`, text `#1E40AF`, dot `#2563EB`.
- **Warning / Low Stock:** Background `#FFFBEB`, text `#92400E`, dot `#F59E0B`.
- **Overdue / Canceled:** Background `#FEF2F2`, text `#991B1B`, dot `#EF4444`.

### Data Tables
- Crisp, high-density presentation.
- Header row: background `#F8FAFC`, uppercase `label-sm` text in `#64748B`, height `44px`, bottom border `1px solid #E2E8F0`.
- Data rows: background `#FFFFFF`, height `52px`, bottom border `1px solid #F1F5F9`, hover background `#F8FAFC`.
- Numerical/Currency alignment: Right-aligned with tabular figures (`$ 150.000 COP`).

### Input Fields & Selects
- Height `40px`, border `1px solid #CBD5E1`, background `#FFFFFF`, radius `rounded-lg`, typography `body-md`.
- Focus state: border-color `#2563EB`, box-shadow `0 0 0 3px rgba(37, 99, 235, 0.15)`.
- Currency Input: Pre-fixed with absolute left text label `COP $` in `#64748B`.

### Modals & Drawers
- Centered modals for quick actions (confirm invoice cancellation, add tax ID). Radius: `rounded-2xl`.
- Full-height slide-over drawers (640px wide) from the right screen edge for complex tasks like "Crear Factura Electrónica" or "Detalle de Venta".

### Navigation Bars
- **Sidebar (Left):** Background `#172554`, active item indicator `#2563EB`, text `#E2E8F0`, muted text `#94A3B8`.
- **Top Utility Bar:** Background `#FFFFFF`, border-bottom `1px solid #E2E8F0`, persistent company switcher, search bar, and notification center.