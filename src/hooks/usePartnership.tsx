import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Partnership {
  id: string;
  user_id_1: string;
  user_id_2: string | null;
  invite_code: string;
  status: string;
  created_at: string;
}

interface PartnerProfile {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function usePartnership() {
  const { user } = useAuth();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPartnership = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("partnerships")
      .select("*")
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setPartnership(data as Partnership | null);

    if (data && data.status === "active") {
      const partnerId = data.user_id_1 === user.id ? data.user_id_2 : data.user_id_1;
      if (partnerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email, avatar_url")
          .eq("user_id", partnerId)
          .single();
        setPartnerProfile(profile);
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPartnership();
  }, [fetchPartnership]);

  const createInvite = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("partnerships")
      .insert({ user_id_1: user.id })
      .select()
      .single();
    if (error) throw error;
    await fetchPartnership();
    return data as Partnership;
  };

  const acceptInvite = async (inviteCode: string) => {
    if (!user) return;
    
    const { data: invite } = await supabase
      .from("partnerships")
      .select("*")
      .eq("invite_code", inviteCode)
      .eq("status", "pending")
      .single();

    if (!invite) throw new Error("Convite não encontrado ou já utilizado");
    if (invite.user_id_1 === user.id) throw new Error("Você não pode aceitar seu próprio convite");

    const { error } = await supabase
      .from("partnerships")
      .update({ user_id_2: user.id, status: "active" })
      .eq("id", invite.id);

    if (error) throw error;
    await fetchPartnership();
  };

  const cancelPartnership = async () => {
    if (!partnership) return;
    await supabase
      .from("partnerships")
      .update({ status: "cancelled" })
      .eq("id", partnership.id);
    setPartnership(null);
    setPartnerProfile(null);
  };

  return {
    partnership,
    partnerProfile,
    loading,
    createInvite,
    acceptInvite,
    cancelPartnership,
    refresh: fetchPartnership,
  };
}
