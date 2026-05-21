-- Corrige permissões se a tabela já existir (erro "Falha ao ignorar assinaturas" em produção).

GRANT SELECT, INSERT, DELETE ON public.subscription_detection_dismissals TO authenticated;
GRANT ALL ON public.subscription_detection_dismissals TO service_role;
