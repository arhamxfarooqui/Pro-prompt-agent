# Design System Specification: Pro Prompt Engine

## 1. Core Philosophy
The UI must feel like a high-performance developer tool. It relies on a "Deep Dark" theme to reduce eye strain during long sessions, punctuated by vibrant, intentional accent colors to guide the user's eye toward actions, states, and metrics.

## 2. Color Palette

### Base Backgrounds & Surfaces (Dark Slate/Navy)
* **App Background:** `#0F172A` (Slate 900) - Used for the main dashboard body.
* **Surface / Card Background:** `#1E293B` (Slate 800) - Used for modals, popup background, and sidebar.
* **Elevated Surface (Floating Toolbar):** `rgba(30, 41, 59, 0.8)` with `backdrop-blur-md` (Glassmorphism).
* **Borders & Dividers:** `#334155` (Slate 700).

### Primary Accent (Blue)
* **Primary Action (Buttons, Active States):** `#2563EB` (Blue 600)
* **Hover State:** `#1D4ED8` (Blue 700)
* **Subtle Glow/Highlight:** `rgba(37, 99, 235, 0.2)`
* **Text Link / Active Icon:** `#60A5FA` (Blue 400)

### Complementary Accents (Yellow & Red)
* **Yellow (Scores, Warnings, Highlights):**
    * Base/Text: `#FBBF24` (Amber 400)
    * Background/Badge: `rgba(251, 191, 36, 0.15)`
* **Red (Errors, Destructive Actions, Off-states):**
    * Base/Text: `#EF4444` (Red 500)
    * Background/Badge: `rgba(239, 68, 68, 0.15)`
* **Green (Success, Model Loaded):**
    * Base/Text: `#10B981` (Emerald 500)

### Typography Colors
* **Primary Text (Headings, Main Body):** `#F8FAFC` (Slate 50)
* **Secondary Text (Descriptions, Labels):** `#94A3B8` (Slate 400)
* **Muted Text (Placeholders):** `#64748B` (Slate 500)

---

## 3. Typography
* **Font Family:** `Inter`, `Roboto`, or system-ui. (Monospace for all code blocks and snippet prefixes: `Fira Code` or `JetBrains Mono`).
* **Hierarchy:**
    * `h1` (Dashboard Titles): 24px, Semi-Bold.
    * `h2` (Section Titles, Modal Headers): 18px, Medium.
    * `Body`: 14px, Regular.
    * `Small` (Labels, Meta info): 12px, Medium.

---

## 4. UI Components & Geometry

### Buttons
* **Border Radius:** `6px` (rounded-md) for a sharp but approachable feel.
* **Primary Button:** Solid Blue background, White text, subtle drop shadow.
* **Secondary/Outline Button:** Transparent background, Blue 500 border, Blue 400 text. Hovering fills with a 10% opacity blue.
* **Icon Buttons (Toolbar):** 40x40px, rounded-full or rounded-lg. `Slate 800` background. On hover, background shifts to `Slate 700` and icon tints to Primary Blue.

### Modals & Popups
* **Border Radius:** `12px` (rounded-xl).
* **Shadow:** `box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);`
* **Backdrop:** Dark overlay with 50% opacity and `backdrop-blur-sm`.

### Inputs & Text Areas
* **Background:** `#0F172A` (Slate 900) - darker inset feel compared to surfaces.
* **Border:** 1px solid `#334155`. 
* **Focus State:** Border turns to `#2563EB` (Primary Blue) with a `0 0 0 2px rgba(37,99,235,0.3)` focus ring. Outline must be removed.

---

## 5. Interaction Guidelines
* **Transitions:** Use `150ms ease-in-out` for all hover states, button presses, and toggle switches.
* **Toggles:** Standard iOS-style pill toggles. Off state is `Slate 600`, On state is `Blue 600`.
* **Floating Bar Interaction:** Must feature a `cursor-grab` handle at the top. When dragged, opacity drops to 50% to show underlying content.

