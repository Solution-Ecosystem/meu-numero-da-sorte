import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Gift, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { brl, pad, raffleQuery, takenQuery, useAuth } from "@/lib/raffle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rifa da Sorte — escolha seus números" },
      { name: "description", content: "Escolha seus números da sorte, pague via Pix e concorra ao prêmio." },
      { property: "og:title", content: "Rifa da Sorte — escolha seus números" },
      { property: "og:description", content: "Escolha seus números da sorte, pague via Pix e concorra ao prêmio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: raffle, isLoading } = useQuery(raffleQuery);
  const { data: taken = [] } = useQuery(takenQuery(raffle?.id));
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<{ numbers: number[]; total: number } | null>(null);

  const takenMap = useMemo(() => new Map(taken.map((t) => [t.number, t.status])), [taken]);

  if (isLoading || !raffle) {
    return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  }
  const price = Number(raffle.price);
  const total = raffle.total_numbers;
  const sold = taken.length;

  const toggle = (n: number) =>
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort((a, b) => a - b)));

  const pickRandom = () => {
    const free = Array.from({ length: total }, (_, i) => i + 1).filter(
      (n) => !takenMap.has(n) && !selected.includes(n),
    );
    if (!free.length) return;
    const n = free[Math.floor(Math.random() * free.length)]!;
    setSelected((s) => [...s, n].sort((a, b) => a - b));
  };

  const reserve = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("reserve_numbers", { _raffle_id: raffle.id, _numbers: selected });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["taken"] });
      return;
    }
    setPayment({ numbers: selected, total: selected.length * price });
    setSelected([]);
    qc.invalidateQueries({ queryKey: ["taken"] });
  };

  return (
    <main>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center">
          <div className="overflow-hidden rounded-3xl bg-primary-foreground/10 shadow-ticket">
            {raffle.image_url ? (
              <img src={raffle.image_url} alt={raffle.title} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center">
                <Gift className="h-24 w-24 opacity-60" />
              </div>
            )}
          </div>
          <div>
            <p className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
              Prêmio
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">{raffle.title}</h1>
            <p className="mt-4 whitespace-pre-line text-lg opacity-85">{raffle.description}</p>
            <div className="mt-8 flex flex-wrap gap-8">
              <div>
                <div className="text-sm opacity-70">Por número</div>
                <div className="font-display text-3xl font-bold">{brl(price)}</div>
              </div>
              <div>
                <div className="text-sm opacity-70">Vendidos</div>
                <div className="font-display text-3xl font-bold">{sold}/{total}</div>
              </div>
              {raffle.draw_date && (
                <div>
                  <div className="text-sm opacity-70">Sorteio</div>
                  <div className="font-display text-3xl font-bold">{raffle.draw_date}</div>
                </div>
              )}
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-primary-foreground/20">
              <div className="h-full bg-accent" style={{ width: `${(sold / total) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      {raffle.winner_number && (
        <section className="bg-accent text-accent-foreground">
          <div className="mx-auto max-w-6xl px-4 py-6 text-center font-display text-2xl font-bold">
            🏆 Número sorteado: {pad(raffle.winner_number, total)}
            {raffle.winner_name ? ` — ${raffle.winner_name.split(" ")[0]}` : ""}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12 pb-40">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-primary">Escolha seus números</h2>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Legend className="border border-border bg-card" label="Livre" />
              <Legend className="bg-reserved" label="Reservado" />
              <Legend className="bg-sold" label="Pago" />
            </div>
          </div>
          <Button variant="outline" onClick={pickRandom}><Shuffle /> Número aleatório</Button>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const st = takenMap.get(n);
            const sel = selected.includes(n);
            const cls = st === "paid"
              ? "bg-sold text-sold-foreground cursor-not-allowed"
              : st
                ? "bg-reserved text-reserved-foreground cursor-not-allowed"
                : sel
                  ? "bg-accent text-accent-foreground ring-2 ring-primary scale-105"
                  : "bg-card border border-border hover:border-primary hover:text-primary";
            return (
              <button
                key={n}
                disabled={!!st}
                onClick={() => toggle(n)}
                className={`rounded-lg py-2.5 text-sm font-semibold tabular-nums transition ${cls}`}
              >
                {pad(n, total)}
              </button>
            );
          })}
        </div>
      </section>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="text-sm text-muted-foreground">
                {selected.length} número(s): {selected.map((n) => pad(n, total)).join(", ")}
              </div>
              <div className="font-display text-2xl font-bold text-primary">{brl(selected.length * price)}</div>
            </div>
            {user ? (
              <Button variant="gold" size="lg" disabled={busy} onClick={reserve}>
                {busy ? "Reservando…" : "Reservar e pagar com Pix"}
              </Button>
            ) : (
              <Button asChild variant="gold" size="lg"><Link to="/auth">Entre para reservar</Link></Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!payment} onOpenChange={(o) => !o && setPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Pague {payment && brl(payment.total)} via Pix</DialogTitle>
            <DialogDescription>
              Números reservados: {payment?.numbers.map((n) => pad(n, total)).join(", ")}. Eles serão confirmados assim que o pagamento for conferido.
            </DialogDescription>
          </DialogHeader>
          {raffle.pix_qr_url ? (
            <img src={raffle.pix_qr_url} alt="QR Code Pix" className="mx-auto w-64 rounded-xl border border-border bg-card p-2" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">QR Code ainda não cadastrado.</p>
          )}
          {raffle.pix_key && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              <code className="flex-1 break-all text-sm">{raffle.pix_key}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(raffle.pix_key);
                  toast.success("Chave Pix copiada");
                }}
              >
                <Copy /> Copiar
              </Button>
            </div>
          )}
          <Button asChild><Link to="/perfil">Ver meus números</Link></Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} /> {label}
    </span>
  );
}
