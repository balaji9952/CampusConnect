import { Router } from 'express';
import { DepartmentsController } from '../controllers/departments.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// All department routes require a valid JWT
router.use(authenticateJWT);

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get('/',     DepartmentsController.listDepartments);
router.get('/:id',  DepartmentsController.getDepartmentById);
router.get('/:id/dashboard', DepartmentsController.getDepartmentDashboard);
router.get('/:id/staff/:staffId/complaints', DepartmentsController.getActiveStaffComplaints);
router.post('/:id/bulk-transfer', DepartmentsController.bulkTransferTickets);
router.post('/',    DepartmentsController.createDepartment);
router.put('/:id',  DepartmentsController.updateDepartment);
router.delete('/:id', DepartmentsController.deleteDepartment);

export default router;
