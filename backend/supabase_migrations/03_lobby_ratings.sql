-- Migration to add rating constraints to matches table
ALTER TABLE public.matches 
ADD COLUMN min_rating INTEGER DEFAULT 1000,
ADD COLUMN max_rating INTEGER DEFAULT 3000;
