import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { agentContent } from '../../agent-content.config';
import { ItemPage } from '../../components/ItemPage';
import { getItem } from '../../content/site';

// Only routes that exist as published pages are generated; drafts get a 404 for HTML and Markdown alike.
export const dynamicParams = false;

export function generateStaticParams() {
  return agentContent
    .listPages({ status: 'published' })
    .filter((page) => page.url !== '/')
    .map((page) => ({ slug: page.url.slice(1) }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = getItem(`/${(await params).slug}`);
  return item ? { title: item.title, description: item.summary } : {};
}

export default async function Page({ params }: Params) {
  const item = getItem(`/${(await params).slug}`);
  if (!item || item.status !== 'published') notFound();
  return <ItemPage item={item} />;
}
