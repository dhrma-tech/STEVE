/**
 * Z-Index Architecture — Section S
 *
 * Single source of truth for every z-index value in the application.
 * Nothing outside this file may set a z-index directly.
 * Reference: report100.txt Section S "Z-Index & Layering Architecture"
 */

/** ReactFlow canvas background (rgb(30,30,35)) */
export const Z_CANVAS_BASE = 0;

/** All ReactFlow nodes (dept pills, workspace plates) */
export const Z_CANVAS_NODE = 1; // range 1-100

/** ReactFlow edge paths */
export const Z_CANVAS_EDGE = 50;

/** Selected node lifted above peers */
export const Z_CANVAS_NODE_SELECTED = 200;

/** Node being dragged */
export const Z_CANVAS_NODE_DRAGGING = 500;

/** Bottom-left ambient notification pill */
export const Z_ATTENTION_INBOX = 1000;

/** Persistent right panel */
export const Z_RIGHT_SIDEBAR = 2000;

/** Settings sidebar (peer to content area) */
export const Z_SETTINGS_NAV = 2001;

/** New Task modal backdrop (semi-transparent overlay behind modal) */
export const Z_NEW_TASK_MODAL_BACKDROP = 10018;

/** New Task modal content (720px, centered) */
export const Z_NEW_TASK_MODAL = 10019;

/** Full-screen dept setup overlay */
export const Z_DEPT_ONBOARDING_OVERLAY = 10020;

/**
 * Canvas chrome overlays — org pill, search button, hamburger, "+" add button.
 * Four orders of magnitude above canvas nodes to guarantee no node can visually
 * overlap chrome regardless of canvas pan or zoom state.
 */
export const Z_CANVAS_CHROME = 10030;

/** Canvas path breadcrumb (top, blur backdrop) */
export const Z_BREADCRUMB = 10031;

/** Fixed floating "Stop Claude" button */
export const Z_STOP_CLAUDE = 10040;

/** Hover tooltips (brief, auto-dismiss) */
export const Z_TOOLTIP = 10050;

/** Context menus, org dropdown, search popover — range 10004-10060 */
export const Z_DROPDOWN_MIN = 10004;
export const Z_DROPDOWN_MAX = 10060;

/** Fresh updates / version badge popover */
export const Z_TOAST = 10070;

/** Blocking dialogs (confirm delete, etc.) */
export const Z_MODAL = 10080;

/** Global shortcut cheat sheet */
export const Z_KEYBOARD_SHORTCUTS = 10090;

/**
 * App-shell interior layers (below canvas chrome, within normal layout flow).
 * These use small Tailwind z-utilities (z-30, z-40) rather than the large
 * canvas-chrome values because the app-shell renders in settings / non-canvas
 * routes where no canvas chrome is present.
 */

/** Sticky topbar header — below canvas chrome, above content */
export const Z_APP_TOPBAR = 30; // Tailwind z-30

/** Mobile bottom-pill nav — above content, below modals */
export const Z_MOBILE_NAV = 40; // Tailwind z-40
