import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState(null); // New state for all users
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/.netlify/functions/api?action=admin-get-pending');
      if (!response.ok) throw new Error('Failed to fetch pending users');
      const users = await response.json();
      setPendingUsers(users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const handleApprove = async (userId, shift) => {
    try {
      setError(null);
      const response = await fetch('/.netlify/functions/api?action=admin-approve-user', {
        method: 'POST',
        body: JSON.stringify({ userId, shift })
      });
      if (!response.ok) throw new Error('Approval failed');
      fetchPendingUsers(); // Refresh list after approval
      if (allUsers) fetchAllUsers(); // Also refresh the all users list if it's open
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
                <button onClick={() => handleApprove(user.id, 'Morning')}>Approve Morning</button>
                <button onClick={() => handleApprove(user.id, 'Evening')}>Approve Evening</button>
                <button onClick={() => handleApprove(user.id, 'Night')}>Approve Night</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <hr />
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
  );
}
