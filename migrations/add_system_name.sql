-- Migration: add system_name column to requests table
-- Run this once in Supabase SQL editor before using the system_name field in the UI.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS system_name text;
