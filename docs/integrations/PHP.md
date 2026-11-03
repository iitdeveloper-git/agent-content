# PHP & WordPress Integration Guide

PHP websites (custom PHP, Laravel, Symfony, WordPress) can deliver negotiated Markdown without requiring a Node.js runtime on the production server.

---

## 1. Single-File PHP Adapter (`AgentContent.php`)

Include the zero-dependency `AgentContent.php` class (available in `examples/php/AgentContent.php`):

```php
<?php
require_once __DIR__ . '/AgentContent.php';

$agent = new AgentContent(__DIR__ . '/markdown', [
    'maxAge' => 3600,
    'staleWhileRevalidate' => 86400,
]);

// Checks for Accept: text/markdown, ?format=md, or .md requests
// If matched, outputs Markdown with correct headers and exits cleanly
$agent->handle();

// If not matched, regular PHP execution continues:
renderHtmlPage();
```

---

## 2. WordPress Integration Pattern

In WordPress, you can hook into the `template_redirect` action inside your theme's `functions.php` or a dedicated mu-plugin:

```php
add_action('template_redirect', function () {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $format = $_GET['format'] ?? '';

    $isMarkdown = (stripos($accept, 'text/markdown') !== false) || (strtolower($format) === 'md');
    
    if (!$isMarkdown || !is_singular()) {
        return; // Continue standard WordPress HTML rendering
    }

    global $post;
    if (!$post || $post->post_status !== 'publish') {
        return;
    }

    // Prepare headers
    header('Content-Type: text/markdown; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Vary: Accept');

    // Build clean Markdown representation
    $title = get_the_title($post);
    $content = wp_strip_all_tags(apply_filters('the_content', $post->post_content));
    $permalink = get_permalink($post);

    echo "---\n";
    echo "title: " . addslashes($title) . "\n";
    echo "canonical_url: " . $permalink . "\n";
    echo "---\n\n";
    echo "# " . $title . "\n\n";
    echo $content;
    exit;
});
```

### Static WordPress Alternative
For high-traffic WordPress sites using static site generators or caching plugins (WP Super Cache, Simply Static), run the AgentContent CLI against the exported static directory:

```bash
npx @iitdeveloper/agent-content-cli build --dir ./wp-static-export --base-url https://my-blog.com
```
This automatically produces all `.md` files and `llms.txt` without custom PHP execution.

