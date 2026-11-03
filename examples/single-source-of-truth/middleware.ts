import { NextResponse, type NextRequest } from 'next/server';
import { shouldRewriteToMarkdown } from '@iitdeveloper/agent-content-nextjs/proxy';

// Next.js 16 renames this file to proxy.ts (export default function proxy).
export function middleware(request: NextRequest) {
  const decision = shouldRewriteToMarkdown(request);
  if (decision.rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/agent-content${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}
