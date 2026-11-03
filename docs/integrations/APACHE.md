# Apache HTTP Server Integration Guide

Apache provides module-level URL rewriting (`mod_rewrite`) and header injection (`mod_headers`) via `.htaccess` or virtual host configuration.

---

## 1. `.htaccess` Configuration

Place the following configuration in your website root:

```apache
# Enable Rewrite Engine
<IfModule mod_rewrite.c>
  RewriteEngine On

  # 1. Content Negotiation: Accept: text/markdown
  RewriteCond %{HTTP_ACCEPT} text/markdown [NC]
  RewriteCond %{REQUEST_FILENAME}\.md -f
  RewriteRule ^(.*)$ $1.md [L]

  # 2. Query Parameter: ?format=md
  RewriteCond %{QUERY_STRING} (?:^|&)format=md(?:&|$) [NC]
  RewriteCond %{REQUEST_FILENAME}\.md -f
  RewriteRule ^(.*)$ $1.md [L]
</IfModule>

# Set Headers for Markdown and Discovery files
<IfModule mod_headers.c>
  <FilesMatch "\.md$">
    Header set Content-Type "text/markdown; charset=utf-8"
    Header set X-Content-Type-Options "nosniff"
    Header set Cache-Control "public, max-age=3600, stale-while-revalidate=86400"
    Header append Vary "Accept"
  </FilesMatch>

  <FilesMatch "^llms(-full)?\.txt$">
    Header set Content-Type "text/plain; charset=utf-8"
    Header set X-Content-Type-Options "nosniff"
    Header set Cache-Control "public, max-age=3600"
  </FilesMatch>
</IfModule>
```

---

## 2. Requirements

- `mod_rewrite` must be enabled (`a2enmod rewrite`).
- `mod_headers` must be enabled (`a2enmod headers`).
- `AllowOverride All` must be permitted in the Apache VirtualHost block for `.htaccess` rules to execute.

