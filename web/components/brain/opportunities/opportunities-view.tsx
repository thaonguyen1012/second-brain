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
        description="Giả thuyết kinh doanh của mình: bằng chứng ủng hộ hoặc phản bác, 4 điểm tự chấm có lịch sử và hạn quyết giữ, bỏ hay làm. Cơ hội 4 tuần không có bằng chứng mới thì bỏ."
      />
      <div className="flex flex-col gap-8 px-4 pb-12 sm:px-8">
        <OpportunityList />
        <TopicHeatmap />
      </div>
    </div>
  );
}
