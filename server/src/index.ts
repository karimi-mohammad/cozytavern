import app from './app';

const PORT = process.env.PORT || 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CozyTavern server running on http://localhost:${PORT}`);
  console.log(`LAN access: http://0.0.0.0:${PORT}`);
});
