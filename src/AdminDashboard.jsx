import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/.netlify/functions/api?action=admin-get-pending');
      if (!response.ok) {
        throw new Error('Failed to fetch pending users');
      }
      const users = await response.json();
      setPendingUsers(users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, shift) => {
    try {
      const response = await fetch('/.netlify/functions/api?action=admin-approve-user', {
        method: 'POST',
        body: JSON.stringify({ userId, shift })
      });
      if (!response.ok) {
        throw new Error('Approval failed');
      }
      // Refresh the list after approval
      fetchPendingUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  if (loading) {
    return <div>Loading pending users...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      <h3>Pending Approvals</h3>
      {pendingUsers.length === 0 ? (
        <p>No users are currently awaiting approval.</p>
      ) : (
        <ul>
          {pendingUsers.map(user => (
            <li key={user.id}>
              <span>{user.first_name} {user.last_name || ''} (@{user.username || user.id})</span>
              <div class="approval-buttons">
                <button onClick={() => handleApprove(user.id, 'Morning')}>Approve for Morning</button>
                <button onClick={() => handleApprove(user.id, 'Evening')}>Approve for Evening</button>
                <button onClick={() => handleApprove(user.id, 'Night')}>Approve for Night</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
