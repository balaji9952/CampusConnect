const { DashboardController } = require('./dist/controllers/dashboard.controller.js');
const { DashboardService } = require('./dist/services/dashboard.service.js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.users.findFirst({ where: { email: 'prina@gmail.com' } });
    
    const req = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'Staff',
        designation: user.designation
      }
    };

    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        console.log("RESPONSE HTTP", this.statusCode);
        console.log("RESPONSE BODY:", JSON.stringify(data, null, 2));
      }
    };

    await DashboardController.getStats(req, res);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}
run();
