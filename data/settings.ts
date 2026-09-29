import type { Resume } from '../src/schema/index.ts';

export const lang = 'en' satisfies Resume['lang'];

export const settings = {
  showPrompt: true,
  qr: { url: 'https://en.wikipedia.org/wiki/Dwight_Schrute', label: 'Wikipedia profile' },
} satisfies Resume['settings'];
