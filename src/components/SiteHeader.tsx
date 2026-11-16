import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/raffle";

export function SiteHeader() {
  const { user, isAdmin, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <header className="border-b border-border bg-card/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-primary">
          <Ticket className="h-5 w-5" /> Rifa da Sorte
        </Link>
        <nav className="flex items-center gap-2">
          {ready && user ? (
            <>
              {isAdmin && (
                <Button asChild variant="ghost" size="sm"><Link to="/admin">Painel</Link></Button>
              )}
              <Button asChild variant="ghost" size="sm"><Link to="/perfil">Meus números</Link></Button>
              <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
            </>
          ) : ready ? (
            <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
