import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { listJobs, searchCandidates, updateCandidateStatus } from './db.js'; // <-- Import new function
import { syncFromCEIPAL } from './ceipal.js';
import { startScheduler } from './scheduler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});
import express from "express";
import { syncFromCEIPAL } from "./ceipal.js";

const app = express();

app.get("/api/sync", async (req, res) => {
  console.log("CRON TRIGGERED:", new Date().toISOString());

  try {
    const result = await syncFromCEIPAL();
    res.json({ success: true, imported: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// Get list of jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await listJobs();
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch jobs',
      message: error.message 
    });
  }
});

// Search candidates with filtering, sorting, and pagination
app.get('/api/candidates', async (req, res) => {
  try {
    const {
      q,           // search query
      jobId,       // filter by job title
      fromDate,    // filter by date range start
      toDate,      // filter by date range end
      status,      // <-- NEW status filter
      sort = 'api_created_at',  // sort field
      dir = 'desc',         // sort direction
      page = 1,             // page number
      limit = 10            // items per page
    } = req.query;

    // Validate and convert parameters
    const searchParams = {
      q: q || null,
      jobId: jobId || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      status: status || null, // <-- Pass status to search
      sort: sort || 'api_created_at',
      dir: dir || 'desc',
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 10, 100) // Cap at 100 items per page
    };

    const result = await searchCandidates(searchParams);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error searching candidates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search candidates',
      message: error.message 
    });
  }
});

// *** NEW ENDPOINT TO UPDATE STATUS ***
app.post('/api/candidates/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const validStatuses = ['selected', 'rejected', 'placed', 'applied'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updatedCandidate = await updateCandidateStatus(id, status);
    
    res.json({ success: true, data: updatedCandidate });

  } catch (error) {
    console.error('Error updating candidate status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update status',
      message: error.message 
    });
  }
});

// Manual sync trigger
app.post('/internal/sync', async (req, res) => {
  try {
    console.log('Manual sync triggered via API');
    const imported = await syncFromCEIPAL();
    
    res.json({ 
      success: true, 
      message: `Sync completed successfully`,
      imported: imported,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in manual sync:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sync failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`API endpoints:`);
  console.log(`  GET  /api/health     - Health check`);
  console.log(`  GET  /api/jobs       - List all job titles`);
  console.log(`  GET  /api/candidates - Search candidates`);
  console.log(`  POST /api/candidates/:id/status - Update candidate status`);
  console.log(`  POST /internal/sync  - Manual sync trigger`);
  
  // Start the scheduler
  startScheduler();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

