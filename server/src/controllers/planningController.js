const orderService = require('../services/orderService');

async function getPlanningBoard(req, res) {
  try {
    const result = await orderService.getPlanningBoard(req.query);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

async function setIncident(req, res) {
  try {
    const { incident_category, incident_notes } = req.body;
    if (!incident_category) {
      return res.status(400).json({ error: 'incident_category is required' });
    }
    const result = await orderService.setIncident(req.params.id, incident_category, incident_notes, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

module.exports = { getPlanningBoard, setIncident };
