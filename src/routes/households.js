const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  createHousehold,
  syncHouseholds,
  listHouseholds,
  getHousehold,
  reviewHousehold,
} = require('../controllers/householdController');

const router = express.Router();

router.post('/', requireAuth, requireRole('enumerator'), createHousehold);
router.post('/sync', requireAuth, requireRole('enumerator'), syncHouseholds);
router.get('/', requireAuth, requireRole('supervisor', 'administrator'), listHouseholds);
router.get('/:id', requireAuth, requireRole('supervisor', 'administrator'), getHousehold);
router.patch('/:id/status', requireAuth, requireRole('supervisor', 'administrator'), reviewHousehold);

module.exports = router;
