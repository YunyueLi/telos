// Inline SVG sprite: hand-drawn "sketch" displacement filters + line icon symbols.
// Rendered once at the document root so `filter:url(#sk)` and `<use href="#i-...">` resolve everywhere.
export function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sk" x="-35%" y="-35%" width="170%" height="170%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" />
        </filter>
        <filter id="skL" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
        </filter>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M4 13l5 5L20 6" /></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></symbol>
        <symbol id="i-flag" viewBox="0 0 24 24"><path d="M6 21V4M6 5c4-2 8 2 12 0v8c-4 2-8-2-12 0" /></symbol>
        <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></symbol>
        <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" /></symbol>
        <symbol id="i-up" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></symbol>
        <symbol id="i-gauge" viewBox="0 0 24 24"><path d="M5 16a8 8 0 1 1 14 0M12 16l4-5" /></symbol>
        <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 6l11 6-11 6z" /></symbol>
        <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.2-5.1M19 4v4h-4" /></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11" /></symbol>
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6 10v10h12V10" /></symbol>
        <symbol id="i-map" viewBox="0 0 24 24"><path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2zM9 4v14M15 6v14" /></symbol>
        <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M5 20a7 7 0 0 1 14 0" /></symbol>
        <symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M16 8l-3 5-5 3 3-5z" /></symbol>
        <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 2.4 3 15.6 0 18M12 3c-3 2.4-3 15.6 0 18" /></symbol>
        <symbol id="i-chevron" viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6" /></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20.5 20.5l-4-4" /></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol id="i-sort" viewBox="0 0 24 24"><path d="M5 7h13M5 12h8M5 17h4" /></symbol>
        <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></symbol>
        <symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></symbol>
      </defs>
    </svg>
  );
}
