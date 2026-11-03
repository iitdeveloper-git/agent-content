/**
 * Custom error hierarchy for AgentContent.
 */

export class AgentContentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'AGENT_CONTENT_ERROR', statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NegotiationError extends AgentContentError {
  constructor(message: string) {
    super(message, 'NEGOTIATION_ERROR', 400);
  }
}

export class MarkdownConversionError extends AgentContentError {
  constructor(message: string) {
    super(message, 'MARKDOWN_CONVERSION_ERROR', 500);
  }
}

export class RegistryError extends AgentContentError {
  constructor(message: string, statusCode = 404) {
    super(message, 'REGISTRY_ERROR', statusCode);
  }
}

export class SecurityError extends AgentContentError {
  constructor(message: string, statusCode = 403) {
    super(message, 'SECURITY_ERROR', statusCode);
  }
}

export class SSRFError extends SecurityError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class ContentValidationError extends AgentContentError {
  public readonly issues: unknown[];

  constructor(message: string, issues: unknown[] = []) {
    super(message, 'CONTENT_VALIDATION_ERROR', 400);
    this.issues = issues;
  }
}

