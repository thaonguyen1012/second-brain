import type { ApiProject } from '@/lib/api/work';
import type { T } from '@/lib/i18n/translate';
import { formatMoney } from './format';

// What a project row (List) and a project card (Bảng) say about one project, so both views read the same.

/** The agreed price: "800 CZK/giờ", "48.000 CZK trọn gói", or "chưa có giá". */
export function agreedPrice(p: ApiProject, t: T): string {
  return (
    (p.billing === 'hourly'
      ? p.hourlyRate && t('{money}/giờ', { money: formatMoney(p.hourlyRate, p.currency, t) })
      : p.price && t('{money} trọn gói', { money: formatMoney(p.price, p.currency, t) })) || t('chưa có giá')
  );
}

/** The meta line: "client · agreed price". */
export function projectMeta(p: ApiProject, t: T): string {
  return [p.client || t('Chưa ghi khách'), agreedPrice(p, t)].join(' · ');
}

/** "Bấm giờ" is offered for an open project whose timer is not already running. */
export function canStartTimer(p: ApiProject, running: boolean): boolean {
  return !running && (p.status === 'active' || p.status === 'planned');
}
