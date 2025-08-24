import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

function AdminCalendar({ onDayClick, refreshKey }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarState, setCalendarState] = useState({});

    useEffect(() => {
        const fetchAdminCalendar = async () => {
            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();
            const response = await fetch(`/.netlify/functions/api?action=admin-get-calendar&month=${month}&year=${year}`);
            const data = await response.json();
            setCalendarState(data);
        };
        fetchAdminCalendar();
    }, [currentDate, refreshKey]);

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + offset)));
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) { days.push(<div class="day empty"></div>); }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = new Date(year, month, i).toISOString().split('T')[0];
            const dayState = calendarState[dateStr];
            let dayClass = 'day';
            if (dayState) {
                if (dayState.pending > 0) dayClass += ' green'; // Pending requests
                else if (dayState.approved > 0) dayClass += ' gray'; // Only approved
            }
            days.push(<div className={dayClass} onClick={() => onDayClick(dateStr)}>{i}</div>);
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
            <div class="calendar-grid">{renderCalendar()}</div>
        </div>
    );
}

function DayDetails({ selectedDate, onUpdateRequest }) {
    const [details, setDetails] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedDate) {
            setDetails([]); // Clear details when no date is selected
            return;
        }
        const fetchDetails = async () => {
            setLoading(true);
            const response = await fetch(`/.netlify/functions/api?action=admin-get-day-details&date=${selectedDate}`);
            const data = await response.json();
            setDetails(data);
            setLoading(false);
        };
        fetchDetails();
    }, [selectedDate, onUpdateRequest]); // Rerun when date changes or a request is updated

    const handleManageRequest = async (dayOffId, action) => {
        await fetch('/.netlify/functions/api?action=admin-manage-request', {
            method: 'POST',
            body: JSON.stringify({ dayOffId, action })
        });
        onUpdateRequest(); // Trigger refresh in parent
    };

    if (!selectedDate) return null;
    if (loading) return <div>Loading details...</div>;

    return (
        <div className="day-details">
            <h4>Requests for {selectedDate}</h4>
            {details.length === 0 ? <p>No requests for this day.</p> : (
                <ul>
                    {details.map(req => (
                        <li key={req.id}>
                            <span>{req.first_name} ({req.shift}) - <span className={`status ${req.status}`}>{req.status}</span></span>
                            {req.status === 'pending' && (
                                <div class="approval-buttons">
                                    <button onClick={() => handleManageRequest(req.id, 'approve')}>Approve</button>
                                    <button onClick={() => handleManageRequest(req.id, 'reject')}>Reject</button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRequestUpdate = () => {
    // This will trigger a refresh in both DayDetails and AdminCalendar
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      <AdminCalendar key={refreshKey} onDayClick={setSelectedDate} />
      <DayDetails selectedDate={selectedDate} onUpdateRequest={handleRequestUpdate} />
    </div>
  );
}