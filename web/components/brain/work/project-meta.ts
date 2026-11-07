import type { ApiProject } from '@/lib/api/work';
import { formatMoney } from './format';

// What a project row (List) and a project card (Bảng) say about one project, so both views read the same.

/** The agreed price: "800 CZK/giờ", "48.000 CZK trọn gói", or "chưa có giá". */
export function agreedPrice(p: ApiProject): string {
  return (
    (p.billing === 'hourly'
      ? p.hourlyRate && `${formatMoney(p.hourlyRate, p.currency)}/giờ`
      : p.price && `${formatMoney(p.price, p.currency)} trọn gói`) || 'chưa có giá'
  );
}

/** The meta line: "client · agreed price". */
export function projectMeta(p: ApiProject): string {
  return [p.client || 'Chưa ghi khách', agreedPrice(p)].join(' · ');
}

/** "Bấm giờ" is offered for an open project whose timer is not already running. */
export function canStartTimer(p: ApiProject, running: boolean): boolean {
  return !running && (p.status === 'active' || p.status === 'planned');
}
