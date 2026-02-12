-- Perguntas no mapa (comunidade): execute no SQL Editor do Supabase se não usar migrations
-- Tabelas: map_questions, map_question_replies

CREATE TABLE IF NOT EXISTS public.map_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_questions_created_at ON public.map_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_questions_lat_lng ON public.map_questions(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

ALTER TABLE public.map_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read map_questions" ON public.map_questions;
CREATE POLICY "Anyone can read map_questions"
  ON public.map_questions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert map_questions" ON public.map_questions;
CREATE POLICY "Authenticated can insert map_questions"
  ON public.map_questions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own map_questions" ON public.map_questions;
CREATE POLICY "Users can delete own map_questions"
  ON public.map_questions FOR DELETE
  USING (true);

CREATE TABLE IF NOT EXISTS public.map_question_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.map_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  thanks_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_question_replies_question ON public.map_question_replies(question_id);

ALTER TABLE public.map_question_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read map_question_replies" ON public.map_question_replies;
CREATE POLICY "Anyone can read map_question_replies"
  ON public.map_question_replies FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert map_question_replies" ON public.map_question_replies;
CREATE POLICY "Authenticated can insert map_question_replies"
  ON public.map_question_replies FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update thanks_count" ON public.map_question_replies;
CREATE POLICY "Anyone can update thanks_count"
  ON public.map_question_replies FOR UPDATE
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.map_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_question_replies;
