import { Response, Request } from 'express';
import { authenticateRequest, AuthenticatedUser } from './lib/auth.js';

export interface SSEClient {
  id: string;
  user: AuthenticatedUser;
  res: Response;
}

export class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  async handleConnection(req: Request, res: Response) {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token is required for real-time events'
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const client: SSEClient = { id: clientId, user, res };
    this.clients.set(clientId, client);

    // Initial connection event
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        client_id: clientId,
        role: user.role,
        driver_code: user.driver_code,
        timestamp: new Date().toISOString()
      })}\n\n`
    );

    req.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  broadcast(event: string, data: any, allowedRoles?: string[]) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (!allowedRoles || allowedRoles.includes(client.user.role)) {
        try {
          client.res.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  notifyDriver(driverCode: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      // Driver-specific notifications ONLY reach that verified driver
      if (client.user.driver_code === driverCode) {
        try {
          client.res.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  notifyUser(userId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (client.user.id === userId) {
        try {
          client.res.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sse = new SSEManager();
