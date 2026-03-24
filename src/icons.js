/**
 * Icon system — Phosphor Icons (Bold weight)
 * Replaces emoji with consistent SVG icon font
 */
import '@phosphor-icons/web/bold';

/** Render a Phosphor Bold icon as inline HTML */
export function ic(name, size) {
  if (!name) return '';
  const s = size ? ` style="font-size:${size}"` : '';
  return `<i class="ph-bold ph-${name}"${s}></i>`;
}
