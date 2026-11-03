import { SecurityError, SSRFError } from '../errors/index.js';
import type { SecurityOptions } from '../types/index.js';

export interface SSRFValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * Normalizes and validates an HTTP request path against directory traversal attacks.
 * Rejects null bytes, path traversal sequences (..), and invalid characters.
 */
export function validateAndNormalizePath(rawPath: string): string {
  if (typeof rawPath !== 'string') {
    throw new SecurityError('Invalid path: path must be a string.', 400);
  }

  // Detect and reject null bytes (%00 or \0)
  if (rawPath.includes('\0') || /%00/i.test(rawPath)) {
    throw new SecurityError('Path traversal detected: null byte in path.', 400);
  }

  // Decode URI components safely
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    // Malformed URI encoding
    throw new SecurityError('Malformed URI encoding in path.', 400);
  }

  // Detect directory traversal patterns (.. or \..)
  if (/(?:^|\/|\\)\.\.(?:\/|\\|$)/.test(decoded) || /\.\./.test(decoded)) {
    throw new SecurityError('Path traversal attempt rejected.', 400);
  }

  // Normalize duplicate and backslashes
  let normalized = decoded.replace(/\\/g, '/').replace(/\/+/g, '/');

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  return normalized;
}

/**
 * Validates whether a normalized path is permitted by an allowlist.
 */
export function isPathAllowed(path: string, allowedPaths?: string[]): boolean {
  if (!allowedPaths || allowedPaths.length === 0) {
    return true;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return allowedPaths.some((allowed) => {
    const normAllowed = allowed.startsWith('/') ? allowed : `/${allowed}`;
    if (normalized === normAllowed) return true;
    const prefix = normAllowed.endsWith('/') ? normAllowed : `${normAllowed}/`;
    return normalized.startsWith(prefix);
  });
}

/**
 * Checks if an IPv4 address falls within private, loopback, multicast, or reserved ranges
 * according to IANA Special-Purpose IPv4 Address Registry.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [p0 = 0, p1 = 0, p2 = 0] = parts;

  // 0.0.0.0/8 (Current network / "This host on this network")
  if (p0 === 0) return true;

  // 10.0.0.0/8 (Private-Use)
  if (p0 === 10) return true;

  // 100.64.0.0/10 (Shared Address Space / CGNAT: 100.64.0.0 - 100.127.255.255)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
  if (p0 === 169 && p1 === 254) return true;

  // 172.16.0.0/12 (Private-Use: 172.16.0.0 - 172.31.255.255)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments, including Oracle Cloud metadata 192.0.0.192)
  if (p0 === 192 && p1 === 0 && p2 === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1 documentation)
  if (p0 === 192 && p1 === 0 && p2 === 2) return true;

  // 192.168.0.0/16 (Private-Use)
  if (p0 === 192 && p1 === 168) return true;

  // 198.18.0.0/15 (Benchmarking: 198.18.0.0 - 198.19.255.255)
  if (p0 === 198 && (p1 === 18 || p1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2 documentation)
  if (p0 === 198 && p1 === 51 && p2 === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3 documentation)
  if (p0 === 203 && p1 === 0 && p2 === 113) return true;

  // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
  if (p0 >= 224 && p0 <= 239) return true;

  // 240.0.0.0/4 (Reserved for future use: 240.0.0.0 - 255.255.255.254)
  if (p0 >= 240 && p0 <= 255) return true;

  // 255.255.255.255 (Limited Broadcast)
  if (p0 === 255 && p1 === 255 && p2 === 255 && parts[3] === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address falls within private, loopback, unique local, link-local,
 * or embedded IPv4 special-purpose ranges according to IANA Special-Purpose IPv6 Registry.
 */
export function isPrivateIPv6(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/^\[|\]$/g, '');

  // ::1 loopback and :: unspecified
  if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1' || clean === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // fe80::/10 link-local unicast (fe80:: - febf::)
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) {
    return true;
  }

  // fec0::/10 deprecated site-local unicast (fec0:: - feff::)
  if (clean.startsWith('fec') || clean.startsWith('fed') || clean.startsWith('fee') || clean.startsWith('fef')) {
    return true;
  }

  // fc00::/7 unique local unicast (fc00:: and fd00::)
  if (clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }

  // 2001:db8::/32 documentation
  if (clean.startsWith('2001:db8:') || clean.startsWith('2001:0db8:')) {
    return true;
  }

  // 2002::/16 6to4 prefix (embeds 32-bit IPv4 in 2nd and 3rd 16-bit words)
  if (clean.startsWith('2002:')) {
    const parts = clean.split(':');
    const w1 = parseInt(parts[1] || '0', 16);
    const w2 = parseInt(parts[2] || '0', 16);
    if (!isNaN(w1) && !isNaN(w2)) {
      const p0 = (w1 >> 8) & 0xff;
      const p1 = w1 & 0xff;
      const p2 = (w2 >> 8) & 0xff;
      const p3 = w2 & 0xff;
      if (isPrivateIPv4(`${p0}.${p1}.${p2}.${p3}`)) {
        return true;
      }
    }
  }

  // 64:ff9b::/96 and 64:ff9b:1::/48 IPv4-IPv6 translation
  if (clean.startsWith('64:ff9b:') || clean.startsWith('0064:ff9b:')) {
    const lastPart = clean.split(':').pop() || '';
    if (lastPart.includes('.')) {
      return isPrivateIPv4(lastPart);
    }
    // Hex representation
    const hexWords = clean.split(':').filter(Boolean);
    if (hexWords.length >= 2) {
      const w1 = parseInt(hexWords[hexWords.length - 2] || '0', 16);
      const w2 = parseInt(hexWords[hexWords.length - 1] || '0', 16);
      if (!isNaN(w1) && !isNaN(w2)) {
        const p0 = (w1 >> 8) & 0xff;
        const p1 = w1 & 0xff;
        const p2 = (w2 >> 8) & 0xff;
        const p3 = w2 & 0xff;
        return isPrivateIPv4(`${p0}.${p1}.${p2}.${p3}`);
      }
    }
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:0:0/96, e.g. ::ffff:127.0.0.1 or WHATWG hex format ::ffff:7f00:1)
  if (clean.startsWith('::ffff:') || clean.startsWith('0:0:0:0:0:ffff:')) {
    const suffix = clean.replace(/^(::ffff:|0:0:0:0:0:ffff:)/, '');
    if (suffix.includes('.')) {
      return isPrivateIPv4(suffix);
    }
    // Hex notation: two 16-bit hex words (e.g. 7f00:1)
    const hexParts = suffix.split(':');
    const w1 = parseInt(hexParts[0] || '0', 16);
    const w2 = parseInt(hexParts[1] || '0', 16);
    if (!isNaN(w1) && !isNaN(w2)) {
      const p0 = (w1 >> 8) & 0xff;
      const p1 = w1 & 0xff;
      const p2 = (w2 >> 8) & 0xff;
      const p3 = w2 & 0xff;
      return isPrivateIPv4(`${p0}.${p1}.${p2}.${p3}`);
    }
    return true;
  }

  return false;
}