## Prompt for UI:
Build a comprehensive UI system for a modern, high-tech browser extension called "Pro Prompt Engine". The application consists of three main surfaces: a Browser Extension PopUp, an Injected Floating Webpage Toolbar, and a full-page Web Dashboard. 

THEME & STYLING:
- Style: Modern SaaS, highly technical but clean, glassmorphism elements.
- Theme: Deep Dark Mode. Backgrounds should be dark slate/navy (e.g., bg-slate-900 to bg-gray-950).
- Colors: 
  - Primary: Electric Blue (e.g., text-blue-400, bg-blue-600) for active states, primary buttons, and borders.
  - Complements: Amber/Yellow (e.g., text-amber-400) for scores, highlights, and warnings. Crimson/Red (e.g., text-red-500) for destructive actions, errors, or off-states.
- UI Elements: Slightly rounded corners (rounded-lg), subtle borders (border-slate-800), and soft inner glows or drop shadows for depth.

Please generate the following interconnected views and components:

1. EXTENSION POPUP (Width: 400px, Height: 600px max)
- Header: App logo/name, a "Current Score: 85 (Yellow)" badge, and a tiny "Active: Llama-3 (Blue)" status indicator.
- Profiles Grid: A 3x2 grid of circular profile avatars/icons (Developer, Analyst, Writer, etc.) with a distinctive "+" button to create a new one. The active profile should have a glowing blue ring.
- Action Panel: Two large, full-width buttons: "⚡ Refactor Prompt" (Blue solid) and "✨ Write for me" (Outline).
- Quick Toggles: A list of settings with sleek toggle switches: "Prompt Autocomplete", "Text Select Addition". 
- Context & Snippets: A small section at the bottom with a "Scan Webpage" button and a mini input group to quickly add a snippet (Input for Prefix, Input for Body, "Save" icon button).

2. INJECTED FLOATING TOOLBAR (Positioned Fixed, Right-center of screen)
- A vertical pill-shaped container (bg-slate-900/80 backdrop-blur-md).
- Contains a vertical stack of icon buttons (with tooltips on hover): 
  1. Score (Speedometer icon - Yellow glow)
  2. Refactor (Sparkles icon - Blue)
  3. Autocomplete (Toggle switch icon)
  4. Generate Prompt (Magic wand icon)
  5. Scan Webpage (Radar/Scanner icon)
  6. Select Text (Highlighter icon)
  7. Add Snippet (Plus/Code icon)
- A drag handle at the top and a collapse/expand chevron at the bottom.

3. OVERLAY MODALS (Displayed over the dark theme)
- Write Prompt Modal: Title "Generate Prompt". Inputs: A text area for description, a dropdown for Profile selection, a horizontal slider for "Detail Level (Concise to Verbose)", a "Generate" (Blue) button, and a right-side read-only preview box for the generated result.
- Score Analysis Box: A compact floating card showing a large circular progress gauge indicating a score (e.g., 62 in Yellow). Below it, 2 bullet points of critique, and a "Refactor Now" button.
- Add Context Modal: Dropdown for "Target Profile", large text area for pasted text, and a "Save Context" button.

4. WEB DASHBOARD (Full screen, sidebar layout)
- Sidebar: Left navigation with sections: Dashboard, Prompt Library, Analytics, Snippets, Context Hub, Settings.
- View A - Snippets Management: A data table with columns: Prefix Trigger (e.g., `/json`), Description, Body Preview, and Actions (Edit/Trash). Include an "Add New Snippet" button at the top right.
- View B - Context Hub (Profiles): A split-pane layout. Left pane: A list of cards representing Profiles. Right pane: An editing view for the selected Profile, containing text areas for "System Prompt Injection" and "Behavioral Guidelines", plus a list of attached "Context.md" documents.
- View C - Settings & Models: A grid showing available offline WebGPU models (Gemma, Llama, Qwen) with sizes (e.g., 1.9GB) and a "Download" progress bar or "Set Active" button.

Ensure all text has high contrast (white/off-white on dark backgrounds) and use standard modern sans-serif typography (Inter or Roboto).