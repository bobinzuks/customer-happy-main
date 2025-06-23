import { FastifyInstance } from 'fastify';
declare function buildServer(): Promise<FastifyInstance>;
declare function start(): Promise<void>;
export { buildServer, start };
