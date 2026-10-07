import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const md = (s: string | null | undefined): string => (s ? DOMPurify.sanitize(marked.parse(s, { async: false }) as string) : '');
export const mdInline = (s: string | null | undefined): string =>
  s ? DOMPurify.sanitize(marked.parseInline(s, { async: false }) as string) : '';
export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
