'use client';
import { useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ApiNote } from '@/lib/api/library';
import { useRoutePathname } from '@/lib/use-app-pathname';
import { NotePageView } from './note-page';
import { NotesPage } from './notes-page';

/** The note the URL names: a number, `new`, or null for the list. */
function noteParam(raw: string | null): number | 'new' | null {
  if (raw === 'new') return 'new';
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

/**
 * The page header of the notes list, hidden on a note's page (`?id=`): the header is server-rendered (it is also this
 * component's Suspense fallback, so the static shell shows it), the note page has its own back link instead.
 */
export function UnlessNote({ children }: { children: ReactNode }) {
  return noteParam(useSearchParams().get('id')) === null ? children : null;
}

/**
 * /thu-vien/ghi-chu/: the notes list, or with `?id=N` one note as a page (`?id=new&item=&template=` for a new one;
 * DECISIONS 9.8, PROMPT-item-notes step 4). A new note keeps its page when its first save gives it an id: the URL
 * then shows the id, without reopening the editor.
 */
export function NotesRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = useRoutePathname();
  const id = noteParam(params.get('id'));
  // the id a new note got from its first save, so the page that made it stays mounted
  const [adopted, setAdopted] = useState<number | null>(null);

  if (id === null) return <NotesPage />;
  const newItem = Number(params.get('item')) || null;
  return (
    <NotePageView
      key={id === 'new' || id === adopted ? 'new' : id}
      id={id === adopted ? 'new' : id}
      newItem={newItem}
      templateType={params.get('template')}
      onCreated={(note: ApiNote) => {
        setAdopted(note.id);
        const path = pathname.endsWith('/') ? pathname : `${pathname}/`; // trailingSlash: true (next.config)
        router.replace(`${path}?id=${note.id}`, { scroll: false });
      }}
    />
  );
}
