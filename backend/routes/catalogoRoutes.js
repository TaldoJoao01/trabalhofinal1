const express = require('express');
const controller = require('../controllers/catalogoController');
const router = express.Router();
router.get('/especialidades', controller.especialidades);
module.exports = router;