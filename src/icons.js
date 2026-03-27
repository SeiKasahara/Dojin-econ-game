/**
 * Icon system — Phosphor Icons (Bold weight)
 * Replaces emoji with consistent SVG icon font
 */
import '@phosphor-icons/web/bold';

/** Escape HTML special chars to prevent XSS when embedding user text in innerHTML */
export function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render a Phosphor Bold icon as inline HTML */
export function ic(name, size) {
  if (!name) return '';
  const s = size ? ` style="font-size:${size}"` : '';
  return `<i class="ph-bold ph-${name}"${s}></i>`;
}
