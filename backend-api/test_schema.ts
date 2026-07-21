import { TicketQuerySchema } from './src/schemas/ticket.schema';

async function main() {
  try {
    const q = Object.create(null);
    await TicketQuerySchema.parseAsync(q);
    console.log("SUCCESS");
  } catch (error: any) {
    console.log("ERROR TYPE:", error.constructor.name);
    console.log("ERROR:", error.message);
  }
}

main();
