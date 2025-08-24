exports.handler = async function(event, context) {
  const date = event.queryStringParameters.date;
  // Logic to delete a day off for the given date
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Day off ${date} cancelled` })
  };
};
