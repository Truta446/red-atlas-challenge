import cluster from 'node:cluster';
import os from 'node:os';

// Simple native cluster launcher for Nest Fastify app
// Master forks N workers that each run src/main.ts (which starts the server)

function startCluster(): void {
  const desired = Number(process.env.WORKERS || os.cpus().length);

  if (cluster.isPrimary) {
    console.log(`[cluster] Primary ${process.pid} starting ${desired} workers...`);

    for (let i = 0; i < desired; i += 1) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.warn(
        `[cluster] Worker ${worker.process.pid} died (code=${code}, signal=${signal}). Spawning a new one...`,
      );
      cluster.fork();
    });
  } else {
    // Each worker just imports the main bootstrap (which starts the Fastify/Nest server)
    // Importing as side-effect because src/main.ts calls bootstrap() immediately
    require('./main');
  }
}

startCluster();
