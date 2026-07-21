import { AdminUsersService } from './src/services/admin-users.service';

async function test() {
  try {
    const user = await AdminUsersService.createUser({
      name: "Test Student",
      email: "teststudent999@mountzion.ac.in",
      password: "password123",
      role: 0,
      isActive: true,
      programType: "UG",
      branch: "B.Tech",
      departmentId: 1,
      studyYear: "2nd Year",
      rollNo: "9954"
    });
    console.log("Success:", user);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
