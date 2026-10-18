import { Router } from 'express';
import { pullWorkspace, pushWorkspace, getWorkspaceSyncStatus } from '../controllers/workspaceSyncController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

router.get('/', pullWorkspace);
router.post('/', pushWorkspace);
router.get('/status', getWorkspaceSyncStatus);

export default router;
