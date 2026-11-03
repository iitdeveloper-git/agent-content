import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import picocolors from 'picocolors';
import {
  defineAgentContent,
  generateLlmsFullTxt,
  generateLlmsTxt,
  siteConfigSchema,
  structuredPageSchema,
} from '@iitdeveloper/agent-content';
import { buildStaticWebsite, printBuildReport } from './build.js';

export * from './build.js';

const STARTER_JSON_CONFIG = `{
  "site": {
    "name": "My Website",
    "url": "https://example.com",
    "description": "Clean, agent-readable developer content."
  },
  "pages": [
    {
      "url": "/",
      "title": "Home",
      "description": "Welcome to our website.",
      "content": "# Welcome\\n\\nExplore our products and documentation.",
      "status": "published"
    },
    {
      "url": "/about",
      "title": "About Us",
      "description": "Learn about our team and mission.",
      "content": "# About Us\\n\\nWe build open source infrastructure for AI agents.",
      "status": "published"
    }
  ]
}
`;

const STARTER_TS_CONFIG = `import { defineAgentContent } from '@iitdeveloper/agent-content';

export default defineAgentContent({
  site: {
    name: 'My Website',
    url: 'https://example.com',
    description: 'Clean, agent-readable developer content.',
  },
  pages: [
    {
      url: '/',
      title: 'Home',
      description: 'Welcome to our website.',
      content: '# Welcome\\n\\nExplore our products and documentation.',
      status: 'published',
    },
    {
      url: '/about',
      title: 'About Us',
      description: 'Learn about our team and mission.',
      content: '# About Us\\n\\nWe build open source infrastructure for AI agents.',
      status: 'published',
    },
  ],
});
`;

