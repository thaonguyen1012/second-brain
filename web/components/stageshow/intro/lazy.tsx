'use client';
import dynamic from 'next/dynamic';

/*
 * The intro page's entry point to its pictures (pictures.tsx). Every picture comes from one next/dynamic chunk
 * with ssr: false, so the Stageshow kit (its JS and CSS) is fetched after /gioi-thieu/ renders and never lands in
 * another page's first load. Each picture fills the tile slot the page sizes, so the placeholder is nothing:
 * the tile's own ground shows until the chunk arrives, and the box does not move.
 */

const load = () => import('./pictures');
const none = () => null;

export const IntroHero = dynamic(() => load().then((m) => m.HeroShell), { ssr: false, loading: none });
export const IntroInbox = dynamic(() => load().then((m) => m.InboxTile), { ssr: false, loading: none });
export const IntroSearch = dynamic(() => load().then((m) => m.SearchTile), { ssr: false, loading: none });
export const IntroWeek = dynamic(() => load().then((m) => m.WeekTile), { ssr: false, loading: none });
export const IntroOpportunity = dynamic(() => load().then((m) => m.OpportunityTile), { ssr: false, loading: none });
export const IntroSkills = dynamic(() => load().then((m) => m.SkillsTile), { ssr: false, loading: none });
export const IntroBrief = dynamic(() => load().then((m) => m.BriefTile), { ssr: false, loading: none });
