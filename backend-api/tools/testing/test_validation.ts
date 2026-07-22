import { validateRoutingAssignments } from '../src/utils/validate-routing';

async function main() {
  try {
    await validateRoutingAssignments();
    console.log("Success");
  } catch (error) {
    console.error("Failed:", error);
  }
}

main();
