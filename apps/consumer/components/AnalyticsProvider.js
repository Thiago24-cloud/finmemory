import { useEffect } from 'react';
import { useUser } from '../hooks/useUser';
import { setUserId, setUserProperties, trackEvent } from '../lib/analytics';

export default function AnalyticsProvider({ children }) {
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      setUserId(user.id);

      setUserProperties({
        has_gmail_connected: true,
        signup_date: user.created_at,
        user_type: 'free'
      });

      trackEvent('user_session_start', {
        user_id: user.id,
        login_method: 'google'
      });
    }
  }, [user]);

  return <>{children}</>;
}
