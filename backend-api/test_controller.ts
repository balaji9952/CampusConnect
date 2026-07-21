import { TicketsController } from './src/controllers/tickets.controller';

async function main() {
  const req = {
    user: { userId: '0d3e2e03-9640-4fc3-935a-cbaf44540fd1', role: 'Student' },
    query: {}
  };
  const res = {
    status: (code: any) => {
      console.log('STATUS:', code);
      return {
        json: (data: any) => console.log('JSON:', JSON.stringify(data, null, 2))
      };
    }
  };
  
  await TicketsController.getAll(req as any, res as any);
}

main().catch(console.error);
