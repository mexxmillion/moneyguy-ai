# Design System Strategy: The Pristine Ledger

## 1. Overview & Creative North Star
This design system is built upon the **"The Pristine Ledger"**—a creative North Star that marries the mathematical precision of high-tech finance with the tactile elegance of editorial print. We are moving away from the "boxy" utility of traditional banking apps to create an environment that feels like a private digital concierge.

To break the "template" look, this system utilizes **intentional asymmetry** (e.g., large left-aligned display type paired with generous right-side negative space) and **tonal depth**. We treat the screen not as a flat canvas, but as a multi-dimensional space where data "floats" on layers of light and glass. This approach replaces rigid grid lines with organic breathing room, ensuring the user feels a sense of calm and control over their financial life.

---

## 2. Colors & Surface Logic
The palette is rooted in a high-tech "Apple-esque" aesthetic: clinical whites, sophisticated grays, and high-chroma functional accents.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. Structural definition must be achieved through **Background Color Shifts**. To separate a content block, place a `surface_container_low` element against the `background` (#faf9fe). This creates a sophisticated, modern boundary that feels integrated rather than partitioned.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of frosted material. Use the surface-container tiers to define importance:
*   **Base:** `background` (#faf9fe)
*   **Secondary Sections:** `surface_container_low` (#f4f3f8)
*   **Interactive Cards:** `surface_container_lowest` (#ffffff)
*   **Elevated Overlays:** `surface_bright` (#faf9fe)

### The "Glass & Gradient" Rule
For floating elements (like navigation bars or action sheets), apply a **Glassmorphism** effect:
*   **Fill:** `surface_container_lowest` at 70% opacity.
*   **Backdrop Blur:** 20px to 40px.
*   **Signature Textures:** For high-impact areas like "Total Balance" cards, use a linear gradient transitioning from `primary` (#0058bc) to `primary_container` (#0070eb) at a 135-degree angle. This provides a "liquid" depth that flat colors cannot replicate.

---

## 3. Typography: Editorial Authority
We use **Inter** to mimic the San Francisco aesthetic, focusing on extreme scale shifts to guide the eye.

*   **The Hero Moment:** Use `display-lg` (3.5rem) for primary financial balances. The tight letter-spacing and massive scale convey a sense of institutional transparency.
*   **The Narrative:** `headline-sm` (1.5rem) should be used for section titles, left-aligned to create a strong vertical axis.
*   **The Metadata:** Use `label-md` (0.75rem) with `on_surface_variant` (#414755) for secondary data like timestamps or category labels. 
*   **Hierarchy Tip:** Never use `on_surface` (#1a1b1f) for everything. Use `on_surface_variant` for body text to soften the interface and reduce eye strain, reserving the darkest black for primary headings.

---

## 4. Elevation & Depth
Depth is a functional tool, not just an aesthetic choice. We use **Tonal Layering** to convey hierarchy.

*   **The Layering Principle:** Instead of a shadow, place a `surface_container_lowest` card on top of a `surface_container_low` background. The slight shift in brightness creates a "soft lift."
*   **Ambient Shadows:** For floating CTAs, use a shadow that mimics natural light:
    *   **Color:** `on_surface` (#1a1b1f) at 6% opacity.
    *   **Blur:** 40px.
    *   **Y-Offset:** 12px. 
*   **The "Ghost Border" Fallback:** If a layout requires a boundary for accessibility, use the "Ghost Border": the `outline_variant` (#c1c6d7) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism Depth:** When using glass effects, ensure the `on_surface` text maintains a 4.5:1 contrast ratio against the blurred background to ensure the system remains "Premium yet Accessible."

---

## 5. Components

### Buttons
*   **Primary:** Background using the `primary` to `primary_container` gradient. Text: `on_primary`. Radius: `full`.
*   **Secondary:** Background: `surface_container_high`. Text: `primary`. Radius: `lg` (2rem).
*   **State:** On press, reduce scale to 97% to provide tactile haptic feedback.

### Input Fields
*   **Style:** Minimalist containers using `surface_container_low`. 
*   **Corners:** `md` (1.5rem).
*   **Focus State:** A 2px "Ghost Border" using `primary` at 30% opacity. No heavy solid outlines.

### Cards & Lists
*   **The Divider Ban:** Never use horizontal lines to separate transactions. Use **Vertical White Space** (1.5rem from the spacing scale) or a subtle background toggle between `surface` and `surface_container_lowest`.
*   **Content:** Transaction amounts in `title-md` should be color-coded: `secondary` (#006e28) for growth/income and `tertiary` (#bc000a) for spending.

### Chips (Category Tags)
*   **Filter Chips:** Use `surface_container_highest` with `on_surface_variant`. 
*   **Selected State:** `primary` background with `on_primary` text. Use `full` (9999px) radius for a "pill" look.

---

## 6. Do’s and Don’ts

### Do
*   **DO** use whitespace as a structural element. If a screen feels cluttered, increase the padding to the `xl` (3rem) scale.
*   **DO** use high-quality, thin-stroke (light weight) iconography to match the Inter typography.
*   **DO** prioritize the "Glass" effect for top-level navigation to keep the UI feeling airy.

### Don't
*   **DON’T** use pure black (#000000). Use `on_surface` (#1a1b1f) to maintain the premium, soft-minimalist tone.
*   **DON’T** use standard 4px or 8px rounded corners. Stick to the Scale: `md` (1.5rem) is our minimum for cards to maintain the "Apple-style" friendliness.
*   **DON’T** use drop shadows on every card. Rely on background color shifts first; shadows are for "Actionable Float" only.