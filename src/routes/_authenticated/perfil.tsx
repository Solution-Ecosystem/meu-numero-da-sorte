import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, pad, raffleQuery } from "@/lib/raffle";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meus números — Rifa da Sorte" },
      { name: "description", content: "Veja os números que você comprou na rifa." },
      { property: "og:title", content: "Meus números — Rifa da Sorte" },
      { property: "og:description", content: "Veja os números que você comprou na rifa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { data: raffle } = useQuery(raffleQuery);
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const [{ data: profile }, { data: tickets }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("tickets").select("*").eq("user_id", uid).order("number"),
      ]);
      return { email: u.user!.email, profile, tickets: tickets ?? [] };
    },
  });
  const total = raffle?.total_numbers ?? 100;
  const paid = data?.tickets.filter((t) => t.status === "paid") ?? [];
  const reserved = data?.tickets.filter((t) => t.status !== "paid") ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold text-primary">Olá, {data?.profile?.full_name?.split(" ")[0] || "participante"}</h1>
      <p className="mt-1 text-muted-foreground">{data?.email} · {data?.profile?.phone}</p>

      <Group title="Números confirmados" empty="Nenhum número confirmado ainda." items={paid.map((t) => t.number)} total={total} tone="bg-sold text-sold-foreground" />
      <Group
        title="Aguardando confirmação do Pix"
        empty="Nenhum número aguardando."
        items={reserved.map((t) => t.number)}
        total={total}
        tone="bg-reserved text-reserved-foreground"
        note={reserved.length && raffle ? `Valor a pagar: ${brl(reserved.length * Number(raffle.price))}` : undefined}
      />
      {data && data.tickets.length === 0 && (
        <Button asChild variant="gold" className="mt-8"><Link to="/">Escolher números</Link></Button>
      )}
    </main>
  );
}

function Group({ title, empty, items, total, tone, note }: { title: string; empty: string; items: number[]; total: number; tone: string; note?: string | undefined }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold">{title} <span className="text-muted-foreground">({items.length})</span></h2>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      {items.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((n) => (
            <span key={n} className={`rounded-lg px-4 py-2 font-display text-lg font-bold tabular-nums ${tone}`}>{pad(n, total)}</span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
