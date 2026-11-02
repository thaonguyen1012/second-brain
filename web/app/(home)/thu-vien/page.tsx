import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LibraryPage } from '@/components/brain/library-page';

export const metadata: Metadata = { title: 'Thư viện' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Thư viện"
        description="Sách, phim, khóa học, bài viết và dự án, lọc theo loại và trạng thái. Ghi chú sẽ có ở bước sau."
      />
      <LibraryPage />
    </div>
  );
}
