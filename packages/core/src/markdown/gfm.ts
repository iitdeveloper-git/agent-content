import type TurndownService from 'turndown';

/**
 * Pure TypeScript implementation of GitHub Flavored Markdown (GFM)
 * rules for TurndownService.
 *
 * Eliminates legacy CommonJS `turndown-plugin-gfm` import quirks
 * in modern bundlers like Next.js Turbopack and Webpack.
 */

const indexOf = Array.prototype.indexOf;
const every = Array.prototype.every;

function isHeadingRow(tr: HTMLTableRowElement | HTMLElement): boolean {
  const parentNode = tr.parentNode;
  if (!parentNode) return false;
  return (
    parentNode.nodeName === 'THEAD' ||
    (parentNode.firstChild === tr &&
      (parentNode.nodeName === 'TABLE' || isFirstTbody(parentNode as HTMLElement)) &&
      every.call(tr.childNodes, (n: ChildNode) => n.nodeName === 'TH'))
  );
}

function isFirstTbody(element: HTMLElement): boolean {
  const previousSibling = element.previousSibling as HTMLElement | null;
  return (
    element.nodeName === 'TBODY' &&
    (!previousSibling ||
      (previousSibling.nodeName === 'THEAD' && /^\s*$/i.test(previousSibling.textContent || '')))
  );
}

function cell(content: string, node: HTMLElement): string {
  const index = indexOf.call(node.parentNode?.childNodes || [], node);
  let prefix = ' ';
  if (index === 0) prefix = '| ';
  return prefix + content + ' |';
}

export function gfmPlugin(turndownService: TurndownService): void {
  // 1. Strikethrough
  turndownService.addRule('strikethrough', {
    filter: (node) => {
      const name = node.nodeName.toLowerCase();
      return name === 'del' || name === 's' || name === 'strike';
    },
    replacement: (content) => `~${content}~`,
  });

  // 2. Task list items
  turndownService.addRule('taskListItems', {
    filter: (node) => {
      const input = node as HTMLInputElement;
      return input.type === 'checkbox' && input.parentNode?.nodeName === 'LI';
    },
    replacement: (_content, node) => {
      const input = node as HTMLInputElement;
      return (input.checked ? '[x]' : '[ ]') + ' ';
    },
  });

  // 3. Tables
  turndownService.keep((node) => {
    const table = node as HTMLTableElement;
    return table.nodeName === 'TABLE' && (!table.rows || !table.rows[0] || !isHeadingRow(table.rows[0]));
  });

  turndownService.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content, node) => cell(content, node as HTMLElement),
  });

  turndownService.addRule('tableRow', {
    filter: 'tr',
    replacement: (content, node) => {
      let borderCells = '';
      const alignMap: Record<string, string> = { left: ':--', right: '--:', center: ':-:' };

      const el = node as HTMLElement;
      if (isHeadingRow(el)) {
        for (let i = 0; i < el.childNodes.length; i++) {
          let border = '---';
          const child = el.childNodes[i] as HTMLElement;
          const align = (child.getAttribute ? child.getAttribute('align') || '' : '').toLowerCase();

          if (align && alignMap[align]) {
            border = alignMap[align] || border;
          }

          borderCells += cell(border, child);
        }
      }
      return '\n' + content + (borderCells ? '\n' + borderCells : '');
    },
  });

  turndownService.addRule('table', {
    filter: (node) => {
      const table = node as HTMLTableElement;
      return table.nodeName === 'TABLE' && table.rows && table.rows[0] !== undefined && isHeadingRow(table.rows[0]);
    },
    replacement: (content) => {
      const cleanContent = content.replace(/\n\n+/g, '\n');
      return '\n\n' + cleanContent + '\n\n';
    },
  });

  turndownService.addRule('tableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: (content) => content,
  });
}
