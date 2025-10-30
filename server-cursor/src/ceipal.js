import axios from 'axios';
import dotenv from 'dotenv';
import { upsertApplicantDetail } from './db.js';

dotenv.config();

// Cache for access token
let accessToken = null;
let tokenExpiry = null;

const CEIPAL_BASE_URL = process.env.CEIPAL_BASE_URL || 'https://api.ceipal.com';

/**
 * Get access token from CEIPAL API
 */
export async function getAccessToken() {
  try {
    // Check if we have a valid cached token
    if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
      return accessToken;
    }

    console.log('Fetching new access token from CEIPAL...');
    
    const response = await axios.post(`${CEIPAL_BASE_URL}/v1/createAuthtoken/`, {
      email: process.env.CEIPAL_EMAIL,
      password: process.env.CEIPAL_PASSWORD,
      api_key: process.env.CEIPAL_API_KEY,
      json: 1
    });

    if (response.data && response.data.access_token) {
      accessToken = response.data.access_token;
      // Cache token for 23 hours (assuming it expires in 24 hours)
      tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      
      console.log('Successfully obtained access token');
      return accessToken;
    } else {
      throw new Error('Invalid response from CEIPAL auth endpoint');
    }
  } catch (error) {
    console.error('Error getting CEIPAL access token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Make authenticated API call to CEIPAL
 */
export async function callCEIPAL(path, params = {}) {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(`${CEIPAL_BASE_URL}${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: params
    });

    return response.data;
  } catch (error) {
    console.error('Error calling CEIPAL API:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Sync data from CEIPAL to Supabase
 */
export async function syncFromCEIPAL() {
  try {
    console.log('Starting CEIPAL sync...');
    
    const endpoint = '/getCustomApplicantDetails/UGtpQkJSTEZ3Z0xBaDdsN1QwOXBIUT09/b03006f7db8d37c2aae189e1cd1e177d';
    
    let totalImported = 0;
    let page = 1;
    const pageSize = 20; // Adjust based on API limits
    let hasMoreData = true;

    while (hasMoreData) {
      console.log(`Fetching page ${page} from CEIPAL...`);
      
      try {
        const data = await callCEIPAL(endpoint, {
          page: page,
          paging_length: pageSize
        });

        // Handle different response formats
        let applicants = [];
        if (Array.isArray(data)) {
          applicants = data;
        } else if (data && Array.isArray(data.data)) {
          applicants = data.data;
        } else if (data && Array.isArray(data.applicants)) {
          applicants = data.applicants;
        } else if (data && data.results && Array.isArray(data.results)) {
          applicants = data.results;
        } else {
          console.log('Unexpected data format from CEIPAL:', typeof data, Object.keys(data || {}));
          break;
        }

        if (!applicants || applicants.length === 0) {
          console.log('No more data from CEIPAL');
          hasMoreData = false;
          break;
        }

        console.log(`Processing ${applicants.length} applicants from page ${page}...`);

        // Process each applicant
        for (const applicant of applicants) {
          try {
            await upsertApplicantDetail(applicant);
            totalImported++;
          } catch (error) {
            console.error('Error upserting applicant:', error.message);
            // Continue with other applicants even if one fails
          }
        }

        // Check if we should continue to next page
        // if (applicants.length < pageSize) {
        //   hasMoreData = false;
        // } else {
        //   page++;
        // }
        // Always increment the page. The loop will stop
// when the API returns 0 applicants.
page++;

        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (pageError) {
        console.error(`Error fetching page ${page}:`, pageError.message);
        hasMoreData = false;
      }
    }

    console.log(`CEIPAL sync completed. Total imported: ${totalImported}`);
    return totalImported;

  } catch (error) {
    console.error('Error in syncFromCEIPAL:', error.message);
    throw error;
  }
}

/**
 * Test CEIPAL connection
 */
export async function testCEIPALConnection() {
  try {
    const token = await getAccessToken();
    console.log('CEIPAL connection test successful');
    return { success: true, token: token ? '***' : null };
  } catch (error) {
    console.error('CEIPAL connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}
