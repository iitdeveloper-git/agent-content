import { defineAgentContent } from '@iitdeveloper/agent-content-nextjs';
import { ITEMS, SITE } from './content/site';
import { toStructuredPage } from './content/to-structured-page';

export const agentContent = defineAgentContent({
  site: SITE,
  // No page text lives here: it is all derived from the shared model.
  pages: ITEMS.map(toStructuredPage),
  // Opt in to JSON-LD in the Markdown output (off by default).
  // (includeMetadata would publish every page's `metadata` verbatim: only enable it for public data.)
  render: { includeStructuredData: true },
});
