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
import { Badge, Button, EmptyState, ErrorNote, Spinner } from '@/components/ui';
import { Icon } from '@/lib/icons';
import type { Api } from './Dashboard';

const ROLE_STYLE: Record<string, { tag: string; bubble: string }> = {
  customer: { tag: 'bg-sky-100 text-sky-700', bubble: 'bg-sky-50' },
  assistant: { tag: 'bg-brand-100 text-brand-800', bubble: 'bg-brand-50/70' },
  owner: { tag: 'bg-amber-100 text-amber-700', bubble: 'bg-amber-50' },
  tool: {
    tag: 'bg-zinc-100 text-zinc-500',
    bubble: 'bg-zinc-50 text-zinc-500 font-mono text-[11px]',
  },
};

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
      <h2 className="text-lg font-semibold tracking-tight">Customer chats</h2>
      {error ? <ErrorNote message={error} /> : null}
      {convs === null ? (
        <Spinner />
      ) : convs.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="Once customers chat with your AI assistant, the full audit trail appears here — every message, every tool call."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {convs.map((c) => (
            <li
              key={c.id}
              className={`rounded-2xl border bg-white p-3.5 transition hover:border-zinc-300 ${
                c.status === 'needs_owner' ? 'border-amber-300' : 'border-zinc-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">
                  {c.visitorId.slice(0, 2).toUpperCase()}
                </span>
                <span className="font-mono text-xs text-zinc-400">
                  visitor {c.visitorId.slice(0, 10)}
                </span>
                <Badge
                  tone={
                    c.status === 'needs_owner' ? 'amber' : c.status === 'active' ? 'green' : 'zinc'
                  }
                  icon={
                    c.status === 'needs_owner' ? (
                      <Icon.Alert size={11} />
                    ) : c.status === 'active' ? (
                      <Icon.Spark size={11} />
                    ) : undefined
                  }
                >
                  {c.status}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {new Date(c.lastMessageAt).toLocaleString()}
                </span>
                <div className="ml-auto flex gap-2">
                  {c.status !== 'closed' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setStatus(c.id, 'closed')}
                    >
                      Close
                    </Button>
                  ) : null}
                  {c.status === 'needs_owner' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setStatus(c.id, 'active')}
                    >
                      Reopen
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenId(openId === c.id ? null : c.id)}
                  >
                    {openId === c.id ? 'Hide thread' : 'View thread'}
                  </Button>
                </div>
              </div>
              {c.lastMessage ? (
                <p className="mt-2 line-clamp-2 pl-9 text-xs italic text-zinc-600">
                  “{c.lastMessage}”
                </p>
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
    <ol className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 text-xs">
      {msgs.map((m) => {
        const style = ROLE_STYLE[m.role] ?? ROLE_STYLE.tool;
        return (
          <li key={m.id} className="flex gap-2">
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-center font-medium ${style.tag} min-w-[72px]`}
            >
              {m.role}
            </span>
            <span
              className={`whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-zinc-700 ${style.bubble}`}
            >
              {m.content}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
