'use client';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '../page-header';
import { OpportunityDetail } from './opportunity-detail';
import { OpportunityList } from './opportunity-list';
import { TopicHeatmap } from './topic-heatmap';

/**
 * /co-hoi/ lists opportunities and the topic chart; /co-hoi/?id=N shows one opportunity. A query parameter instead
 * of a dynamic segment keeps the route static (STATIC_EXPORT still builds) while all data loads in the browser.
 */
export function OpportunitiesView() {
  const raw = useSearchParams().get('id');
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  if (id !== null)
    return (
      // Same gutters and top padding as PageHeader, so the title sits where every page title sits
      <div className="flex w-full flex-col px-4 pt-10 pb-12 sm:px-8 md:pt-12">
        <OpportunityDetail key={id} id={id} />
      </div>
    );

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Cơ hội"
        nav="/co-hoi/"
        description="Giả thuyết kinh doanh: bằng chứng ủng hộ hay phản bác, điểm tự chấm và hạn quyết định giữ, bỏ hay làm."
      />
      <div className="flex flex-col gap-8 px-4 pb-12 sm:px-8">
        <OpportunityList />
        <TopicHeatmap />
      </div>
    </div>
  );
}
