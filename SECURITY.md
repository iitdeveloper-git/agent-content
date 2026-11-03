# Security Policy — AgentContent

At **IITDEVELOPER**, security is treated as a first-class feature across our developer infrastructure and open-source projects.

---

## 1. Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported | Status |
| :--- | :--- | :--- |
| `0.1.x` | :white_check_mark: | Current Active Development |
| `< 0.1.0` | :x: | Unsupported Pre-release |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability or potential threat in AgentContent (such as an SSRF bypass, path traversal vector, cache poisoning condition, or denial-of-service vector):

1. **DO NOT** open a public GitHub issue.
2. Send an email directly to: **security@iitdeveloper.com**
3. Include the following details:
   - Detailed description of the vulnerability.
   - Affected package(s) (`@iitdeveloper/agent-content`, `@iitdeveloper/agent-content-nextjs`, `@iitdeveloper/agent-content-node`, `@iitdeveloper/agent-content-cli`).
   - Minimal reproducible proof of concept (PoC) or HTTP request payload.
   - Assessment of potential impact and suggested remediation if available.

### Response Timelines
- **Initial Acknowledgment:** Within 24 hours.
- **Triage & Severity Assessment:** Within 48 hours.
- **Fix & Coordinated Disclosure:** We aim to release a patched version within 7 business days for critical vulnerabilities.

---

## 3. Security Design Principles

AgentContent incorporates built-in defensive protections:
1. **Strict Path Traversal Protection:** Input path normalization rejects null bytes, directory traversal patterns (`..`), and unsafe path characters.
2. **SSRF Guarding:** Remote URL fetching (when explicitly configured) forbids loopback (`127.0.0.0/8`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata IP ranges (`169.254.169.254`).
3. **Information Disclosure Prevention:** Unpublished draft pages, authenticated routes, and internal error stack traces are never exposed in public HTTP representations.
4. **Cache Poisoning Defense:** Distinct representation ETags and explicit `Vary: Accept` prevent intermediate reverse proxies or CDNs from caching Markdown for standard HTML browser visitors.
5. **Denial-of-Service Defense:** Maximum request and response payload size limits prevent parser memory exhaustion.

