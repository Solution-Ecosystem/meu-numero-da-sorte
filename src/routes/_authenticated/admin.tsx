import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2, Trophy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { brl, fileToDataUrl, pad, raffleQuery, useAuth } from "@/lib/raffle";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel da rifa — Rifa da Sorte" },
      { name: "description", content: "Gerencie o prêmio, o Pix e confirme pagamentos." },
      { property: "og:title", content: "Painel da rifa — Rifa da Sorte" },
      { property: "og:description", content: "Gerencie o prêmio, o Pix e confirme pagamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, ready } = useAuth();
  if (!ready) return null;
  if (!isAdmin) return <p className="p-10 text-center text-muted-foreground">Acesso restrito ao organizador.</p>;
  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-12">
      <RaffleForm />
      <Draw />
      <Orders />
    </main>
  );
}

function RaffleForm() {
  const qc = useQueryClient();
  const { data: raffle } = useQuery(raffleQuery);
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (raffle && !f) setF(raffle); }, [raffle, f]);
  if (!f) return null;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const upload = (k: "image_url" | "pix_qr_url") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setF({ ...f, [k]: await fileToDataUrl(file, k === "pix_qr_url" ? 700 : 1200) });
  };
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("raffles").update({
      title: f.title, description: f.description, price: Number(f.price),
      total_numbers: Math.max(1, Math.min(10000, Number(f.total_numbers))),
      pix_key: f.pix_key, draw_date: f.draw_date, image_url: f.image_url, pix_qr_url: f.pix_qr_url,
    }).eq("id", f.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Rifa salva");
    qc.invalidateQueries({ queryKey: ["raffle"] });
  };
  return (
    <section>
      <h1 className="font-display text-4xl font-bold text-primary">Painel da rifa</h1>
      <div className="mt-6 grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-2">
        <div className="space-y-4">
          <F label="Nome do produto"><Input value={f.title} onChange={set("title")} /></F>
          <F label="Descrição"><Textarea rows={4} value={f.description} onChange={set("description")} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Preço por número (R$)"><Input type="number" step="0.01" value={f.price} onChange={set("price")} /></F>
            <F label="Quantidade de números"><Input type="number" value={f.total_numbers} onChange={set("total_numbers")} /></F>
          </div>
          <F label="Data do sorteio"><Input value={f.draw_date} onChange={set("draw_date")} placeholder="ex: 20/12" /></F>
          <F label="Chave Pix (copia e cola)"><Input value={f.pix_key} onChange={set("pix_key")} /></F>
        </div>
        <div className="space-y-4">
          <F label="Foto do produto">
            <Input type="file" accept="image/*" onChange={upload("image_url")} />
            {f.image_url && <img src={f.image_url} alt="" className="mt-2 h-40 rounded-lg object-cover" />}
          </F>
          <F label="QR Code do Pix">
            <Input type="file" accept="image/*" onChange={upload("pix_qr_url")} />
            {f.pix_qr_url && <img src={f.pix_qr_url} alt="" className="mt-2 h-40 rounded-lg border border-border" />}
          </F>
        </div>
        <Button onClick={save} disabled={saving} size="lg" className="md:col-span-2">{saving ? "Salvando…" : "Salvar rifa"}</Button>
      </div>
    </section>
  );
}

