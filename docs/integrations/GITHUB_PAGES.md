# GitHub Pages Integration Guide

GitHub Pages is a static-only hosting service backed by Fastly.

---

## 1. Capabilities and Limitations

| Feature | Supported on GitHub Pages | Notes |
| :--- | :--- | :--- |
| **Pre-built `.md` URLs** | :white_check_mark: | Direct visits to `/page.md` serve raw Markdown. |
| **`llms.txt` Discovery** | :white_check_mark: | `/llms.txt` served from repository root or `docs/`. |
| **`Accept` Header Negotiation** | :x: | GitHub Pages does not allow custom routing or edge rewrites. |
| **Custom Headers (`Content-Type`)**| :x: | Fastly serves `.md` as `text/plain; charset=utf-8`. |

---

## 2. GitHub Actions Automated Pipeline

Add a workflow to generate `.md` representations and `llms.txt` on every push in `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Generate AgentContent Markdown & llms.txt
        run: |
          npx @iitdeveloper/agent-content-cli build --dir ./docs --base-url https://username.github.io/repo

      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

---

## 3. Discoverability via `<link>` Tags

Because GitHub Pages does not support header negotiation, add link headers in the `<head>` of your HTML templates:

```html
<link rel="alternate" type="text/markdown" href="https://username.github.io/repo/index.md">
<link rel="help" href="https://username.github.io/repo/llms.txt">
```

AI agents that inspect HTML headers or follow standard discovery links will locate the `.md` files directly.

