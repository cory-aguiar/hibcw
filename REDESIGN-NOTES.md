# HIBCW v3 redesign — November 2026

Response to test-group feedback ("too dark", "text too small"), plus a more modern look.

## The look
- **A map app.** The island map fills the screen. On desktop, the Report / Incidents / Alerts panel floats over it as a card, like Apple or Google Maps.
- **Colors from Hilo:** basalt `#16302B` (text), rain mist `#EEF3F1` (background), shield teal `#0B7A68` (brand/buttons), lehua red `#C42F3A` (911, serious), koa gold `#A86A12` (moderate).
- **Light by default.** Dark mode (police navy `#08121F` / `#0F1D33`) is still in the toggle and remembers each visitor's choice.
- The shield logo sits flat, with no drop shadow.
- **Type:** Public Sans everywhere, self-hosted in `fonts/`. Rajdhani is used only for the HIBCW wordmark.
- **Readable:** text is 14px or larger, form fields are 16px (so iPhones don't zoom in), and tap targets are at least 44px.

## What changed on the pages
- The form is now clear numbered steps: 1 Incident type, 2 When it happened, 3 Where, 4 What happened…
- Emoji in menus and buttons became line icons. Incident-type emoji stay because they match the map pins.
- The stats strip now shows labeled numbers, with one-tap phone chips for 911, HPD and Crime Stoppers.
- Plainer wording: "Send report" (was "⊕ Submit Incident Report"), "Not sure which type? See the glossary", "Register a business".
- Map controls are grouped into one bar; on phones, the bottom bar has icons.
- The Join and Register pages show benefits as a simple list instead of boxed cards.
- Fixed: the glossary used to open underneath the map's zoom buttons.

## Files
- `hibcw-theme.css`: all colors, fonts, sizes and icons live here. Every public page loads it last.
- `fonts/`: Public Sans and Rajdhani (SIL Open Font License).
- Pages updated: index.html, index-mobile.html, apply.html, register-business.html, privacy.html, terms.html

## Not changed
- Supabase calls, form logic and the database.

## Deploy
Upload the whole folder as before, including `hibcw-theme.css` and `fonts/`. The Vercel build is unchanged.

## Please check before launch
- HPD non-emergency number confirmed: (808) 935-3311, now used everywhere.

### Phone admin and captain view (admin-mobile.html)
- Same look, styles in `hibcw-admin-mobile-theme.css`. Line icons in the bottom bar, larger labels, light by default.
- Fixed: about 4,300 lines of old duplicated code had been pasted after the end of the page (it showed up as stray text). Removed; the file is now half the size.

### Handbooks, quick reference, flyers, forms and packets
- `hibcw-docs-theme.css` plus a font swap (IBM Plex → Public Sans). Rajdhani stays only for display wordmarks on printed pieces.
- Handbooks and the quick reference open in light mode, with larger on-screen text. Printed layouts were checked: every one-page piece still prints on one page.
- PDFs regenerated: handbook-admin, handbook-captain, captain-quickref, all nine district flyers, and the intro letter.
- "Hilo Police Department" corrected to Hawaiʻi Police Department, and hawaiipolice.com to hawaiipolice.gov, everywhere (map pages, quick reference, paper incident form).

### Flyers (Nov 6)
- All 9 district flyers, the general and recruitment flyers, and the breakroom flyer now use the new palette: police navy header, shield teal (#0B7A68) on white, darker gray text, Public Sans headings, minimum 9px print text. Each still prints on one letter page.
- Fixed: a broken CSS comment in the recruitment flyer had collapsed the "What you get as a member" section into a plain list; it's a 3-column grid again.
- District flyers keep their district colors. Text is about 25% larger, filling space that used to be empty, and colored text on white uses each district's darker shade so it's readable on paper.
- District flyer PDFs regenerated.