function Draw() {
  const qc = useQueryClient();
  const { data: raffle } = useQuery(raffleQuery);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<number | null>(null);
  if (!raffle) return null;
  const total = raffle.total_numbers;
  const draw = async () => {
    if (raffle.winner_number && !window.confirm("Já existe um ganhador. Sortear novamente?")) return;
    setRolling(true);
    const timer = setInterval(() => setDisplay(1 + Math.floor(Math.random() * total)), 70);
    const [{ data, error }] = await Promise.all([
      supabase.rpc("draw_winner", { _raffle_id: raffle.id }),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    clearInterval(timer);
    setRolling(false);
    if (error) { setDisplay(null); toast.error(error.message); return; }
    const w = data?.[0];
    if (w) { setDisplay(w.number); toast.success(`Ganhador: ${pad(w.number, total)} — ${w.full_name}`); }
    qc.invalidateQueries({ queryKey: ["raffle"] });
  };
  const reset = async () => {
    if (!window.confirm("Apagar TODAS as reservas e o ganhador para começar uma nova rifa?")) return;
    const { error } = await supabase.rpc("reset_raffle", { _raffle_id: raffle.id });
    if (error) { toast.error(error.message); return; }
    setDisplay(null);
    toast.success("Rifa reiniciada");
    qc.invalidateQueries();
  };
  const shown = rolling ? display : (display ?? raffle.winner_number);
  return (
    <section className="rounded-2xl bg-hero p-8 text-center text-primary-foreground shadow-ticket">
      <h2 className="font-display text-3xl font-bold">Sorteio</h2>
      <p className="mt-1 opacity-80">Sorteia apenas entre os números com Pix confirmado.</p>
      <div className="my-6 font-display text-7xl font-bold tabular-nums md:text-8xl">
        {shown ? pad(shown, total) : "—"}
      </div>
      {!rolling && raffle.winner_number && (
        <p className="mb-6 text-lg">
          <Trophy className="mr-1 inline h-5 w-5" /> {raffle.winner_name || "Ganhador"}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="gold" size="lg" onClick={draw} disabled={rolling}>
          {rolling ? "Sorteando…" : "Sortear agora"}
        </Button>
        <Button variant="outline" size="lg" className="text-foreground" onClick={reset} disabled={rolling}>
          <RotateCcw /> Reiniciar rifa
        </Button>
      </div>
    </section>
  );
}

function Orders() {
  const qc = useQueryClient();
  const { data: raffle } = useQuery(raffleQuery);
  const { data } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const [{ data: tickets }, { data: profiles }] = await Promise.all([
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);
      const pm = new Map((profiles ?? []).map((p) => [p.id, p]));
      const groups = new Map<string, { user: any; reserved: any[]; paid: any[] }>();
      for (const t of tickets ?? []) {
        const g = groups.get(t.user_id) ?? { user: pm.get(t.user_id), reserved: [], paid: [] };
        (t.status === "paid" ? g.paid : g.reserved).push(t);
        groups.set(t.user_id, g);
      }
      return [...groups.values()];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    qc.invalidateQueries({ queryKey: ["taken"] });
  };
  const confirm = async (ids: string[]) => {
    const { error } = await supabase.from("tickets").update({ status: "paid" }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento confirmado"); refresh();
  };
  const release = async (ids: string[]) => {
    if (!window.confirm("Liberar estes números para outras pessoas?")) return;
    const { error } = await supabase.from("tickets").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success("Números liberados"); refresh();
  };
  const total = raffle?.total_numbers ?? 100;
  const price = Number(raffle?.price ?? 0);
  return (
    <section>
      <h2 className="font-display text-3xl font-bold text-primary">Participantes</h2>
      {!data?.length && <p className="mt-3 text-muted-foreground">Nenhuma reserva ainda.</p>}
      <div className="mt-4 space-y-3">
        {data?.map((g, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold">{g.user?.full_name || "Sem nome"}</div>
              <div className="text-sm text-muted-foreground">{g.user?.phone}</div>
            </div>
            {g.reserved.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Aguardando ({brl(g.reserved.length * price)}):</span>
                {g.reserved.map((t) => (
                  <span key={t.id} className="rounded-md bg-reserved px-2 py-1 text-sm font-semibold text-reserved-foreground">{pad(t.number, total)}</span>
                ))}
                <Button size="sm" onClick={() => confirm(g.reserved.map((t) => t.id))}><Check /> Confirmar Pix</Button>
                <Button size="sm" variant="ghost" onClick={() => release(g.reserved.map((t) => t.id))}><Trash2 /> Liberar</Button>
              </div>
            )}
            {g.paid.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Pagos:</span>
                {g.paid.map((t) => (
                  <span key={t.id} className="rounded-md bg-sold px-2 py-1 text-sm font-semibold text-sold-foreground">{pad(t.number, total)}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
