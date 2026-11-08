// The English dictionaries. Import this only from server code (app/[lang]/layout.tsx, lib/i18n/server.ts): the
// layout sends `enPage` to the browser inside the page's RSC payload, so no client bundle carries English text and
// Vietnamese pages carry none at all. intro and guides are left out of `enPage`: their components load lazily and
// import their own dictionary (useT(intro), useT(guides)).
import type { Dictionary } from '../translate';
import { common } from './common';
import { growth } from './growth';
import { guides } from './guides';
import { inbox } from './inbox';
import { intro } from './intro';
import { library } from './library';
import { opportunities } from './opportunities';
import { shell } from './shell';
import { today } from './today';
import { week } from './week';
import { work } from './work';

/** What every English page sends to its client components. */
export const enPage: Dictionary = {
  ...common,
  ...shell,
  ...today,
  ...inbox,
  ...library,
  ...week,
  ...work,
  ...opportunities,
  ...growth,
};

/** Everything, for server components (getT). */
export const enAll: Dictionary = { ...enPage, ...intro, ...guides };

/** Each area by name, for lib/i18n/coverage.test.ts (one key may live in one file only). */
export const enAreas = { common, shell, today, inbox, library, week, work, opportunities, growth, intro, guides };
