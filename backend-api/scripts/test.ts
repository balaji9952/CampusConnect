import { AdminUsersService } from '../src/services/admin-users.service';

AdminUsersService.listUsers({ status: 'active' })
  .then(res => console.log('Result:', res))
  .catch(err => console.error('Error:', err));
