/**
 * The canonical content model. Plain, typed data: no React, no AgentContent imports.
 * Everything the website shows and everything agents read is derived from this file's shapes.
 */
export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

export interface Section {
  heading: string;
  blocks: Block[];
}

export interface SiteItem {
  /** Route path, e.g. '/services' ('/' is the home page). */
  path: string;
  title: string;
  /** Used for <meta name="description">, llms.txt and the Markdown frontmatter. */
  summary: string;
  status: 'published' | 'draft';
  /** ISO date; drives both the page footer and the Markdown `updated_at`. */
  updatedAt: string;
  category: string;
  sections: Section[];
}
