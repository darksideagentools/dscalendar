import { h } from 'preact';
import { useState } from 'preact/hooks';

export function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState([]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + offset)));
  };

  const handleDayClick = (day) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0]; // Use ISO string for unique key

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
        <div class="day-label">S</div>
        <div class="day-label">M</div>
        <div class="day-label">T</div>
        <div class="day-label">W</div>
        <div class="day-label">T</div>
        <div class="day-label">F</div>
        <div class="day-label">S</div>
        {renderCalendar()}
      </div>
    </div>
  );
}