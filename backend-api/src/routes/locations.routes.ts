import { Router } from 'express';
import { LocationsController } from '../controllers/locations.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { userQrRateLimiter, ipQrRateLimiter } from '../middleware/qr-rate-limit.middleware';

const router = Router();

// All location routes require a valid JWT
router.use(authenticateJWT);

// ─── Routes (specific paths BEFORE /:id to avoid param matching) ───────────────
router.get('/categories',                   LocationsController.getCategoryStats);
router.post('/regenerate-all',              LocationsController.regenerateAllQrs);
router.post('/verify-qr', userQrRateLimiter, ipQrRateLimiter, LocationsController.verifyQr);
router.get('/',                             LocationsController.listLocations);
router.get('/:id',                          LocationsController.getLocationById);
router.post('/',                             LocationsController.createLocation);
router.put('/:id',                          LocationsController.updateLocation);
router.delete('/:id',                        LocationsController.deleteLocation);
router.get('/:id/qr',                                            LocationsController.getQr);
router.delete('/:id/qr',                                         LocationsController.deleteQr);
router.get('/:id/pdf',                                           LocationsController.getPdf);
router.get('/:locationId/sub-locations/:subLocationId/qr',       LocationsController.getQr);
router.delete('/:locationId/sub-locations/:subLocationId/qr',    LocationsController.deleteQr);
router.get('/:locationId/sub-locations/:subLocationId/pdf',      LocationsController.getPdf);
router.get('/:id/sub-locations',            LocationsController.listSubLocations);
router.post('/:id/sub-locations',           LocationsController.createSubLocation);
router.put('/:locationId/sub-locations/:subLocationId', LocationsController.updateSubLocation);
router.delete('/:locationId/sub-locations/:subLocationId', LocationsController.deleteSubLocation);

export default router;
