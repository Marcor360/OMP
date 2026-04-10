import { initializeApp } from 'firebase-admin/app';

initializeApp();

export {
  createUserByAdmin,
  updateUserByAdmin,
  disableUserByAdmin,
  deleteUserByAdmin,
} from './users.js';
