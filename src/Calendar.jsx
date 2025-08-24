import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shiftDayCounts, setShiftDayCounts] = useState({});
  const [myDaysOff, setMyDaysOff] = useState([]);
  const [selection, setSelection] = useState([]); // New state for selected days
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await fetch(`/.netlify/functions/api?action=get-calendar&month=${month}&year=${year}`, {
        credentials: 'include' // Ensure cookies are sent
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch calendar data');
      }
      const data = await response.json();
      setShiftDayCounts(data.shiftDayCounts);
      setMyDaysOff(data.myDaysOff);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const changeMonth = (offset) => {
    setSelection([]); // Clear selection when changing month
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + offset)));
  };

  const handleDayClick = (dateStr, isBooked, isRed) => {
    if (isBooked || isRed) return; // Don't allow selecting booked or red days

    if (selection.includes(dateStr)) {
      setSelection(selection.filter(d => d !== dateStr));
    } else {
      setSelection([...selection, dateStr]);
    }
  };

  const handleRequestDaysOff = async () => {
    setError(null);
    try {
      const response = await fetch('/.netlify/functions/api?action=request-days-off', {
        method: 'POST',
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({ dates: selection })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit request');
      }
      setSelection([]);
      fetchCalendarData(); // Refresh data
    } catch (err) {
      setError(err.message);
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
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split('T')[0];
      
      const myDayOff = myDaysOff.find(d => d.date === dateStr);
      const shiftCount = shiftDayCounts[dateStr] || 0;
      const isSelected = selection.includes(dateStr);

      let dayClass = 'day';
      const isRed = shiftCount >= 2 && !myDayOff;
      const isBooked = !!myDayOff;

      if (isSelected) {
        dayClass += ' requesting';
      } else if (myDayOff) {
        dayClass += myDayOff.status === 'pending' ? ' pending' : ' selected';
      } else if (shiftCount === 1) {
        dayClass += ' yellow';
      } else if (isRed) {
        dayClass += ' red';
      }

      days.push(<div className={dayClass} onClick={() => handleDayClick(dateStr, isBooked, isRed)}>{i}</div>);
    }
    return days;
  };

  if (loading) {
    return <div>Loading Calendar...</div>
  }

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
      {error && <div class="error-message">{error}</div>}
      <div class="calendar-actions">
        <button onClick={handleRequestDaysOff} disabled={selection.length === 0}>
          Request {selection.length} Day(s) Off
        </button>
      </div>
    </div>
  );
}
