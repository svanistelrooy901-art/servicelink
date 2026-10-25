import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { isMediaReference } from '../lib/mediaReference';
import { getSupabaseClient } from '../lib/supabase';
export function MediaImage({
  src = '',
  access,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { access?: { id: string; token: string } }) {
  const [loaded, setLoaded] = useState('');
  useEffect(() => {
    if (!isMediaReference(src)) return;
    let active = true,
      object = '';
    const controller = new AbortController();
    setLoaded('');
    (async () => {
      let response: Response;
      if (access)
        response = await fetch('/api/media/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: src, bookingId: access.id, token: access.token }),
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: controller.signal,
        });
      else {
        response = await fetch(src, {
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: controller.signal,
        });
        if (!response.ok) {
          const { data } = await getSupabaseClient().auth.getSession();
          if (data.session)
            response = await fetch(src, {
              headers: { Authorization: `Bearer ${data.session.access_token}` },
              cache: 'no-store',
              referrerPolicy: 'no-referrer',
              signal: controller.signal,
            });
        }
      }
      if (!response.ok) throw new Error('Image unavailable.');
      object = URL.createObjectURL(await response.blob());
      if (active) setLoaded(object);
      else URL.revokeObjectURL(object);
    })().catch(() => {
      if (active) setLoaded('');
    });
    return () => {
      active = false;
      controller.abort();
      if (object) URL.revokeObjectURL(object);
    };
  }, [src, access?.id, access?.token]);
  return <img {...props} src={isMediaReference(src) ? loaded || undefined : src} />;
}
