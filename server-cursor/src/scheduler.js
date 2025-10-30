import cron from 'node-cron';
import { syncFromCEIPAL } from './ceipal.js';

let syncJob = null;

/**
 * Start the cron scheduler
 */
export function startScheduler() {
  const cronSchedule = process.env.SYNC_CRON || '0 * * * *'; // Default: every hour
  
  console.log(`Starting CEIPAL sync scheduler with cron: ${cronSchedule}`);
  
  // Validate cron expression
  if (!cron.validate(cronSchedule)) {
    console.error(`Invalid cron expression: ${cronSchedule}`);
    return;
  }

  // Stop existing job if any
  if (syncJob) {
    syncJob.stop();
  }

  // Create new cron job
  syncJob = cron.schedule(cronSchedule, async () => {
    console.log(`[${new Date().toISOString()}] Starting scheduled CEIPAL sync...`);
    
    try {
      const imported = await syncFromCEIPAL();
      console.log(`[${new Date().toISOString()}] Scheduled sync completed successfully. Imported: ${imported} records`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Scheduled sync failed:`, error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('CEIPAL sync scheduler started successfully');
}

/**
 * Stop the cron scheduler
 */
export function stopScheduler() {
  if (syncJob) {
    syncJob.stop();
    syncJob = null;
    console.log('CEIPAL sync scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    isRunning: syncJob ? syncJob.running : false,
    cronSchedule: process.env.SYNC_CRON || '0 * * * *'
  };
}
