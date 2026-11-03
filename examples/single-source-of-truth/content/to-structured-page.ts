import type { StructuredPage } from '@iitdeveloper/agent-content-nextjs';
import type { Block, SiteItem } from './types';

function blockToMarkdown(block: Block): string {
  return block.kind === 'paragraph' ? block.text : block.items.map((item) => `- ${item}`).join('\n');
}

/**
 * The only place that knows about both shapes: it maps the app's model onto AgentContent's
 * `StructuredPage`. Pure data in, pure data out (no React, no I/O).
 */
export function toStructuredPage(item: SiteItem): StructuredPage {
  return {
    url: item.path,
    title: item.title,
    description: item.summary,
    // The page body is carried by `sections`, so `content` stays empty to avoid duplicated text.
    content: '',
    sections: item.sections.map((section) => ({
      title: section.heading,
      level: 2,
      content: section.blocks.map(blockToMarkdown).join('\n\n'),
    })),
    category: item.category,
    status: item.status,
    updatedAt: item.updatedAt,
    structuredData: {
      '@type': 'WebPage',
      name: item.title,
      description: item.summary,
      dateModified: item.updatedAt,
    },
  };
}
