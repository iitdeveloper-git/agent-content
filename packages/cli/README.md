# @iitdeveloper/agent-content-cli

> Static website CLI for AgentContent — inspect HTML websites, convert pages to Markdown, and generate llms.txt discovery manifests.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/iitdeveloper-git/agent-content/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@iitdeveloper/agent-content-cli.svg)](https://www.npmjs.com/package/@iitdeveloper/agent-content-cli)

---

## ⚡ What is this?

`@iitdeveloper/agent-content-cli` is the command-line interface for **AgentContent**. It inspects static websites, converts HTML files to clean Markdown representations, and generates deterministic `llms.txt` and `llms-full.txt` discovery files.

---

## 📦 Usage

You can run the CLI directly with `npx`:

```bash
npx @iitdeveloper/agent-content-cli --help
```

Or install it globally or as a dev dependency:

```bash
npm install -D @iitdeveloper/agent-content-cli
```

---

## 🚀 Commands

### 1. `build` — Convert Static HTML & Generate `llms.txt`

Converts all HTML pages in a directory to clean Markdown files and writes `llms.txt` and `llms-full.txt`:

```bash
npx @iitdeveloper/agent-content-cli build --dir ./public --base-url https://example.com
```

#### Options:

- `-d, --dir <directory>`: Source directory containing HTML files (default: `.`).
- `-o, --out-dir <directory>`: Output directory for `.md` and `llms.txt` files (default: same as `--dir`).
- `-u, --base-url <url>`: Canonical base URL of the site (e.g. `https://my-site.com`).
- `-n, --site-name <name>`: Human-readable site name (default: inferred from homepage or directory).
- `--generate-rules`: Generates server rewrite rules for Apache (`.htaccess`), Netlify (`_headers`), and Nginx (`nginx-agent-content.conf`). *Disabled by default to protect existing configuration.*
- `-f, --force`: Overwrite existing server configuration files when `--generate-rules` is passed.

### 2. `init` — Scaffold Configuration

Initializes an `agent-content.config.json` (or `.ts`) file:

```bash
npx @iitdeveloper/agent-content-cli init
# Or TypeScript:
npx @iitdeveloper/agent-content-cli init --type ts
```

### 3. `validate` — Validate Registry

Validates your `agent-content.config.json` against the schema:

```bash
npx @iitdeveloper/agent-content-cli validate
```

---

## 📄 License

Apache License 2.0. Copyright (c) IITDEVELOPER.

