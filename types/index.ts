// ============================================================
// Nong Kung Agency — Shared TypeScript Types
// ============================================================

// --- Enums ---
export type ContentType = 'Post' | 'Carousel' | 'Story'
export type ContentStatus =
  | 'Draft'
  | 'In Production'
  | 'QC Pending'
  | 'Awaiting Approval'
  | 'Scheduled'
  | 'Published'

export type ImageType = 'SFW' | 'NSFW'
export type ImageStatus = 'Generated' | 'QC_Pass' | 'QC_Fail' | 'Selected' | 'Rejected'
export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

// --- Database Types ---
export interface WeeklyPlan {
  id: string
  week_start_date: string
  week_end_date: string
  raw_trends?: Record<string, unknown>
  plan_json: WeeklyPlanJSON
  created_at: string
  updated_at: string
}

export interface ContentItem {
  id: string
  weekly_plan_id: string
  sequence_number: number
  content_type: ContentType
  persona?: string
  storyline?: string
  topic: string
  theme?: string
  sfw_prompt: string
  prompt_structure?: {
    mood_and_tone?: string
    vibe?: string
    lighting?: string
    outfit?: string
    camera_settings?: string[]
    poses?: string[]
    nsfw_prompts?: string[]
    vdo_prompts?: string[]
    vdo_prompts_nsfw?: string[]
  }
  nsfw_option: boolean
  caption_draft?: string
  caption_final?: string
  status: ContentStatus
  gen_sfw: boolean
  gen_nsfw: boolean
  post_to_ig: boolean
  post_to_x: boolean
  post_to_fanvue: boolean
  scheduled_at?: string
  published_at?: string
  post_url?: string
  selected_workflow_id?: string
  selected_image_id?: string
  video_cover_id?: string
  batch_size: number
  image_width: number
  image_height: number
  platform_selections?: Record<string, any>
  image_prompts?: Record<string, any>
  vdo_prompt?: string
  vdo_prompt_nsfw?: string
  created_at: string
  updated_at: string
  // Joined
  generated_images?: GeneratedImage[]
}

export interface GeneratedImage {
  id: string
  content_item_id: string
  image_type: ImageType
  file_path: string
  file_name: string
  seed?: number
  workflow_json?: Record<string, unknown>
  quality_score?: number
  qc_feedback?: QCFeedback
  status: ImageStatus
  media_type?: 'image' | 'video'
  vdo_prompt?: string
  vdo_status?: 'none' | 'pending' | 'processing' | 'completed' | 'failed'
  vdo_job_id?: string
  slot_index?: number
  gen_attempt: number
  runpod_job_id?: string
  created_at: string
}

export interface Schedule {
  id: string
  content_item_id: string
  selected_image_id?: string
  platform: string
  scheduled_at: string
  posted_at?: string
  post_url?: string
  status: 'pending' | 'posted' | 'failed'
  created_at: string
}

export interface EngagementLog {
  id: string
  content_item_id: string
  schedule_id: string
  platform: string
  likes: number
  comments: number
  shares: number
  impressions: number
  reach: number
  recorded_at: string
}

export interface SystemLog {
  id: string
  level: LogLevel
  phase?: string
  message: string
  metadata?: Record<string, unknown>
  created_at: string
}

// --- Phase 1: Weekly Plan JSON ---
export interface WeeklyPlanJSON {
  week_start: string
  week_end: string
  campaign_theme?: string
  trends: TrendData
  contents: ContentPlan[]
}

export interface TrendData {
  instagram_hashtags: string[]
  twitter_trends: string[]
  scraped_at: string
}

export interface ContentPlan {
  sequence: number
  content_type: ContentType
  persona: string
  storyline?: string
  topic: string
  theme: string
  sfw_prompt: string
  prompt_structure?: {
    mood_and_tone: string
    vibe: string
    lighting: string
    outfit: string
    camera_settings: string[]
    poses: string[]
    nsfw_prompts?: string[]
    vdo_prompts?: string[]
    vdo_prompts_nsfw?: string[]
  }
  nsfw_option: boolean
  caption_draft: string
  vdo_prompt?: string
}

export interface AIPersona {
  id: string
  name: string
  display_name: string
  system_prompt: string
  trigger_word?: string
  instruction_rule?: string
  lora_triggers?: string
  created_at: string
  updated_at: string
}

// --- Phase 2: ComfyUI ---
export interface ComfyUIWorkflow {
  id: string
  name: string
  persona?: string
  workflow_type?: string
  workflow_json: Record<string, unknown>
  prompt_node_id: string
  width_node_id?: string
  height_node_id?: string
  batch_size_node_id?: string
  video_image_node_id?: string
  video_prompt_node_id?: string
  output_node_id?: string
  created_at: string
  updated_at: string
}
export interface ComfyUIJob {
  content_item_id: string
  image_type: ImageType
  prompt: string
  seed: number
  workflow_template: string
  output_path: string
}

export interface RunpodPod {
  id: string
  name: string
  desiredStatus: string
  runtime?: {
    gpus: { id: string }[]
    ports: {
      ip: string
      isIpPublic: boolean
      privatePort: number
      publicPort: number
    }[]
  }
}

// --- Phase 3: QC ---
export interface QCFeedback {
  artifacts_detected: string[]
  face_proportion_score: number
  realism_score: number
  overall_score: number
  issues: string[]
  recommendation: 'pass' | 'regenerate'
}

// --- Phase 5: Post ---
export interface PostResult {
  platform: string
  post_id: string
  post_url: string
}

export interface ProductionJob {
  id: string
  status: string
  total_items: number
  completed_items: number
  current_item_id: string
  runpod_job_id?: string
  error_message?: string
  created_at?: string
  updated_at?: string
  completed_at?: string
}
