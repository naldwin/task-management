import { z } from 'zod';

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const spaceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,8}$/, 'Prefix must be 2–8 uppercase letters (e.g. DEV)'),
  description: z.string().max(2000).default(''),
  timezone: z.string().min(1).default('UTC'),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(10000).default(''),
  status_id: z.string().uuid().optional().or(z.literal('')),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).default('Normal'),
  assignee_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  due_date: z.string().optional().or(z.literal('')),
  git_branch: z.string().max(255).optional().or(z.literal('')),
  pr_url: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^https?:\/\/.+/.test(v), 'PR link must start with http:// or https://'),
  is_blocked: z.boolean().default(false),
  blocker_reason: z.string().max(2000).default(''),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment first').max(5000),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: z.enum(['member', 'viewer', 'lead', 'owner']).default('member'),
});

export const statusSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color'),
  category: z.enum(['Not Started', 'Active', 'Done', 'Cancelled']),
  is_default: z.boolean().default(false),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SpaceInput = z.infer<typeof spaceSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