export function createCli(): Command {
  const program = new Command();

  program
    .name('agent-content')
    .description('CLI tool for AgentContent — scaffolding, validation, static website build, and llms.txt generation.')
    .version('0.1.0');

  // Command: init
  program
    .command('init')
    .description('Scaffolds an agent-content configuration file in the current directory')
    .option('-f, --force', 'Overwrite existing configuration file if present', false)
    .option('-t, --type <type>', 'Configuration file type (json or ts)', 'json')
    .action((opts) => {
      const isTs = opts.type === 'ts';
      const filename = isTs ? 'agent-content.config.ts' : 'agent-content.config.json';
      const targetPath = resolve(process.cwd(), filename);

      if (existsSync(targetPath) && !opts.force) {
        console.log(picocolors.yellow(`Configuration file already exists at ${targetPath}. Use --force to overwrite.`));
        return;
      }

      writeFileSync(targetPath, isTs ? STARTER_TS_CONFIG : STARTER_JSON_CONFIG, 'utf8');
      console.log(picocolors.green(`✓ Created ${targetPath}`));
      console.log(picocolors.cyan('\nNext steps:'));
      console.log(`  1. Customize site metadata and pages in ${filename}`);
      console.log('  2. Run `npx agent-content validate` to verify schema');
      console.log('  3. Run `npx agent-content build --dir ./dist` to convert static HTML to Markdown\n');
    });

  // Command: build (Static Website Inspector & Markdown Generator)
  program
    .command('build')
    .description('Inspects a static website directory, converts HTML to Markdown, and generates llms.txt')
    .option('-d, --dir <directory>', 'Directory containing static HTML files', '.')
    .option('-o, --out-dir <directory>', 'Output directory for generated Markdown and llms.txt')
    .option('--base-url <url>', 'Base website URL (e.g. https://example.com)')
    .option('--site-name <name>', 'Website name')
    .option('--site-desc <description>', 'Website description')
    .option('--exclude <patterns...>', 'Directory or file patterns to exclude')
    .option('--generate-rules', 'Generate web server and hosting rewrite rules (Nginx, Apache, Netlify)', false)
    .option('-f, --force', 'Force overwrite of existing hosting rule files if present', false)
    .action(async (opts) => {
      try {
        console.log(picocolors.cyan(`Scanning static website in "${opts.dir}"...`));
        const report = await buildStaticWebsite({
          dir: opts.dir,
          outDir: opts.outDir,
          baseUrl: opts.baseUrl,
          siteName: opts.siteName,
          siteDescription: opts.siteDesc,
          exclude: opts.exclude,
          generateRules: opts.generateRules === true,
          force: opts.force === true,
        });

        printBuildReport(report);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(picocolors.red(`Build failed: ${message}`));
        process.exitCode = 1;
      }
    });

  // Command: validate
  program
    .command('validate [file]')
    .description('Validates an agent-content configuration or structured content file')
    .action((file) => {
      let targetFile = file ? resolve(process.cwd(), file) : resolve(process.cwd(), 'agent-content.config.json');

      if (!file && !existsSync(targetFile)) {
        const tsFallback = resolve(process.cwd(), 'agent-content.config.ts');
        if (existsSync(tsFallback)) {
          targetFile = tsFallback;
        }
      }

      if (!existsSync(targetFile)) {
        console.error(picocolors.red(`Error: File not found at ${targetFile}`));
        process.exitCode = 1;
        return;
      }

      try {
        const raw = readFileSync(targetFile, 'utf8');

        if (targetFile.endsWith('.ts') || targetFile.endsWith('.js')) {
          // For TS/JS starter files, check that it defines valid AgentContent
          if (raw.includes('defineAgentContent') && raw.includes('site') && raw.includes('pages')) {
            console.log(picocolors.green(`✓ TypeScript configuration at ${targetFile} is structured correctly.`));
            return;
          }
        }

        const parsed = JSON.parse(raw);

        const siteResult = siteConfigSchema.safeParse(parsed.site);
        if (!siteResult.success) {
          console.error(picocolors.red(`✗ Site configuration validation failed:`));
          console.error(siteResult.error.format());
          process.exitCode = 1;
          return;
        }

        const pages = parsed.pages || [];
        let validPages = 0;
        const seenUrls = new Set<string>();

        for (const page of pages) {
          const pageResult = structuredPageSchema.safeParse(page);
          if (!pageResult.success) {
            console.error(picocolors.red(`✗ Page validation failed for ${page.url}:`));
            console.error(pageResult.error.format());
            process.exitCode = 1;
            return;
          }
          if (seenUrls.has(page.url)) {
            console.warn(picocolors.yellow(`! Duplicate page URL detected: ${page.url}`));
          }
          seenUrls.add(page.url);
          validPages++;
        }

        console.log(picocolors.green(`✓ Configuration is valid! Found ${validPages} valid pages.`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(picocolors.red(`Failed to validate: ${message}`));
        process.exitCode = 1;
      }
    });

  // Command: generate-llms
  program
    .command('generate-llms')
    .description('Generates static llms.txt and llms-full.txt files')
    .option('-c, --config <path>', 'Path to JSON configuration file', 'agent-content.config.json')
    .option('-o, --out-dir <path>', 'Output directory for llms.txt', 'public')
    .action((opts) => {
      const configPath = resolve(process.cwd(), opts.config);

      if (!existsSync(configPath)) {
        console.error(picocolors.red(`Error: Config file not found at ${configPath}`));
        process.exitCode = 1;
        return;
      }

      try {
        const raw = readFileSync(configPath, 'utf8');
        const config = JSON.parse(raw);
        const instance = defineAgentContent(config);

        const llmsTxt = generateLlmsTxt({
          site: instance.config.site,
          pages: instance.listPages({ status: 'published' }),
        });

        const llmsFullTxt = generateLlmsFullTxt({
          site: instance.config.site,
          pages: instance.listPages({ status: 'published' }),
        });

        const outDir = resolve(process.cwd(), opts.outDir);
        mkdirSync(outDir, { recursive: true });
        const llmsTxtPath = resolve(outDir, 'llms.txt');
        const llmsFullTxtPath = resolve(outDir, 'llms-full.txt');

        writeFileSync(llmsTxtPath, llmsTxt, 'utf8');
        writeFileSync(llmsFullTxtPath, llmsFullTxt, 'utf8');

        console.log(picocolors.green(`✓ Generated ${llmsTxtPath} (${llmsTxt.length} chars)`));
        console.log(picocolors.green(`✓ Generated ${llmsFullTxtPath} (${llmsFullTxt.length} chars)`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(picocolors.red(`Failed to generate llms.txt: ${message}`));
        process.exitCode = 1;
      }
    });

  return program;
}
