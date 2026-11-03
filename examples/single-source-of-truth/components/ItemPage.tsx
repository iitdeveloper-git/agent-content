import type { SiteItem } from '../content/types';
import { SectionView } from './SectionView';

export function ItemPage({ item }: { item: SiteItem }) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem' }}>
      <h1>{item.title}</h1>
      <p>{item.summary}</p>
      {item.sections.map((section) => (
        <SectionView key={section.heading} section={section} />
      ))}
      <footer>Updated {item.updatedAt}</footer>
    </main>
  );
}
