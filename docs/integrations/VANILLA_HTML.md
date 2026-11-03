# Integrating AgentContent with Vanilla HTML/CSS/JavaScript Websites

Vanilla HTML/CSS/JavaScript websites consist of static files served without a Node.js runtime. 

Because web browsers and static HTML files cannot inspect inbound HTTP headers (like `Accept: text/markdown`) client-side to change the document served by the web server, content negotiation for static websites is achieved using a **two-step strategy**:
1. **Pre-build Markdown generation**: Convert all static `.html` files into clean `.md` files and generate `llms.txt`.
2. **Web server / Host routing rules**: Configure the static host (Netlify, Vercel, Apache, Nginx) to rewrite agent requests to the corresponding `.md` file.

---

## 1. Automated Static Build via CLI

Use the AgentContent CLI to inspect your HTML directory, extract semantic structure, strip navigation and scripts, and emit Markdown counterparts alongside discovery files:

```bash
# In your static website project directory (e.g. ./public or ./dist)
npx @iitdeveloper/agent-content-cli build --dir ./public --base-url https://example.com --generate-rules
```

### What This Generates:
```
public/
├── index.html
├── index.md             # Generated Markdown for /
├── about.html
├── about.md             # Generated Markdown for /about
├── blog/
│   ├── post-1.html
│   └── post-1.md        # Generated Markdown for /blog/post-1
├── llms.txt             # RFC-compliant discovery index
├── llms-full.txt        # Complete aggregated documentation
├── _headers             # Netlify header configuration
├── .htaccess            # Apache URL rewrite configuration
└── nginx-agent-content.conf # Nginx server configuration
```

---

## 2. Linking in HTML for AI Discovery

In the `<head>` of your `index.html` and key pages, declare your discovery files and Markdown alternatives:

```html
<!-- In HTML <head> -->
<link rel="alternate" type="text/markdown" href="/index.md" title="Markdown representation">
<link rel="help" href="/llms.txt" title="AI Agent Discovery">
```

---

## 3. Host-Specific Server Routing

To enable dynamic content negotiation (`Accept: text/markdown` or `?format=md`), pair your static site with one of the hosting configurations:
- [Netlify Guide](NETLIFY.md)
- [Vercel Guide](VERCEL.md)
- [GitHub Pages Guide](GITHUB_PAGES.md)
- [Nginx Guide](NGINX.md)
- [Apache Guide](APACHE.md)

