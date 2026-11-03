import type { SiteItem } from './types';

export const SITE = {
  name: 'Acme Studio',
  url: 'https://acme.example',
  description: 'Product engineering for small teams.',
} as const;

/** The single source of truth. Edit content here and both HTML and Markdown change. */
export const ITEMS: SiteItem[] = [
  {
    path: '/',
    title: 'Acme Studio',
    summary: 'Product engineering for small teams.',
    status: 'published',
    updatedAt: '2026-11-01',
    category: 'Overview',
    sections: [
      {
        heading: 'What we do',
        blocks: [{ kind: 'paragraph', text: 'We design, build and operate web products.' }],
      },
    ],
  },
  {
    path: '/services',
    title: 'Services',
    summary: 'Web development, data pipelines and AI integration.',
    status: 'published',
    updatedAt: '2026-11-02',
    category: 'Offerings',
    sections: [
      {
        heading: 'Web development',
        blocks: [
          { kind: 'paragraph', text: 'Fast, accessible sites built on React and Next.js.' },
          { kind: 'list', items: ['Design systems', 'Performance budgets', 'SEO'] },
        ],
      },
      {
        heading: 'AI integration',
        blocks: [{ kind: 'paragraph', text: 'Make your product readable by AI agents.' }],
      },
    ],
  },
  {
    path: '/roadmap',
    title: 'Roadmap',
    summary: 'Unreleased plans.',
    status: 'draft',
    updatedAt: '2026-11-03',
    category: 'Internal',
    sections: [{ heading: 'Next', blocks: [{ kind: 'paragraph', text: 'Not public yet.' }] }],
  },
];

export function getItem(path: string): SiteItem | undefined {
  return ITEMS.find((item) => item.path === path);
}
