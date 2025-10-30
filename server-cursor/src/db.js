import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

/**
 * Upsert applicant detail to the database
 * Uses the unique constraint (email_address, job_title) for conflict resolution
 */
export async function upsertApplicantDetail(applicant) {
  try {
    // Prepare the data for insertion
    const applicantData = {
      first_name: applicant.first_name || null,
      middle_name: applicant.middle_name || null,
      last_name: applicant.last_name || null,
      email_address: applicant.email_address || applicant.email || null,
      mobile_number: applicant.mobile_number || applicant.phone || null,
      linkedin_profile_url: applicant.linkedin_profile_url || applicant.linkedin || null,
      job_title: applicant.job_title || applicant.position || null,
      location: applicant.location || applicant.city || null,
      full_name: applicant.full_name || `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim() || null,
      raw: applicant, // Store the entire raw object
      updated_at: new Date().toISOString(),

      // Mapped fields from API
      resume_url: applicant.resume_path || null,
      api_created_at: applicant.created_on || null,
      api_modified_at: applicant.modified_date || null
      
      // 'status' column will use the default 'applied' on insert
    };

    // Use upsert with conflict resolution on the unique constraint
    const { data, error } = await supabase
      .from('ceipal_applicant_details')
      .upsert(applicantData, {
        onConflict: 'email_address,job_title',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Error upserting applicant detail:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in upsertApplicantDetail:', error);
    throw error;
  }
}

/**
 * Get distinct list of job titles
 */
export async function listJobs() {
  try {
    const { data, error } = await supabase
      .from('ceipal_applicant_details')
      .select('job_title')
      .not('job_title', 'is', null)
      .order('job_title');

    if (error) {
      console.error('Error fetching jobs:', error);
      throw error;
    }

    // Extract unique job titles
    const uniqueJobs = [...new Set(data.map(item => item.job_title))];
    return uniqueJobs;
  } catch (error) {
    console.error('Error in listJobs:', error);
    throw error;
  }
}

/**
 * Search candidates with filtering, sorting, and pagination
 */
export async function searchCandidates({ 
  q, jobId, fromDate, toDate, 
  status, // <-- NEW status filter
  sort = 'api_created_at', dir = 'desc', 
  page = 1, limit = 10 
}) {
  try {
    let query = supabase
      .from('ceipal_applicant_details')
      .select('*', { count: 'exact' });

    // Text search on full_name, email_address, and job_title
    if (q && q.trim()) {
      const searchTerm = q.trim();
      query = query.or(`full_name.ilike.%${searchTerm}%,email_address.ilike.%${searchTerm}%,job_title.ilike.%${searchTerm}%`);
    }

    // Filter by job title
    if (jobId && jobId !== '') {
      query = query.eq('job_title', jobId);
    }

    // Filter by status
    if (status && status !== '') {
      query = query.eq('status', status);
    }

    // Date range filtering
    if (fromDate) {
      query = query.gte('api_created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('api_created_at', toDate);
    }

    // Sorting
    const validSortFields = ['full_name', 'job_title', 'api_created_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'api_created_at';
    const sortDirection = dir === 'asc' ? 'asc' : 'desc';
    
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching candidates:', error);
      throw error;
    }

    return {
      rows: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  } catch (error) {
    console.error('Error in searchCandidates:', error);
    throw error;
  }
}

/**
 * Get total count of candidates
 */
export async function getTotalCandidates() {
  try {
    const { count, error } = await supabase
      .from('ceipal_applicant_details')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error getting total candidates:', error);
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getTotalCandidates:', error);
    throw error;
  }
}

/**
 * NEW FUNCTION: Update a candidate's status
 */
export async function updateCandidateStatus(id, status) {
  try {
    const { data, error } = await supabase
      .from('ceipal_applicant_details')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
      
    if (error) {
      console.error('Error updating status:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      throw new Error('Candidate not found');
    }

    return data[0];
  } catch (error) {
    console.error('Error in updateCandidateStatus:', error);
    throw error;
  }
}

