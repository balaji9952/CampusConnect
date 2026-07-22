const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function testCreate() {
  try {
    const password_hash = await bcrypt.hash('password123', 10);
    const userId = uuidv4();

    const user = await prisma.users.create({
      data: {
        id: userId,
        name: 'htrty',
        email: 'fniwernw@mountzion.ac.in',
        password_hash,
        role: 0,
        departments_users_department_idTodepartments: { connect: { id: 1 } },
        roll_no: '9954',
        program_type: 'UG',
        branch: 'B.Tech',
        study_year: '2nd Year',
        designation: null,
        is_active: true,
      },
    });

    console.log('User created:', user);

    await prisma.audit_logs.create({
      data: {
        user_id: userId,
        user_name: user.name,
        user_role: 'Student',
        action: 'CREATE_USER',
        entity_type: 'user',
        entity_id: user.id,
        description: 'Admin created user',
      },
    });

    console.log('Audit log created');
  } catch (error) {
    console.error('ERROR OCCURRED:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreate();
