const express = require('express');
const cors = require('cors');
require('dotenv').config();

const chatRoutes = require('./routes/chat');
const npcRoutes = require('./routes/npc');
const investigationRoutes = require('./routes/investigation');
const saveRoutes = require('./routes/save');
const innerWorldRoutes = require('./routes/innerWorld');


const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'glimmer-city-backend', version: '0.1.0' });
});

app.use('/api/chat', chatRoutes);
app.use('/api/npc', npcRoutes);
app.use('/api/investigation', investigationRoutes);
app.use('/api/save', saveRoutes);
app.use('/api/inner-world', innerWorldRoutes);


app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Glimmer City backend running on http://localhost:${PORT}`);
});
