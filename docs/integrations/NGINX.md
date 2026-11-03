# Nginx Integration Guide

Nginx can handle HTTP content negotiation, representation-specific headers, and static Markdown routing at high concurrency.

---

## 1. Nginx Server Block Configuration

Include the following rules in your server configuration (e.g. `/etc/nginx/sites-available/default`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com;
    root /var/www/html;
    index index.html;

    # 1. Correct MIME Type & Headers for Markdown
    location ~* \.md$ {
        default_type text/markdown;
        charset utf-8;
        add_header X-Content-Type-Options nosniff always;
        add_header Cache-Control "public, max-age=3600, stale-while-revalidate=86400" always;
    }

    # 2. Discovery Endpoints
    location = /llms.txt {
        default_type text/plain;
        charset utf-8;
        add_header X-Content-Type-Options nosniff always;
        add_header Cache-Control "public, max-age=3600" always;
    }

    location = /llms-full.txt {
        default_type text/plain;
        charset utf-8;
        add_header X-Content-Type-Options nosniff always;
        add_header Cache-Control "public, max-age=3600" always;
    }

    # 3. Dynamic Content Negotiation
    location / {
        # Check if client explicitly requests Markdown
        set $serve_md 0;
        
        if ($http_accept ~* "text/markdown") {
            set $serve_md 1;
        }
        if ($arg_format = "md") {
            set $serve_md 1;
        }

        # If Markdown requested, rewrite internally to .md
        if ($serve_md = 1) {
            rewrite ^(.*)$ $1.md last;
        }

        try_files $uri $uri/ $uri.html =404;
    }
}
```

---

## 2. Testing Your Nginx Deployment

```bash
# Test Nginx syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Verify negotiation with curl
curl -I -H "Accept: text/markdown" https://example.com/about
# Expected: Content-Type: text/markdown; charset=utf-8
```

