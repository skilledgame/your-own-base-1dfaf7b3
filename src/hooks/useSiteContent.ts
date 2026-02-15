import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SiteContent {
  slug: string;
  title: string;
  content: string;
  updated_at: string | null;
}

/**
 * useSiteContent - Fetches editable site content by slug from Supabase.
 * 
 * Returns the content data, loading state, and whether content exists.
 * Pages should fall back to hardcoded content when hasContent is false.
 */
export function useSiteContent(slug: string) {
  const [data, setData] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      const { data: row, error: fetchError } = await supabase
        .from('site_content')
        .select('slug, title, content, updated_at')
        .eq('slug', slug)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setData(row);
      }
      setLoading(false);
    };

    fetchContent();

    return () => { cancelled = true; };
  }, [slug]);

  return {
    data,
    loading,
    error,
    /** True when DB content exists and is non-empty */
    hasContent: !!data?.content && data.content.trim().length > 0,
  };
}
