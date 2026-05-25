// controllers/raceController.js
const raceService = require('../services/social/raceService');

exports.createRace = async (req, res, next) => {
  try {
    const race = await raceService.createRace(req.body, req.user.id);
    res.json({ success: true, data: race });
  } catch (err) { next(err); }
};

exports.joinRace = async (req, res, next) => {
  try {
    const participant = await raceService.joinRace(req.params.id, req.user.id, req.body.guildId);
    res.json({ success: true, data: participant });
  } catch (err) { next(err); }
};

exports.completeTask = async (req, res, next) => {
  try {
    const result = await raceService.completeTask(req.params.taskId, req.user.id, req.body.proofUrl);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const board = await raceService.getLeaderboard(req.params.id);
    res.json({ success: true, data: board });
  } catch (err) { next(err); }
};

exports.getUserRaces = async (req, res, next) => {
  try {
    const races = await raceService.getUserRaces(req.params.userId);
    res.json({ success: true, data: races });
  } catch (err) { next(err); }
};