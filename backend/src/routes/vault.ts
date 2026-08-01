import { Router } from 'express';
import { getVaultItems, createVaultItem, updateVaultItem, deleteVaultItem, bulkCreateVaultItems, bulkUpdateVaultItems } from '../controllers/vaultController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

router.post('/bulk', bulkCreateVaultItems);
router.put('/bulk', bulkUpdateVaultItems);
router.get('/', getVaultItems);
router.post('/', createVaultItem);
router.put('/:id', updateVaultItem);
router.delete('/:id', deleteVaultItem);

export default router;
