exports.handler = async function(event, context) {
  // Logic to get user info, e.g., from a session
  return {
    statusCode: 200,
    body: JSON.stringify({ user: { name: 'John Doe', shift: 'Night' } })
  };
};
