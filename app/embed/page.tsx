import { ChatUI } from '@/components/ChatUI';

export const dynamic = 'force-dynamic';

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  if (!site) return <div style={{ padding: 16, fontFamily: 'system-ui' }}>Missing ?site= key</div>;
  return <ChatUI siteKey={site} />;
}
