import type { Metadata } from 'next';
import { ItemPage } from '../components/ItemPage';
import { getItem } from '../content/site';

const home = getItem('/')!;

// Same source as the Markdown frontmatter: no second copy of the title or description.
export const metadata: Metadata = { title: home.title, description: home.summary };

export default function HomePage() {
  return <ItemPage item={home} />;
}
