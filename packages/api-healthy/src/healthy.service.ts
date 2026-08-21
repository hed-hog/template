import { Injectable } from '@nestjs/common';
import { createConnection } from 'mysql2/promise';
import { Client } from 'pg';

@Injectable()
export class HealthyService {
  async getDatabaseHealthCheck() {
    const databaseUrl = String(process.env.DATABASE_URL);

    if (!databaseUrl) {
      return {
        connected: false,
        database: 'unknown',
        message: 'DATABASE_URL is not set',
      };
    }

    if (databaseUrl.startsWith('postgresql://')) {
      const client = new Client({ connectionString: databaseUrl });

      try {
        await client.connect();
        await client.end();
        return {
          connected: true,
          database: 'postgresql',
          message: 'Connection to PostgreSQL successful',
        };
      } catch (error: any) {
        return {
          connected: false,
          database: 'postgresql',
          message: error.message,
        };
      }
    } else if (databaseUrl.startsWith('mysql://')) {
      try {
        const connection = await createConnection(databaseUrl);
        await connection.end();
        return {
          connected: true,
          database: 'mysql',
          message: 'Connection to MySQL successful',
        };
      } catch (error: any) {
        return {
          connected: false,
          database: 'mysql',
          message: error.message,
        };
      }
    } else if (databaseUrl.startsWith('sqlite://')) {
      const sqlitePath = databaseUrl.replace('sqlite://', '');
      try {
        await import('fs').then((fs) => fs.promises.access(sqlitePath));
        return {
          connected: true,
          database: 'sqlite',
          message: 'Connection to SQLite successful',
        };
      } catch (error: any) {
        return {
          connected: false,
          database: 'sqlite',
          message: `SQLite database file not found: ${error.message}`,
        };
      }
    } else {
      return {
        connected: false,
        database: 'unknown',
        message: 'Unsupported database type or invalid DATABASE_URL format',
      };
    }
  }
}
