# Serenity Canvas Site

This Next.js app renders public Serenity Canvas share pages and OG images.

## Public Share Preview Architecture

Public board previews live at `/s/[shareId]`.

- The page is rendered with React Server Components. Server-side data loading happens in `app/s/[shareId]/page.tsx` through `getBoardByShareId`.
- The Supabase client used by the site is created with the anon key only. The site app must not use a service-role key.
- Authorization is enforced by database gates, not by client code:
  - `get_public_board_by_share_id(p_share_id)` only returns boards whose `share_mode` is `public`.
  - `get_public_files_by_board_id(p_board_id)` only returns files for public boards.
  - `nodes`, `edges`, `groups`, and `group_members` remain protected by public-board RLS policies.
- `middleware.ts` is intentionally a cheap shareId format gate. It does not perform database authorization, so share revocation remains governed by the server data loader plus DB/RLS checks.
- The preview is not a zero-JavaScript page. It uses a small client island, `components/interactive-viewport.tsx`, for whiteboard panning, wheel zoom, and pinch zoom. That client component must not fetch board data or perform authorization.
- The share route uses Streaming SSR for perceived loading: the page shell can render a loading state while the server content awaits the board payload. Dynamic metadata is still retained for share titles, card counts, and OG image URLs.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
