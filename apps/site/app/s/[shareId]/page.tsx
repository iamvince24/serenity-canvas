import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBoardByShareId } from "@/lib/board";
import BoardPreview from "@/components/board-preview";
import BoardPreviewFallback from "@/components/board-preview-fallback";

type Props = {
  params: Promise<{ shareId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const data = await getBoardByShareId(shareId);
  if (!data) return { title: "Not found" };

  const { board } = data;
  const nodeCount = data.fallback
    ? board.node_count
    : Object.keys(data.nodes).length;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const ogVersion = board.public_version;

  return {
    title: `${board.title} — Serenity Canvas`,
    description: `${nodeCount} cards`,
    openGraph: {
      title: board.title,
      description: `${nodeCount} cards`,
      images: [
        {
          url: `${siteUrl}/api/og/${shareId}?v=${ogVersion}`,
          width: 1200,
          height: 630,
        },
      ],
      url: `${siteUrl}/s/${shareId}`,
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: `${siteUrl}/s/${shareId}` },
  };
}

const HTML_JSON_UNSAFE_CHARS = /[<>&\u2028\u2029]/g;

function JsonLd({
  board,
  shareId,
}: {
  board: { title: string; created_at: string };
  shareId: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const ld = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: board.title,
    datePublished: board.created_at,
    url: `${siteUrl}/s/${shareId}`,
  };
  const ldJson = JSON.stringify(ld).replace(
    HTML_JSON_UNSAFE_CHARS,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: ldJson }}
    />
  );
}

export default async function Page({ params }: Props) {
  const { shareId } = await params;
  const data = await getBoardByShareId(shareId);
  if (!data) notFound();

  const jsonLd = <JsonLd board={data.board} shareId={shareId} />;

  if (data.fallback) {
    return (
      <>
        {jsonLd}
        <BoardPreviewFallback board={data.board} />
      </>
    );
  }

  return (
    <>
      {jsonLd}
      <BoardPreview
        board={data.board}
        nodes={data.nodes}
        edges={data.edges}
        groups={data.groups}
        files={data.files}
      />
    </>
  );
}
