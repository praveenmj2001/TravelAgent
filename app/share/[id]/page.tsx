type ShareGistResponse = {
  query: string;
  conversation_id: string;
  user_email: string;
  created_at: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let gistRes: Response;
  try {
    gistRes = await fetch(`${BACKEND}/share/${encodeURIComponent(id)}`, { cache: "no-store" });
  } catch {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900 p-6 sm:p-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Shared Trip</h1>
          <p className="text-sm text-gray-600">Unable to load this share right now.</p>
        </div>
      </main>
    );
  }
  if (!gistRes.ok) {
    const detail = gistRes.status === 404 ? "Share not found." : "Unable to load this share right now.";
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900 p-6 sm:p-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Shared Trip</h1>
          <p className="text-sm text-gray-600">{detail}</p>
        </div>
      </main>
    );
  }

  const gist = (await gistRes.json()) as ShareGistResponse;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6 sm:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Original Query</p>
          <h1 className="text-xl sm:text-2xl font-bold leading-snug">{gist.query}</h1>
          <p className="text-xs text-gray-500 mt-3">
            Shared by {gist.user_email} · {new Date(gist.created_at).toLocaleString()}
          </p>
        </header>

        <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Conversation / Itinerary</h2>
          {gist.messages?.length ? (
            <div className="space-y-3">
              {gist.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-emerald-50 border border-emerald-100"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                    {msg.role === "user" ? "User" : "TravelAI"}
                  </p>
                  {msg.content}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No conversation details are available for this share.</p>
          )}
        </section>
      </div>
    </main>
  );
}
