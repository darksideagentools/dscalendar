import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// Component for the Admin's Calendar View
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
                if (dayState.pending > 0) dayClass += ' green';
                else if (dayState.approved > 0) dayClass += ' gray';
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

// Component to show details for a selected day
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
                  <tr><th>ID</th><th>Name</th><th>Username</th><th>Shift</th><th>Admin?</th></tr>
              </thead>
              <tbody>
                  {allUsers.map(user => (
                      <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.first_name}</td>
                          <td>{user.username}</td>
                          <td>{user.shift}</td>
                          <td>{user.is_admin ? 'Yes' : 'No'}</td>
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
