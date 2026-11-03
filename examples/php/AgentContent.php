<?php
declare(strict_types=1);

/**
 * AgentContent PHP Integration Adapter
 *
 * Lightweight, zero-dependency PHP helper for content negotiation,
 * representation-specific caching, and Markdown delivery on Apache, Nginx, or PHP-FPM.
 */
class AgentContent {
    private string $contentDir;
    private array $options;

    public function __construct(string $contentDir = __DIR__ . '/markdown', array $options = []) {
        $this->contentDir = rtrim($contentDir, '/');
        $this->options = array_merge([
            'maxAge' => 3600,
            'staleWhileRevalidate' => 86400,
            'etagPrefix' => 'md-',
        ], $options);
    }

    /**
     * Determines whether the current request is seeking Markdown.
     */
    public function isMarkdownRequested(): bool {
        // 1. Explicit query parameter ?format=md
        if (isset($_GET['format']) && strtolower($_GET['format']) === 'md') {
            return true;
        }

        // 2. Explicit path extension .md
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        if (preg_match('/\.md$/i', $uri)) {
            return true;
        }

        // 3. HTTP Accept header
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        if (stripos($accept, 'text/markdown') !== false) {
            // Check q=0
            if (!preg_match('/text\/markdown\s*;\s*q=0(?:\.0*)?(?:,|$)/i', $accept)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Serves Markdown if requested. Returns true if handled and exited, or false if HTML should be rendered.
     */
    public function handle(): bool {
        $rawPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';

        if (!$this->isMarkdownRequested()) {
            // S-05: Emit Vary: Accept when format was not explicitly determined by query or .md extension
            if (!isset($_GET['format']) && !preg_match('/\.md$/i', $rawPath)) {
                header('Vary: Accept', false);
            }
            return false;
        }

        // S-12: Reject null bytes and decode percent-encoded characters
        $decodedUri = rawurldecode($rawPath);
        if (strpos($decodedUri, "\0") !== false) {
            http_response_code(400);
            header('Content-Type: text/plain; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            exit('Invalid request path.');
        }

        $canonicalPath = preg_replace('/\.md$/i', '', $decodedUri);
        $canonicalPath = str_replace('\\', '/', $canonicalPath);
        // Prevent path traversal sequences
        if (preg_match('/(?:\/|^)\.\.(?:\/|$)/', $canonicalPath)) {
            http_response_code(400);
            header('Content-Type: text/plain; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            exit('Path traversal attempt rejected.');
        }

        $cleanPath = trim($canonicalPath, '/');
        if ($cleanPath === '') {
            $cleanPath = 'index';
        }

        $realContentDir = realpath($this->contentDir);
        if ($realContentDir === false) {
            return false;
        }

        // Locate Markdown file
        $targetFile = $this->contentDir . '/' . $cleanPath . '.md';
        if (!file_exists($targetFile)) {
            $targetFile = $this->contentDir . '/' . $cleanPath . '/index.md';
        }

        // S-12: Strict realpath containment check
        $realTarget = realpath($targetFile);
        if ($realTarget === false || strpos($realTarget, $realContentDir) !== 0 || !is_readable($realTarget)) {
            return false; // Fall through to application
        }

        $content = file_get_contents($realTarget);
        $mtime = filemtime($realTarget);
        $etag = 'W/"' . $this->options['etagPrefix'] . md5($content) . '"';

        // Check conditional headers
        $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? null;
        if ($ifNoneMatch && (trim($ifNoneMatch) === $etag || trim($ifNoneMatch) === '*')) {
            header('HTTP/1.1 304 Not Modified');
            header('ETag: ' . $etag);
            header('Vary: Accept');
            exit;
        }

        $ifModifiedSince = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? null;
        if ($ifModifiedSince && $mtime && strtotime($ifModifiedSince) >= $mtime) {
            header('HTTP/1.1 304 Not Modified');
            header('ETag: ' . $etag);
            header('Vary: Accept');
            exit;
        }

        // Headers
        header('Content-Type: text/markdown; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: public, max-age=' . $this->options['maxAge'] . ', stale-while-revalidate=' . $this->options['staleWhileRevalidate']);
        header('ETag: ' . $etag);

        // Only emit Vary: Accept if request representation depended on Accept header
        if (!isset($_GET['format']) && !preg_match('/\.md$/i', $rawPath)) {
            header('Vary: Accept');
        }

        if ($mtime) {
            header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
            exit;
        }

        echo $content;
        exit;
    }
}
