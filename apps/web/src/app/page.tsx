export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold tracking-tight">
          Easy<span className="text-emerald-600">Shop</span>AI
        </span>
        <a
          href="/dashboard"
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Seller dashboard
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 pb-24 text-center">
        <div className="flex flex-col gap-5">
          <span className="mx-auto inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            AI sales assistant · cash on delivery · Bangla first
          </span>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Your own online shop.
            <br />
            With an AI that actually <span className="text-emerald-600">sells</span>.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-zinc-600">
            List your products once. Then let the assistant greet every visitor, search your real
            catalog, bargain within your floor prices, and collect COD orders — chat in Bangla,
            English or Banglish. বিক্রি হবে অনেক সহজে।
          </p>
          <div className="mx-auto mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/s?shop=rahman-fashion"
              className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Try the demo store →
            </a>
            <a
              href="/dashboard"
              className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold transition hover:bg-zinc-100"
            >
              Open your dashboard
            </a>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3">
          {[
            {
              icon: '🛍️',
              title: 'Real catalog grounding',
              body: 'The assistant answers from your actual products and stock — never invents a price.',
            },
            {
              icon: '🤝',
              title: 'Server-enforced bargaining',
              body: 'Offers are checked against your secret floor price. The AI can never discount below it.',
            },
            {
              icon: '📦',
              title: 'COD orders, cleanly confirmed',
              body: 'Items, total and address are confirmed with the customer before an order is created.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm"
            >
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500">
        EasyShopAI MVP — storefront served by Cloudflare Pages, API by Cloudflare Workers.
      </footer>
    </div>
  );
}
