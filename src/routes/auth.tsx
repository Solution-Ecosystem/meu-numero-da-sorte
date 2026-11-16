import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou cadastrar — Rifa da Sorte" },
      { name: "description", content: "Crie sua conta ou entre para reservar seus números." },
      { property: "og:title", content: "Entrar ou cadastrar — Rifa da Sorte" },
      { property: "og:description", content: "Crie sua conta ou entre para reservar seus números." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(3, "Informe seu nome completo").max(100),
  phone: z.string().trim().regex(/^[0-9()+\-\s]{10,20}$/, "WhatsApp inválido"),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
          },
        });
        if (error) return void toast.error(error.message);
        if (!data.session) {
          toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
          setMode("login");
          return;
        }
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) return void toast.error("E-mail ou senha incorretos");
        navigate({ to: "/" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="font-display text-4xl font-bold text-primary">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {mode === "login" ? "Acesse para reservar e ver seus números." : "Cadastre-se para participar da rifa."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-ticket">
        {mode === "signup" && (
          <>
            <Field label="Nome completo"><Input value={form.full_name} onChange={set("full_name")} required /></Field>
            <Field label="WhatsApp"><Input value={form.phone} onChange={set("phone")} placeholder="(11) 99999-9999" required /></Field>
          </>
        )}
        <Field label="E-mail"><Input type="email" value={form.email} onChange={set("email")} required /></Field>
        <Field label="Senha"><Input type="password" value={form.password} onChange={set("password")} required /></Field>
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Cadastrar"}
        </Button>
      </form>
      <button
        className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
      </button>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
