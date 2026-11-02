'use client';
import { useEffect, useState, type ComponentType } from 'react';
import { shouldOfferMigration } from '@/lib/progress/migration';

/**
 * "Chuyển tiến độ học cũ lên server": a synchronous localStorage check, then the banner is loaded on demand,
 * so the home page bundle stays small for everyone who has nothing to move.
 */
export function ProgressMigrationOffer() {
  const [Banner, setBanner] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!shouldOfferMigration()) return;
    let alive = true;
    void import('./progress-migration-banner').then((m) => {
      if (alive) setBanner(() => m.ProgressMigrationBanner);
    });
    return () => {
      alive = false;
    };
  }, []);
  return Banner ? <Banner /> : null;
}
