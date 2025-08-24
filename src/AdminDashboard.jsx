import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// Helper to get a date string like '2025-08'
const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// Renders a single month grid for the Admin view
function AdminMonth({ date, calendarState, onDayClick }) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDayOfMonth; i++) { days.push(<div class="day empty"></div>); }

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = new Date(year, month, i).toISOString().split('T')[0];
        const dayState = calendarState[dateStr];
        let dayClass = 'day';
        if (dayState) {
            if (dayState.pending > 0) dayClass += ' green';
            else if (dayState.approved > 0) dayClass += ' gray';
        }
        days.push(<div className={dayClass} onClick={() => onDayClick(dateStr)}>{i}</div>);
    }
    return days;
}

// Component for the Admin's Calendar View
function AdminCalendar({ onDayClick, refreshKey }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarData, setCalendarData] = useState({});
    const scrollRef = useRef(null);

    const dates = [
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
        currentDate,
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    ];

    useEffect(() => {
        const fetchAdminCalendar = async (date) => {
            const monthKey = getMonthKey(date);
            if (calendarData[monthKey] && refreshKey === 0) return; // Don't refetch unless forced
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const response = await fetch(`/.netlify/functions/api?action=admin-get-calendar&month=${month}&year=${year}`);
            const data = await response.json();
            setCalendarData(prev => ({ ...prev, [monthKey]: data }));
        };
        Promise.all(dates.map(fetchAdminCalendar));
    }, [currentDate, refreshKey]);

    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller) return;
        scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });

        const handleScroll = () => {
            const scrollLeft = scroller.scrollLeft;
            const childWidth = scroller.offsetWidth;
            if (scrollLeft < childWidth / 2) {
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
            } else if (scrollLeft > childWidth * 1.5) {
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
            }
        };
        let scrollEndTimer;
        const onScroll = () => {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(handleScroll, 150);
        };
        scroller.addEventListener('scroll', onScroll);
        return () => scroller.removeEventListener('scroll', onScroll);
    }, [currentDate]);

    return (
        <div ref={scrollRef} className="calendar-scroll-container">
            {dates.map(date => (
                <div className="month-view" key={getMonthKey(date)}>
                    <div class="calendar-header"><h2>{date.toLocaleString('default', { month: 'long' })} {date.getFullYear()}</h2></div>
                    <div class="calendar-grid">
                        <div class="day-label">S</div><div class="day-label">M</div><div class="day-label">T</div><div class="day-label">W</div><div class="day-label">T</div><div class="day-label">F</div><div class="day-label">S</div>
                        <AdminMonth date={date} calendarState={calendarData[getMonthKey(date)] || {}} onDayClick={onDayClick} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ... (DayDetails and other components remain the same)

function DayDetails({ selectedDate, onUpdateRequest }) {
    const [details, setDetails] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedDate) {
            setDetails([]);
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
    }, [selectedDate, onUpdateRequest]);

    const handleManageRequest = async (dayOffId, action) => {
        await fetch('/.netlify/functions/api?action=admin-manage-request', {
            method: 'POST',
            body: JSON.stringify({ dayOffId, action })
        });
        onUpdateRequest();
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

// Main Admin Dashboard Component
export function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRequestUpdate = () => setRefreshKey(k => k + 1);

  const fetchPendingUsers = async () => {
    try {
      const response = await fetch('/.netlify/functions/api?action=admin-get-pending');
      if (!response.ok) throw new Error('Failed to fetch pending users');
      const users = await response.json();
      setPendingUsers(users);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAllUsers = async () => {
    setError(null);
    try {
        const response = await fetch('/.netlify/functions/api?action=admin-get-all-users');
        if (!response.ok) throw new Error('Failed to fetch all users');
        const users = await response.json();
        setAllUsers(users);
    } catch (err) {
        setError(err.message);
    }
  };

  const handleApproveUser = async (userId, shift) => {
    try {
      setError(null);
      await fetch('/.netlify/functions/api?action=admin-approve-user', {
        method: 'POST',
        body: JSON.stringify({ userId, shift })
      });
      fetchPendingUsers();
      if (allUsers) fetchAllUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action is irreversible.')) {
        return;
    }
    try {
        setError(null);
        await fetch('/.netlify/functions/api?action=admin-delete-user', {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
        fetchPendingUsers();
        fetchAllUsers(); // Always refresh all users after a deletion
    } catch (err) {
        setError(err.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPendingUsers().finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      {loading && <div>Loading...</div>}
      {error && <div class="error-message">{error}</div>}
      
      <div className="admin-section">
        <h3>Pending User Approvals</h3>
        {pendingUsers.length === 0 ? (
          <p>No users are currently awaiting approval.</p>
        ) : (
          <ul>
            {pendingUsers.map(user => (
              <li key={user.id}>
                <span>{user.first_name} {user.last_name || ''} (@{user.username || user.id})</span>
                <div class="approval-buttons">
                  <button onClick={() => handleApproveUser(user.id, 'Morning')}>Approve Morning</button>
                  <button onClick={() => handleApproveUser(user.id, 'Evening')}>Approve Evening</button>
                  <button onClick={() => handleApproveUser(user.id, 'Night')}>Approve Night</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr />

      <div className="admin-section">
        <h3>All Users</h3>
        <button onClick={fetchAllUsers}>View All Users</button>
        {allUsers && (
          <table>
              <thead>
                  <tr><th>ID</th><th>Name</th><th>Username</th><th>Shift</th><th>Admin?</th><th>Actions</th></tr>
              </thead>
              <tbody>
                  {allUsers.map(user => (
                      <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.first_name}</td>
                          <td>{user.username}</td>
                          <td>{user.shift}</td>
                          <td>{user.is_admin ? 'Yes' : 'No'}</td>
                          <td>
                              {!user.is_admin && (
                                <button 
                                    className="delete-button"
                                    onClick={() => handleDeleteUser(user.id)}
                                >Delete</button>
                              )}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
        )}
      </div>

      <hr />

      <div className="admin-section">
        <h3>Day-Off Management</h3>
        <AdminCalendar key={refreshKey} onDayClick={setSelectedDate} />
        <DayDetails selectedDate={selectedDate} onUpdateRequest={handleRequestUpdate} />
      </div>
    </div>
  );
}
