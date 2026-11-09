/**
 * What Monitor's left column leaves under it for the card, over the secondary toolbar: the card
 * (title bar, and the 16:9 view at the column's width when open) and a gap. Tailwind `bottom-*`.
 */
export const ALT_CAMERA_ROOM = {
  open: "bottom-[calc(var(--spacing-toolbar)+12rem)] xl:bottom-[calc(var(--spacing-toolbar)+13rem)]",
  folded: "bottom-[calc(var(--spacing-toolbar)+3rem)]",
} as const;
