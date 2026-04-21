const EventEmitter = require('events');
class AppEmitter extends EventEmitter {}

// Global instance to share events across routes/agents
const eventEmitter = new AppEmitter();

module.exports = eventEmitter;
