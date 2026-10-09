// Chrome silently draws a character missing from the font files with a system font, so the PDF
// would change from one machine to another. Every text of the resume must be drawn with a font
// loaded through @font-face (styles/fonts.css), whatever its name: Chrome reports those fonts as
// custom fonts, and system fonts as platform fonts.

import type { CDPSession, Page, Protocol } from 'puppeteer';

const PROBE_CLASS = 'font-check-probe';
const TEXT_NODE = 3;

type DomNode = Protocol.DOM.Node;

interface FallbackElement extends DomNode {
  fonts: string[];
}

interface FallbackCharacter {
  character: string;
  fonts: string[];
}

const ownText = (node: DomNode) =>
  (node.children ?? [])
    .filter((child) => child.nodeType === TEXT_NODE)
    .map((child) => child.nodeValue)
    .join('');

const collectTextElements = (node: DomNode): DomNode[] => [
  ...(ownText(node).trim() ? [node] : []),
  ...(node.children ?? []).flatMap(collectTextElements),
];

const getAttribute = (node: DomNode, name: string) => node.attributes?.[node.attributes.indexOf(name) + 1];

const queryAll = async (session: CDPSession, selector: string) => {
  const { root } = await session.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await session.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
  const nodes = new Map<number, DomNode>();
  const index = (node: DomNode) => {
    nodes.set(node.nodeId, node);
    node.children?.forEach(index);
  };
  index(root);
  return nodeIds.map((nodeId) => nodes.get(nodeId)!);
};

const getSystemFonts = async (session: CDPSession, nodeId: number) => {
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  return fonts.filter((font) => !font.isCustomFont).map((font) => font.familyName);
};

const callOn = async (session: CDPSession, nodeId: number, functionDeclaration: string, args: unknown[]) => {
  const { object } = await session.send('DOM.resolveNode', { nodeId });
  await session.send('Runtime.callFunctionOn', {
    objectId: object.objectId!,
    functionDeclaration,
    arguments: args.map((value) => ({ value })),
  });
};

// Chrome reports the fonts of a whole element, not per character: each character is drawn
// alone in a probe that inherits the element's font.
// - Each probe is an inline-block, so Chrome does not shape characters across probes (an emoji
//   sequence would be reported on its first character only).
// - All probes are created before the document is read again, and layout is forced: Chrome does
//   not refresh the fonts of a node whose text changes, nor of a node not laid out yet.
// - They are left in the page: this only runs when the check fails, and no PDF is printed then.
const findFallbackCharacters = async (session: CDPSession, elements: readonly FallbackElement[]) => {
  for (const [index, element] of elements.entries()) {
    const characters = [...new Set(ownText(element))].filter((character) => character.trim());
    await callOn(
      session,
      element.nodeId,
      `function (className, index, characters) {
        for (const character of characters) {
          const probe = this.appendChild(document.createElement('span'));
          probe.className = className;
          probe.style.display = 'inline-block';
          probe.dataset.element = index;
          probe.textContent = character;
        }
        this.getBoundingClientRect();
      }`,
      [PROBE_CLASS, index, characters],
    );
  }
  const found = elements.map((): FallbackCharacter[] => []);
  for (const probe of await queryAll(session, `.${PROBE_CLASS}`)) {
    const fonts = await getSystemFonts(session, probe.nodeId);
    if (fonts.length) found[Number(getAttribute(probe, 'data-element'))]!.push({ character: ownText(probe), fonts });
  }
  return found;
};

const formatCodePoint = (character: string) =>
  `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

const formatText = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
};

// Throws, naming each character, its text and the system font, if any text inside the element
// matching `selector` is drawn with a system font.
export const assertNoFallbackFonts = async (page: Page, selector = '#cv') => {
  const session = await page.createCDPSession();
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const [container] = await queryAll(session, selector);
    if (!container) throw new Error(`Font check: no element matches ${selector}`);
    const elements: FallbackElement[] = [];
    for (const element of collectTextElements(container)) {
      const fonts = await getSystemFonts(session, element.nodeId);
      if (fonts.length) elements.push({ ...element, fonts });
    }
    if (!elements.length) return;
    const characters = await findFallbackCharacters(session, elements);
    const problems = elements.flatMap((element, index) => {
      const text = formatText(ownText(element));
      const elementCharacters = characters[index] ?? [];
      // A sequence can fall back while none of its characters does alone.
      if (!elementCharacters.length) return [`"${text}", drawn with ${element.fonts.join(', ')}`];
      return elementCharacters.map(
        ({ character, fonts }) =>
          `"${character}" (${formatCodePoint(character)}) in "${text}", drawn with ${fonts.join(', ')}`,
      );
    });
    throw new Error(
      `Characters missing from the fonts in assets/fonts, drawn with a system font:\n  ${problems.join('\n  ')}`,
    );
  } finally {
    await session.detach();
  }
};

// Runs in the page. Lists the texts whose family, weight and style match no @font-face rule: Chrome
// then synthesizes the style from another file (slanted glyphs for italic, thickened ones for bold)
// without reporting it. A slanted text is read letter by letter by macOS Preview (PDFKit).
const FIND_SYNTHESIZED_TEXTS = `(selector) => {
  const unquote = (family) => family.trim().replace(/^["']|["']$/g, '');
  const listRules = (sheet) => [...sheet.cssRules].flatMap((rule) =>
    rule instanceof CSSImportRule ? (rule.styleSheet ? listRules(rule.styleSheet) : [])
      : rule instanceof CSSFontFaceRule ? [rule] : []);
  const describe = (family, weight, style) => family + ' ' + Number(weight) + ' ' + (style || 'normal');
  const declared = new Set([...document.styleSheets].flatMap(listRules).map((rule) =>
    describe(unquote(rule.style.getPropertyValue('font-family')), rule.style.getPropertyValue('font-weight'),
      rule.style.getPropertyValue('font-style'))));
  const walker = document.createTreeWalker(document.querySelector(selector), NodeFilter.SHOW_TEXT);
  const found = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.data.trim()) continue;
    const style = getComputedStyle(node.parentElement);
    const face = describe(unquote(style.fontFamily.split(',')[0]), style.fontWeight, style.fontStyle);
    if (!declared.has(face)) found.push({ text: node.data, face });
  }
  return found;
}`;

// Throws, naming each text and its style, if any text inside the element matching `selector` is
// drawn in a style that no font file in assets/fonts provides.
export const assertNoSynthesizedFonts = async (page: Page, selector = '#cv') => {
  const found = (await page.evaluate(`(${FIND_SYNTHESIZED_TEXTS})(${JSON.stringify(selector)})`)) as {
    text: string;
    face: string;
  }[];
  if (!found.length) return;
  const problems = found.map(({ text, face }) => `"${formatText(text)}" in ${face}`);
  throw new Error(
    `Text in a style missing from the fonts in assets/fonts, synthesized by Chrome:\n  ${problems.join('\n  ')}`,
  );
};
