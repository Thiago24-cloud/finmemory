-- Garante FK para public.users (o app usa session.user.supabaseId = public.users.id, não auth.users).

ALTER TABLE public.subscription_detection_dismissals
  DROP CONSTRAINT IF EXISTS subscription_detection_dismissals_user_id_fkey;

ALTER TABLE public.subscription_detection_dismissals
  ADD CONSTRAINT subscription_detection_dismissals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
