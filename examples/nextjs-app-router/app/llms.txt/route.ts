import { createLlmsTxtHandler } from '@iitdeveloper/nextjs';
import { agentContent } from '../../agent-content.config.js';

export const { GET, HEAD } = createLlmsTxtHandler(agentContent);