/**
 * Checks whether a hostname matches known loopback, internal, or metadata hostnames.
 */
function isDisallowedHostname(hostname: string): boolean {
  // Normalize: strip trailing dot (FQDN representation, e.g. localhost.)
  const normalized = hostname.replace(/\.$/, '').toLowerCase();

  // Exact loopback and metadata names
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'metadata.google.internal' ||
    normalized === 'instance-data'
  ) {
    return true;
  }

  // Domain suffixes
  if (
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.google.internal') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF vulnerabilities (synchronous check).
 * Forbids private IPs, loopback, cloud metadata (169.254.169.254), internal domains, and non-HTTP protocols.
 */
export function validateUrlForSSRF(
  targetUrl: string,
  options?: {
    allowedHosts?: string[];
    allowHttp?: boolean;
  }
): SSRFValidationResult {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL format.' };
  }

  // Protocol check: only http and https allowed
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      safe: false,
      reason: `Disallowed protocol "${protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  // Normalize hostname: strip enclosing brackets and trailing dot
  const rawHostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const cleanHostname = rawHostname.replace(/\.$/, '');

  // Host allowlist check
  if (options?.allowedHosts && options.allowedHosts.length > 0) {
    const isAllowed = options.allowedHosts.some(
      (h) => h.toLowerCase().replace(/\.$/, '') === cleanHostname
    );
    if (!isAllowed) {
      return {
        safe: false,
        reason: `Host "${cleanHostname}" is not in the allowed hosts list.`,
      };
    }
  }

  // Forbidden hostnames (localhost, *.localhost, *.internal, metadata.google.internal, *.local)
  if (isDisallowedHostname(rawHostname)) {
    return { safe: false, reason: `Access to internal hostname "${cleanHostname}" is blocked.` };
  }

  // Check direct IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHostname)) {
    if (isPrivateIPv4(cleanHostname)) {
      return { safe: false, reason: `Access to private IPv4 address "${cleanHostname}" is blocked.` };
    }
  }

  // Check direct IPv6
  if (cleanHostname.includes(':')) {
    if (isPrivateIPv6(cleanHostname)) {
      return { safe: false, reason: `Access to private IPv6 address "${cleanHostname}" is blocked.` };
    }
  }

  return { safe: true };
}

/**
 * Resolves a hostname via DNS and verifies that all resolved IP addresses are public.
 * Protects against public-domain-to-private-IP attacks (e.g. nip.io) and fails closed on DNS lookup errors.
 */
export async function resolveAndValidateDns(hostname: string): Promise<SSRFValidationResult> {
  const cleanHostname = hostname.replace(/\.$/, '').replace(/^\[|\]$/g, '');

  // If already an IPv4 address, validate directly
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHostname)) {
    if (isPrivateIPv4(cleanHostname)) {
      return { safe: false, reason: `Access to private IPv4 address "${cleanHostname}" is blocked.` };
    }
    return { safe: true };
  }

  // If already an IPv6 address, validate directly
  if (cleanHostname.includes(':')) {
    if (isPrivateIPv6(cleanHostname)) {
      return { safe: false, reason: `Access to private IPv6 address "${cleanHostname}" is blocked.` };
    }
    return { safe: true };
  }

  try {
    const dns = await import('node:dns/promises').catch(() => null);
    if (dns) {
      const addresses = await dns.lookup(cleanHostname, { all: true });
      if (!addresses || addresses.length === 0) {
        return {
          safe: false,
          reason: `DNS resolution returned no addresses for "${cleanHostname}".`,
        };
      }
      for (const entry of addresses) {
        if (entry.family === 4 && isPrivateIPv4(entry.address)) {
          return {
            safe: false,
            reason: `DNS resolution for "${cleanHostname}" returned private IPv4 address "${entry.address}".`,
          };
        }
        if (entry.family === 6 && isPrivateIPv6(entry.address)) {
          return {
            safe: false,
            reason: `DNS resolution for "${cleanHostname}" returned private IPv6 address "${entry.address}".`,
          };
        }
      }
    }
  } catch (err: unknown) {
    // Fail closed: a DNS resolution failure must not allow the request to proceed
    const message = err instanceof Error ? err.message : String(err);
    return {
      safe: false,
      reason: `DNS resolution failed for "${cleanHostname}": ${message}`,
    };
  }

  return { safe: true };
}

/**
 * Safely fetches a remote URL with strict SSRF defense, DNS resolution check,
 * timeout, redirect verification, and maximum response payload size limit.
 */
export async function safeFetchUrl(
  targetUrl: string,
  options?: SecurityOptions
): Promise<string> {
  const timeoutMs = options?.requestTimeoutMs ?? 5000;
  const maxBytes = options?.maxOutputSizeBytes ?? options?.maxRequestSizeBytes ?? 5 * 1024 * 1024; // 5MB

  // 1. Initial SSRF check (if ssrfProtection is not explicitly false)
  if (options?.ssrfProtection !== false) {
    const ssrfCheck = validateUrlForSSRF(targetUrl, {
      allowedHosts: options?.allowedHosts,
    });

    if (!ssrfCheck.safe) {
      throw new SSRFError(`SSRF blocked: ${ssrfCheck.reason}`);
    }

    const dnsCheck = await resolveAndValidateDns(new URL(targetUrl).hostname);
    if (!dnsCheck.safe) {
      throw new SSRFError(`SSRF blocked: ${dnsCheck.reason}`);
    }
  }

  // 2. Fetch with manual redirect handling to re-validate each hop
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = targetUrl;
    let redirectCount = 0;
    const maxRedirects = 3;

    while (redirectCount <= maxRedirects) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AgentContent/0.1.0 (+https://github.com/iitdeveloper-git/agent-content)',
          Accept: 'text/html, text/markdown;q=0.9, */*;q=0.8',
        },
      });

      // Handle redirects manually to inspect target URL
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new SecurityError('Redirect response without Location header.', 400);
        }

        const nextUrl = new URL(location, currentUrl).toString();

        if (options?.ssrfProtection !== false) {
          const nextCheck = validateUrlForSSRF(nextUrl, {
            allowedHosts: options?.allowedHosts,
          });

          if (!nextCheck.safe) {
            throw new SSRFError(`SSRF redirect blocked to "${nextUrl}": ${nextCheck.reason}`);
          }

          const nextDns = await resolveAndValidateDns(new URL(nextUrl).hostname);
          if (!nextDns.safe) {
            throw new SSRFError(`SSRF redirect blocked to "${nextUrl}": ${nextDns.reason}`);
          }
        }

        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      if (!response.ok) {
        throw new SecurityError(`Remote request failed with HTTP ${response.status}`, response.status);
      }

      // Check Content-Length header if present
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const len = parseInt(contentLengthHeader, 10);
        if (!isNaN(len) && len > maxBytes) {
          throw new SecurityError(`Response size (${len} bytes) exceeds limit of ${maxBytes} bytes.`, 413);
        }
      }

      // Read response body with streaming size enforcement
      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        const textByteLength = new TextEncoder().encode(text).length;
        if (textByteLength > maxBytes) {
          throw new SecurityError(`Response exceeds size limit of ${maxBytes} bytes.`, 413);
        }
        return text;
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > maxBytes) {
            reader.cancel();
            throw new SecurityError(`Response size exceeded limit of ${maxBytes} bytes.`, 413);
          }
          chunks.push(value);
        }
      }

      // Merge chunks using standard Uint8Array
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      return new TextDecoder('utf-8').decode(merged);
    }

    throw new SecurityError('Too many redirects encountered while fetching URL.', 400);
  } catch (err: unknown) {
    if (err instanceof SecurityError || err instanceof SSRFError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new SecurityError(`Safe fetch failed: ${message}`, 500);
  } finally {
    clearTimeout(timeoutId);
  }
}
