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
  const newItem = Number(params.get('item')) || null;
  const templateType = params.get('template');
  // A new note's first save gives it an id: the page that made it stays mounted, with what it was opened with
  const [adopted, setAdopted] = useState<{ id: number; item: number | null; template: string | null } | null>(null);

  // Away from the note it made (the list, another note), the page lets go of it: the next visit loads it like any note
  if (adopted !== null && id !== 'new' && id !== adopted.id) setAdopted(null);
  if (id === null) return <NotesPage />;
  const mine = adopted !== null && id === adopted.id;
  return (
    <NotePageView
      key={id === 'new' || mine ? 'new' : id}
      id={mine ? 'new' : id}
      newItem={mine ? adopted.item : newItem}
      templateType={mine ? adopted.template : templateType}
      onCreated={(note: ApiNote) => {
        // A create that answers after the page was left (back to the list, another page) navigates nowhere: only the
        // new-note page still showing in this tab takes the note's id
        const here = new URL(window.location.href);
        if (here.pathname !== pathname || here.searchParams.get('id') !== 'new') return;
        setAdopted({ id: note.id, item: newItem, template: templateType });
        const path = pathname.endsWith('/') ? pathname : `${pathname}/`; // trailingSlash: true (next.config)
        router.replace(`${path}?id=${note.id}`, { scroll: false });
      }}
    />
  );
}
