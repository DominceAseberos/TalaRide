import { Response } from 'express';

interface SSEClient {
  id: string;
  role?: string;
  driverId?: string;
  res: Response;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, res: Response, role?: string, driverId?: string) {
    this.clients.set(id, { id, role, driverId, res });

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId: id, timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.clients.delete(id);
    });
  }

  broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      try {
        client.res.write(payload);
      } catch (err) {
        this.clients.delete(client.id);
      }
    }
  }

  notifyDriver(driverId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (client.driverId === driverId || !client.driverId) {
        try {
          client.res.write(payload);
        } catch (err) {
          this.clients.delete(client.id);
        }
      }
    }
  }
}

export const sse = new SSEManager();
