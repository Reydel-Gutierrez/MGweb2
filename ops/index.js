const express = require('express');
const router = express.Router();

router.use(require('./routesMe'));
router.use(require('./routesBuildings'));
router.use(require('./routesClients'));
router.use(require('./routesSchedules'));
router.use(require('./routesDocs'));

module.exports = router;
