import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// Make auth function global for Telegram widget
window.onTelegramAuth = (user) => {
  const event = new CustomEvent('telegram-auth', { detail: user });
  window.dispatchEvent(event);
};

function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState([]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + offset)));
  };

  const handleDayClick = (day) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    if (selectedDays.includes(dateStr)) {
      setSelectedDays(selectedDays.filter(d => d !== dateStr));
    } else {
      setSelectedDays([...selectedDays, dateStr]);
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div class="day empty"></div>);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(year, month, i).toISOString().split('T')[0];
      const isSelected = selectedDays.includes(dateStr);
      const dayClass = `day ${isSelected ? 'selected' : ''}`;
      days.push(<div className={dayClass} onClick={() => handleDayClick(i)}>{i}</div>);
    }
    return days;
  };

  return (
    <div>
      <div class="calendar-header">
        <button onClick={() => changeMonth(-1)}>&#9664;</button>
        <h2>{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}</h2>
        <button onClick={() => changeMonth(1)}>&#9654;</button>
      </div>
      <div class="calendar-grid">
        <div class="day-label">S</div><div class="day-label">M</div><div class="day-label">T</div><div class="day-label">W</div><div class="day-label">T</div><div class="day-label">F</div><div class="day-label">S</div>
        {renderCalendar()}
      </div>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleTelegramAuth = async ({ detail: telegramUser }) => {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/auth-telegram', {
        method: 'POST',
        body: JSON.stringify(telegramUser)
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
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
    window.addEventListener('telegram-auth', handleTelegramAuth);
    const checkSession = async () => {
      try {
        const response = await fetch('/.netlify/functions/user-info');
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
    return () => window.removeEventListener('telegram-auth', handleTelegramAuth);
  }, []);

  useEffect(() => {
    if (user === null && !loading) {
      if (!document.getElementById('telegram-widget-script')) {
        const script = document.createElement('script');
        script.id = 'telegram-widget-script';
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [user, loading]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div
        data-telegram-login="dscalendar_bot"
        data-size="large"
        data-onauth="onTelegramAuth(user)"
        data-request-access="write"
      ></div>
    );
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
