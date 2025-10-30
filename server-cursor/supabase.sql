-- Create the ceipal_applicant_details table
CREATE TABLE IF NOT EXISTS public.ceipal_applicant_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name VARCHAR(255),
    middle_name VARCHAR(255),
    last_name VARCHAR(255),
    email_address VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(50),
    linkedin_profile_url TEXT,
    job_title VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    full_name VARCHAR(500),
    raw JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for email and job title combination
    CONSTRAINT uq_email_job UNIQUE (email_address, job_title)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ceipal_email ON public.ceipal_applicant_details(email_address);
CREATE INDEX IF NOT EXISTS idx_ceipal_job_title ON public.ceipal_applicant_details(job_title);
CREATE INDEX IF NOT EXISTS idx_ceipal_full_name ON public.ceipal_applicant_details(full_name);
CREATE INDEX IF NOT EXISTS idx_ceipal_created_at ON public.ceipal_applicant_details(created_at);

-- Enable Row Level Security
ALTER TABLE public.ceipal_applicant_details ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access for anon role
CREATE POLICY "Allow anon all access"
    ON public.ceipal_applicant_details
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Create policy to allow all access for authenticated users
CREATE POLICY "Allow authenticated all access"
    ON public.ceipal_applicant_details
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy to allow all access for service role
CREATE POLICY "Allow service role all access"
    ON public.ceipal_applicant_details
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
