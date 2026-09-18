import { notFound } from "next/navigation";
import { INDEX_PUBLICATIONS } from "../../components/publicationsData";
import PublicationDetailView from "../../components/PublicationDetailView";
import SnehSagarDetailView from "../../components/SnehSagarDetailView";

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
  // Sneh Sagar is the one publication with real multi-page content (the
  // supplied PDF) and its own reference-matched layout; the other four
  // share the plain shell — see each component's own file banner.
  if (slug === "sneh-sagar") return <SnehSagarDetailView />;
  return <PublicationDetailView slug={slug} />;
}
