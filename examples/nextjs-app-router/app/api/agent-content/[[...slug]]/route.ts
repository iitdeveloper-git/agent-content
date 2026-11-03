import { createAgentContentHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '../../../../agent-content.config.js';

export const { GET, HEAD } = createAgentContentHandler({
  content: agentContent,
});
