import type { Section } from '../content/types';

/** UI and styling live in the app; AgentContent never sees this file. */
export function SectionView({ section }: { section: Section }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>{section.heading}</h2>
      {section.blocks.map((block, i) =>
        block.kind === 'paragraph' ? (
          <p key={i}>{block.text}</p>
        ) : (
          <ul key={i}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </section>
  );
}
