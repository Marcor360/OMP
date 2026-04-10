import { initializeApp } from 'firebase-admin/app';

initializeApp();

export {
    createUserByAdmin, deleteUserByAdmin, disableUserByAdmin, updateUserByAdmin
} from './users';
