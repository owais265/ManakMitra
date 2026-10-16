DO $$
BEGIN
  IF to_regclass('public.pack_docs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS pack_docs_null_embedding_id ON public.pack_docs (id) WHERE embedding IS NULL';
  END IF;
END $$;
