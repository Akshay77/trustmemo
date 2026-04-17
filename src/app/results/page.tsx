import { ResultsClient } from "@/app/results/ResultsClient";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qRaw = sp.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw ?? "";
  return <ResultsClient question={q} />;
}

