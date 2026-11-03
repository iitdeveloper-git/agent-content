import { describe, expect, it } from 'vitest';
import {
  createCacheControlHeader,
  generateETag,
  handleConditionalRequest,
} from '../src/cache/index.js';

describe('HTTP Caching & Headers', () => {
  describe('generateETag', () => {
    it('generates distinct ETags with md- prefix', () => {
      const etag1 = generateETag('# Content 1');
      const etag2 = generateETag('# Content 2');
      expect(etag1).toMatch(/^W\/"md-[a-f0-9]+"/);
      expect(etag2).toMatch(/^W\/"md-[a-f0-9]+"/);
      expect(etag1).not.toBe(etag2);
    });

    it('generates deterministic ETags for identical content', () => {
      const etagA = generateETag('Identical content');
      const etagB = generateETag('Identical content');
      expect(etagA).toBe(etagB);
    });
  });

  describe('createCacheControlHeader', () => {
    it('creates default cache control header', () => {
      const header = createCacheControlHeader();
      expect(header).toBe('public, max-age=3600, stale-while-revalidate=86400');
    });

    it('respects private visibility and custom maxAge', () => {
      const header = createCacheControlHeader({
        public: false,
        maxAge: 600,
        staleWhileRevalidate: 0,
      });
      expect(header).toBe('private, max-age=600');
    });

    it('allows custom override', () => {
      const header = createCacheControlHeader({
        customCacheControl: 'no-cache, no-store',
      });
      expect(header).toBe('no-cache, no-store');
    });
  });

  describe('handleConditionalRequest', () => {
    const etag = 'W/"md-123456"';
    const lastModified = new Date('2026-10-01T12:00:00Z');

    it('returns 304 if If-None-Match matches current ETag', () => {
      const result = handleConditionalRequest(
        { 'if-none-match': 'W/"md-123456"' },
        etag,
        lastModified
      );
      expect(result.status).toBe(304);
      expect(result.isNotModified).toBe(true);
      expect(result.headers['ETag']).toBe(etag);
    });

    it('returns 304 if If-None-Match contains wildcard *', () => {
      const result = handleConditionalRequest(
        { 'if-none-match': '*' },
        etag,
        lastModified
      );
      expect(result.status).toBe(304);
      expect(result.isNotModified).toBe(true);
    });

    it('returns 200 if If-None-Match does not match', () => {
      const result = handleConditionalRequest(
        { 'if-none-match': 'W/"md-999999"' },
        etag,
        lastModified
      );
      expect(result.status).toBe(200);
      expect(result.isNotModified).toBe(false);
    });

    it('evaluates If-Modified-Since when If-None-Match is absent', () => {
      // Client timestamp is newer or equal to Last-Modified
      const result = handleConditionalRequest(
        { 'if-modified-since': 'Thu, 01 Oct 2026 12:30:00 GMT' },
        etag,
        lastModified
      );
      expect(result.status).toBe(304);
      expect(result.isNotModified).toBe(true);
    });

    it('returns 200 when If-Modified-Since is older than Last-Modified', () => {
      const result = handleConditionalRequest(
        { 'if-modified-since': 'Thu, 01 Oct 2026 11:00:00 GMT' },
        etag,
        lastModified
      );
      expect(result.status).toBe(200);
      expect(result.isNotModified).toBe(false);
    });
  });
});

