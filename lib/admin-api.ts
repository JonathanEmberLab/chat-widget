import type { SiteConfig, Lead, Booking, KnowledgeDoc, Conversation, LeadAnalysis } from './types';

export class UnauthorizedError extends Error {}

/** Token-scoped client for the admin API. All calls inject the bearer token. */
export function makeAdminApi(token: string) {
  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    // FormData sets its own multipart Content-Type (with boundary) — only force JSON for strings.
    if (typeof init?.body === 'string') headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { ...init, headers: { ...headers, ...init?.headers } });
    if (res.status === 401) throw new UnauthorizedError('Token inválido');
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Error');
    return data as T;
  }

  return {
    listSites: () => req<{ sites: SiteConfig[] }>('/api/sites').then(d => d.sites),
    createSite: (body: Partial<SiteConfig>) =>
      req<{ site: SiteConfig }>('/api/sites', { method: 'POST', body: JSON.stringify(body) }),
    updateSite: (siteKey: string, body: Partial<SiteConfig>) =>
      req<{ site: SiteConfig }>(`/api/sites/${encodeURIComponent(siteKey)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deleteSite: (siteKey: string) =>
      req<{ ok: boolean }>(`/api/sites/${encodeURIComponent(siteKey)}`, { method: 'DELETE' }),
    listLeads: (site?: string) =>
      req<{ leads: Lead[] }>(`/api/leads${site ? `?site=${encodeURIComponent(site)}` : ''}`).then(d => d.leads),
    listBookings: (site?: string) =>
      req<{ bookings: Booking[] }>(`/api/bookings${site ? `?site=${encodeURIComponent(site)}` : ''}`).then(
        d => d.bookings,
      ),
    analyzeConversation: (id: number) =>
      req<{ analysis: LeadAnalysis; saved: boolean }>(`/api/conversations/${id}/analyze`, { method: 'POST' }),
    listConversations: (site?: string) =>
      req<{ conversations: Conversation[] }>(`/api/conversations${site ? `?site=${encodeURIComponent(site)}` : ''}`).then(
        d => d.conversations,
      ),
    listKnowledge: (siteKey: string) =>
      req<{ docs: KnowledgeDoc[] }>(`/api/sites/${encodeURIComponent(siteKey)}/knowledge`).then(d => d.docs),
    addKnowledgeText: (siteKey: string, body: { source_type: 'text' | 'url'; title?: string; content?: string; url?: string }) =>
      req<{ doc: KnowledgeDoc }>(`/api/sites/${encodeURIComponent(siteKey)}/knowledge`, {
        method: 'POST',
        body: JSON.stringify(body),
      }).then(d => d.doc),
    addKnowledgeFile: (siteKey: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      // No Content-Type header → the browser sets the multipart boundary itself.
      return req<{ doc: KnowledgeDoc }>(`/api/sites/${encodeURIComponent(siteKey)}/knowledge`, {
        method: 'POST',
        body: fd,
      }).then(d => d.doc);
    },
    addKnowledgeTemplate: (
      siteKey: string,
      body: { template: string; title?: string; data: Record<string, unknown> },
    ) =>
      req<{ doc: KnowledgeDoc }>(`/api/sites/${encodeURIComponent(siteKey)}/knowledge`, {
        method: 'POST',
        body: JSON.stringify({ source_type: 'template', ...body }),
      }).then(d => d.doc),
    updateKnowledgeTemplate: (
      siteKey: string,
      id: number,
      body: { template: string; title?: string; data: Record<string, unknown> },
    ) =>
      req<{ doc: KnowledgeDoc }>(`/api/sites/${encodeURIComponent(siteKey)}/knowledge/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }).then(d => d.doc),
    updateKnowledgeText: (siteKey: string, id: number, body: { title?: string; content: string }) =>
      req<{ doc: KnowledgeDoc }>(`/api/sites/${encodeURIComponent(siteKey)}/knowledge/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }).then(d => d.doc),
    deleteKnowledge: (siteKey: string, id: number) =>
      req<{ ok: boolean }>(`/api/sites/${encodeURIComponent(siteKey)}/knowledge/${id}`, { method: 'DELETE' }),
  };
}

export type AdminApi = ReturnType<typeof makeAdminApi>;
