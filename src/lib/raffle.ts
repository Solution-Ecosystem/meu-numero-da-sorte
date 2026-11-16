import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const raffleQuery = {
  queryKey: ["raffle"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("raffles")
      .select("*")
      .order("created_at")
      .limit(1)
      .single();
    if (error) throw error;
    return data;
  },
};

export function takenQuery(raffleId: string | undefined) {
  return {
    queryKey: ["taken", raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_taken_numbers", { _raffle_id: raffleId! });
      if (error) throw error;
      return data ?? [];
    },
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = async (u: User | null) => {
      setUser(u);
      if (u) {
        const { data } = await supabase.rpc("has_role", { _user_id: u.id, _role: "admin" });
        setIsAdmin(!!data);
      } else setIsAdmin(false);
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void load(s?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, isAdmin, ready };
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pad = (n: number, total: number) => String(n).padStart(String(total).length, "0");

export function fileToDataUrl(file: File, max = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
