import { notFound } from "next/navigation";
import { INDEX_PUBLICATIONS } from "../../components/publicationsData";
import PublicationViewer from "../../components/PublicationViewer";

export function generateStaticParams() {
  return INDEX_PUBLICATIONS.map((p) => ({ slug: p.id }));
}

export default async function PublicationSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!INDEX_PUBLICATIONS.some((p) => p.id === slug)) notFound();
  // One viewer for all five: the editorial frame is shared, and the format
  // it draws — bound book, single page, or a shelf of documents — comes
  // from that publication's own entry in publicationsContent.
  return <PublicationViewer slug={slug} />;
}
