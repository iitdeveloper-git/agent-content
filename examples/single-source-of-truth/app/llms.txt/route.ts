import { createLlmsTxtHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '../../agent-content.config';

export const { GET, HEAD } = createLlmsTxtHandler(agentContent);
