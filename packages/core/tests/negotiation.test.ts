import { describe, expect, it } from 'vitest';
import {
  appendVaryHeader,
  getRequestedFormat,
  parseAcceptHeader,
  shouldServeMarkdown,
  stripMarkdownExtension,
} from '../src/negotiation/index.js';

describe('Content Negotiation', () => {
  describe('parseAcceptHeader', () => {
    it('returns empty array for empty or null header', () => {
      expect(parseAcceptHeader('')).toEqual([]);
      expect(parseAcceptHeader(null)).toEqual([]);
      expect(parseAcceptHeader(undefined)).toEqual([]);
    });

    it('parses single media type with default quality 1.0', () => {
      const res = parseAcceptHeader('text/markdown');
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        mediaType: 'text/markdown',
        type: 'text',
        subtype: 'markdown',
        quality: 1.0,
        specificity: 2,
      });
    });

    it('parses multiple types with quality values and sorts descending', () => {
      const header = 'text/html, text/markdown;q=0.9, */*;q=0.8';
      const res = parseAcceptHeader(header);
      expect(res).toHaveLength(3);
      expect(res[0]?.mediaType).toBe('text/html');
      expect(res[0]?.quality).toBe(1.0);
      expect(res[1]?.mediaType).toBe('text/markdown');
      expect(res[1]?.quality).toBe(0.9);
      expect(res[2]?.mediaType).toBe('*/*');
      expect(res[2]?.quality).toBe(0.8);
      expect(res[2]?.specificity).toBe(0);
    });

    it('correctly handles q=0', () => {
      const header = 'text/markdown;q=0, text/html';
      const res = parseAcceptHeader(header);
      const markdown = res.find((e) => e.mediaType === 'text/markdown');
      expect(markdown?.quality).toBe(0);
    });
  });

  describe('appendVaryHeader', () => {
    it('returns field when existing Vary is empty or null', () => {
      expect(appendVaryHeader(undefined, 'Accept')).toBe('Accept');
      expect(appendVaryHeader(null, 'Accept')).toBe('Accept');
      expect(appendVaryHeader('', 'Accept')).toBe('Accept');
    });

    it('appends field to existing header', () => {
      expect(appendVaryHeader('Accept-Encoding', 'Accept')).toBe('Accept-Encoding, Accept');
    });

    it('does not duplicate if field already present', () => {
      expect(appendVaryHeader('Accept-Encoding, Accept', 'Accept')).toBe('Accept-Encoding, Accept');
      expect(appendVaryHeader('accept', 'Accept')).toBe('accept');
    });

    it('does not append if wildcard * is present', () => {
      expect(appendVaryHeader('*', 'Accept')).toBe('*');
    });
  });

  describe('stripMarkdownExtension', () => {
    it('strips .md from pathnames', () => {
      expect(stripMarkdownExtension('/about.md')).toBe('/about');
      expect(stripMarkdownExtension('/docs/api.MD')).toBe('/docs/api');
      expect(stripMarkdownExtension('/page')).toBe('/page');
      expect(stripMarkdownExtension('')).toBe('/');
    });
  });

  describe('getRequestedFormat', () => {
    it('prefers explicit query parameter (?format=md)', () => {
      const res = getRequestedFormat('/about?format=md', {
        accept: 'text/html',
      });
      expect(res.format).toBe('markdown');
      expect(res.source).toBe('query');
      expect(res.canonicalPath).toBe('/about');
      expect(res.shouldVaryAccept).toBe(false);
    });

    it('prefers explicit path suffix (/about.md)', () => {
      const res = getRequestedFormat('/about.md', {
        accept: 'text/html',
      });
      expect(res.format).toBe('markdown');
      expect(res.source).toBe('extension');
      expect(res.canonicalPath).toBe('/about');
      expect(res.shouldVaryAccept).toBe(false);
    });

    it('respects Accept: text/markdown header when no explicit format is specified', () => {
      const res = getRequestedFormat('/about', {
        accept: 'text/markdown',
      });
      expect(res.format).toBe('markdown');
      expect(res.source).toBe('accept-header');
      expect(res.canonicalPath).toBe('/about');
      expect(res.shouldVaryAccept).toBe(true);
    });

    it('does NOT serve markdown if q=0 in Accept header, but sets shouldVaryAccept: true (RFC 9111)', () => {
      const res = getRequestedFormat('/about', {
        accept: 'text/markdown;q=0, text/html',
      });
      expect(res.format).toBe('html');
      expect(res.source).toBe('default');
      expect(res.shouldVaryAccept).toBe(true);
    });

    it('keeps HTML for standard browser Accept header and sets shouldVaryAccept: true', () => {
      const browserAccept =
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
      const res = getRequestedFormat('/about', {
        accept: browserAccept,
      });
      expect(res.format).toBe('html');
      expect(res.source).toBe('default');
      expect(res.shouldVaryAccept).toBe(true);
    });

    it('query format overrides .md extension when both exist', () => {
      const res = getRequestedFormat('/about.md?format=html');
      expect(res.format).toBe('html');
      expect(res.source).toBe('query');
      expect(res.canonicalPath).toBe('/about');
      expect(res.shouldVaryAccept).toBe(false);
    });
  });

  describe('shouldServeMarkdown', () => {
    it('returns true when markdown is negotiated', () => {
      expect(shouldServeMarkdown('/docs.md')).toBe(true);
      expect(shouldServeMarkdown('/docs?format=md')).toBe(true);
      expect(shouldServeMarkdown('/docs', { accept: 'text/markdown' })).toBe(true);
      expect(shouldServeMarkdown('/docs', { accept: 'text/html' })).toBe(false);
    });
  });
});
