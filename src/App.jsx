import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// Make auth function global for Telegram widget
window.onTelegramAuth = (user) => {
  const event = new CustomEvent('telegram-auth', { detail: user });
  window.dispatchEvent(event);
};

import { Calendar } from './Calendar';

import { AdminDashboard } from './AdminDashboard';

export function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleTelegramAuth = async (telegramUser) => {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/api?action=auth-telegram', {
        method: 'POST',
        body: JSON.stringify(telegramUser)
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data); // Use the fresh user data directly from the auth response
      } else {
        throw new Error(data.message || 'Auth failed');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleIframeMessage = (event) => {
      // Security: Check the origin of the message
      if (event.origin !== 'https://ds-days-off.netlify.app') {
        return;
      }
      // Check if the message is the one we expect
      if (event.data && event.data.type === 'telegram-auth') {
        handleTelegramAuth(event.data.user);
      }
    };

    window.addEventListener('message', handleIframeMessage);

    const checkSession = async () => {
      try {
        const response = await fetch('/.netlify/functions/api?action=user-info');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        // This is expected if there's no session
      } finally {
        setLoading(false);
      }
    };
    checkSession();

    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="login-container">
        <iframe 
          src="/login.html"
          style={{ border: 'none', width: '240px', height: '50px' }}
        ></iframe>
      </div>
    );
  }

  if (user.isAdmin) {
    return <AdminDashboard />;
  }

  if (user.shift === 'pending') {
    return <div><h2>Welcome, {user.firstName}!</h2><p>Please wait for admin approval to access the calendar.</p></div>;
  }

  return (
    <div>
      <h2>Welcome, {user.firstName}!</h2>
      <Calendar />
    </div>
  );
}
