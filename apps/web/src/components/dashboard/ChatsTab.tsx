'use client';

/** Customer chat audit: conversation list + full message thread view. */
import { useEffect, useState } from 'react';
import {
  type Conversation,
  type Message,
  type Shop,
  conversationSchema,
  messageSchema,
} from '@easyshop/shared';
import { Badge, Button, Spinner } from '@/components/ui';
import type { Api } from './Dashboard';

export default function ChatsTab({ auth, shop }: { auth: Api; shop: Shop }) {
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    auth<unknown[]>(`/shops/${shop.id}/conversations`)
      .then((list) => {
        if (cancelled) return;
        setError(null);
        setConvs(list.map((c) => conversationSchema.parse(c)));
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load conversations');
      });
    return () => {
      cancelled = true;
    };
  }, [auth, shop.id]);

  /** Handler-invoked refresh (never called directly inside an effect). */
  const refetch = () => {
    auth<unknown[]>(`/shops/${shop.id}/conversations`)
      .then((list) => {
        setError(null);
        setConvs(list.map((c) => conversationSchema.parse(c)));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load conversations'),
      );
  };

  const setStatus = async (id: string, status: string) => {
    await auth(`/conversations/${id}`, { method: 'PATCH', body: { status } });
    refetch();
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Customer chats</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}
      {convs === null ? (
        <Spinner />
      ) : convs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No conversations yet. Once customers chat with your AI assistant, audits appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {convs.map((c) => (
            <li key={c.id} className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">
                  visitor {c.visitorId.slice(0, 10)}
                </span>
                <Badge
                  tone={
                    c.status === 'needs_owner' ? 'amber' : c.status === 'active' ? 'green' : 'zinc'
                  }
                >
                  {c.status}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {new Date(c.lastMessageAt).toLocaleString()}
                </span>
                <div className="ml-auto flex gap-2">
                  {c.status !== 'closed' ? (
                    <Button variant="ghost" onClick={() => void setStatus(c.id, 'closed')}>
                      Close
                    </Button>
                  ) : null}
                  {c.status === 'needs_owner' ? (
                    <Button variant="ghost" onClick={() => void setStatus(c.id, 'active')}>
                      Reopen
                    </Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    {openId === c.id ? 'Hide thread' : 'View thread'}
                  </Button>
                </div>
              </div>
              {c.lastMessage ? (
                <p className="mt-2 line-clamp-2 text-xs text-zinc-600">“{c.lastMessage}”</p>
              ) : null}
              {openId === c.id ? <Thread conversationId={c.id} auth={auth} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thread({ conversationId, auth }: { conversationId: string; auth: Api }) {
  const [msgs, setMsgs] = useState<Message[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    auth<unknown[]>(`/conversations/${conversationId}/messages`)
      .then((list) => {
        if (!cancelled) setMsgs(list.map((m) => messageSchema.parse(m)));
      })
      .catch(() => setMsgs([]));
    return () => {
      cancelled = true;
    };
  }, [auth, conversationId]);

  if (msgs === null) return <Spinner label="Loading thread…" />;
  return (
    <ol className="mt-3 flex flex-col gap-1.5 border-t border-zinc-100 pt-3 text-xs">
      {msgs.map((m) => (
        <li key={m.id} className="flex gap-2">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
              m.role === 'customer'
                ? 'bg-blue-100 text-blue-700'
                : m.role === 'assistant'
                  ? 'bg-emerald-100 text-emerald-700'
                  : m.role === 'owner'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {m.role}
          </span>
          <span className="whitespace-pre-wrap text-zinc-700">{m.content}</span>
        </li>
      ))}
    </ol>
  );
}
