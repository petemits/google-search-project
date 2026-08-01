const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: "Welcome to your generated project!",
    project: "automated-emails-1762692011869",
    description: "automated emails",
    endpoints: [
      "GET / - This welcome message",
      "GET /api/health - Health check",
      "POST /api/echo - Echo your message back"
    ],
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/echo', (req, res) => {
  const { message } = req.body;
  res.json({
    original: message,
    echoed: message,
    timestamp: new Date().toISOString(),
    reversed: message ? message.split('').reverse().join('') : null
  });
});

app.listen(PORT, () => {
  console.log('🚀 ' + "automated-emails-1762692011869" + ' running at http://localhost:' + PORT);
  console.log('📝 Description: ' + "automated emails");
  console.log('🕒 Started at: ' + new Date().toLocaleString());
});