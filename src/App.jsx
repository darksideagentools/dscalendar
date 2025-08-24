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
      if (response.ok) {
        // The backend has set the new cookie. Reloading the page is the most
        // robust way to ensure the app starts fresh with the new session.
        window.location.reload();
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Auth failed');
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleIframeMessage = (event) => {
      if (event.origin !== 'https://ds-days-off.netlify.app') return;
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
        setUser(null);
      }
      setLoading(false);
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
