-- Draft PMS domain schema for an empty PostgreSQL database. Not a backend migration.
BEGIN;

CREATE TABLE companies (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE departments (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  name text NOT NULL,
  UNIQUE (company_id, name),
  UNIQUE (id, company_id)
);
CREATE TABLE employees (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  department_id uuid,
  employee_number text NOT NULL,
  full_name text NOT NULL,
  job_title text NOT NULL,
  email text,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, employee_number),
  UNIQUE (id, company_id),
  CONSTRAINT employees_department_company_fkey FOREIGN KEY (department_id, company_id) REFERENCES departments (id, company_id)
);
CREATE TABLE reporting_lines (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  employee_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (manager_id, company_id) REFERENCES employees (id, company_id),
  CHECK (employee_id <> manager_id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  UNIQUE (employee_id, starts_on)
);
CREATE UNIQUE INDEX reporting_lines_current_employee ON reporting_lines (employee_id) WHERE ends_on IS NULL;

-- Identity-provider subjects only. This draft deliberately stores no passwords or tokens.
CREATE TABLE roles (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code IN ('system_admin', 'hr_admin', 'manager', 'employee')),
  name text NOT NULL
);
CREATE TABLE users (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  employee_id uuid,
  identity_subject text NOT NULL UNIQUE,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (id, company_id),
  UNIQUE (company_id, email),
  UNIQUE (employee_id),
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id)
);
CREATE TABLE user_roles (
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES companies,
  role_id uuid NOT NULL REFERENCES roles,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id, company_id) REFERENCES users (id, company_id),
  FOREIGN KEY (assigned_by, company_id) REFERENCES users (id, company_id)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  actor_user_id uuid,
  actor_kind text NOT NULL CHECK (actor_kind IN ('user', 'system')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (actor_user_id, company_id) REFERENCES users (id, company_id),
  CHECK ((actor_kind = 'user' AND actor_user_id IS NOT NULL) OR (actor_kind = 'system' AND actor_user_id IS NULL))
);
CREATE INDEX audit_events_entity ON audit_events (company_id, entity_type, entity_id, occurred_at);

CREATE TABLE goals (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  employee_id uuid NOT NULL,
  created_by uuid NOT NULL,
  assigned_by uuid,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  source text NOT NULL CHECK (source IN ('self', 'assigned')),
  status text NOT NULL CHECK (status IN ('Pending Approval', 'Active', 'Completed', 'Cancelled')),
  starts_on date NOT NULL,
  due_on date NOT NULL,
  progress numeric NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  approval_requested_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (created_by, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (assigned_by, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (approved_by, company_id) REFERENCES employees (id, company_id),
  CHECK (due_on >= starts_on),
  CHECK ((source = 'self' AND created_by = employee_id) OR (source = 'assigned' AND assigned_by IS NOT NULL))
);
CREATE TABLE goal_milestones (
  id uuid PRIMARY KEY,
  goal_id uuid NOT NULL REFERENCES goals,
  title text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  completed_at timestamptz,
  UNIQUE (goal_id, position)
);
CREATE TABLE goal_updates (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  goal_id uuid NOT NULL,
  author_id uuid NOT NULL,
  progress numeric NOT NULL CHECK (progress BETWEEN 0 AND 100),
  body text NOT NULL,
  milestone_snapshot jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (goal_id, company_id) REFERENCES goals (id, company_id),
  FOREIGN KEY (author_id, company_id) REFERENCES employees (id, company_id)
);

CREATE TABLE goal_templates (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  job_title text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (id, company_id)
);
CREATE TABLE goal_template_versions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES companies,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('Draft', 'Published', 'Archived')),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  published_by uuid,
  published_at timestamptz,
  UNIQUE (template_id, version),
  UNIQUE (id, template_id),
  UNIQUE (id, company_id),
  FOREIGN KEY (template_id, company_id) REFERENCES goal_templates (id, company_id),
  FOREIGN KEY (published_by, company_id) REFERENCES employees (id, company_id),
  CHECK (status <> 'Published' OR (published_at IS NOT NULL AND published_by IS NOT NULL))
);
CREATE TABLE indicators (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES goal_templates,
  template_version_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  target numeric NOT NULL CHECK (target >= 0),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  direction text NOT NULL CHECK (direction IN ('higher', 'lower')),
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 100),
  score_met numeric NOT NULL DEFAULT 5 CHECK (score_met BETWEEN 1 AND 5),
  score_below numeric NOT NULL DEFAULT 2 CHECK (score_below BETWEEN 1 AND 5),
  position integer NOT NULL CHECK (position > 0),
  UNIQUE (template_version_id, position),
  UNIQUE (id, template_version_id),
  FOREIGN KEY (template_version_id, template_id) REFERENCES goal_template_versions (id, template_id)
);
CREATE TABLE indicator_matrices (
  id uuid PRIMARY KEY,
  indicator_id uuid NOT NULL REFERENCES indicators,
  name text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  scoring_enabled boolean NOT NULL DEFAULT false,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  UNIQUE (indicator_id, version)
);
CREATE TABLE behavioral_templates (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  name text NOT NULL,
  job_title text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (id, company_id)
);
CREATE TABLE behavioral_template_versions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES companies,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('Draft', 'Published', 'Archived')),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  published_at timestamptz,
  UNIQUE (template_id, version),
  UNIQUE (id, company_id),
  FOREIGN KEY (template_id, company_id) REFERENCES behavioral_templates (id, company_id),
  CHECK (status <> 'Published' OR published_at IS NOT NULL)
);
CREATE TABLE behavioral_questions (
  id uuid PRIMARY KEY,
  template_version_id uuid NOT NULL REFERENCES behavioral_template_versions,
  section text NOT NULL,
  prompt text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('rating', 'written')),
  required boolean NOT NULL DEFAULT true,
  allow_not_observed boolean NOT NULL DEFAULT false,
  position integer NOT NULL CHECK (position > 0),
  UNIQUE (template_version_id, position),
  UNIQUE (id, template_version_id)
);

CREATE TABLE review_cycles (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  assessment_starts_on date NOT NULL,
  accomplishment_deadline date NOT NULL,
  verification_deadline date NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft', 'Scheduled', 'Active', 'Completed')),
  components jsonb NOT NULL CHECK (jsonb_typeof(components) = 'object'),
  scoring_policy jsonb NOT NULL CHECK (jsonb_typeof(scoring_policy) = 'object'),
  release_policy jsonb NOT NULL CHECK (jsonb_typeof(release_policy) = 'object'),
  goal_weight numeric NOT NULL CHECK (goal_weight BETWEEN 0 AND 100),
  behavioral_weight numeric NOT NULL CHECK (behavioral_weight BETWEEN 0 AND 100),
  anonymous_peer boolean NOT NULL DEFAULT true,
  anonymous_upward boolean NOT NULL DEFAULT true,
  anonymity_threshold integer NOT NULL DEFAULT 2 CHECK (anonymity_threshold >= 2),
  finalized_at timestamptz,
  released_at timestamptz,
  released_by uuid,
  UNIQUE (id, company_id),
  FOREIGN KEY (released_by, company_id) REFERENCES employees (id, company_id),
  CHECK (ends_on >= starts_on),
  CHECK (accomplishment_deadline >= ends_on AND accomplishment_deadline >= assessment_starts_on),
  CHECK (verification_deadline >= accomplishment_deadline),
  CHECK (goal_weight + behavioral_weight = 100),
  CHECK (released_at IS NULL OR (status = 'Completed' AND finalized_at IS NOT NULL AND released_by IS NOT NULL))
);
CREATE TABLE cycle_stages (
  id uuid PRIMARY KEY,
  cycle_id uuid NOT NULL REFERENCES review_cycles,
  name text NOT NULL,
  evaluator_type text NOT NULL CHECK (evaluator_type IN ('Self', 'Manager', 'Peer', 'Upward', 'HR')),
  position integer NOT NULL CHECK (position > 0),
  starts_on date NOT NULL,
  deadline date NOT NULL,
  previous_stage_id uuid,
  UNIQUE (cycle_id, position),
  UNIQUE (id, cycle_id),
  UNIQUE (id, cycle_id, evaluator_type),
  FOREIGN KEY (previous_stage_id, cycle_id) REFERENCES cycle_stages (id, cycle_id),
  CHECK (deadline >= starts_on),
  CHECK (previous_stage_id IS NULL OR previous_stage_id <> id)
);
CREATE TABLE evaluations (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  cycle_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  goal_template_version_id uuid,
  behavioral_template_version_id uuid,
  status text NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'Submitted', 'Completed')),
  accomplishment_status text NOT NULL CHECK (accomplishment_status IN ('Draft', 'Submitted', 'Returned', 'Verified', 'Not Required')),
  template_snapshot jsonb NOT NULL CHECK (jsonb_typeof(template_snapshot) = 'object'),
  employee_snapshot jsonb NOT NULL CHECK (jsonb_typeof(employee_snapshot) = 'object'),
  result_snapshot jsonb,
  released_at timestamptz,
  acknowledged_at timestamptz,
  UNIQUE (cycle_id, employee_id),
  UNIQUE (id, company_id),
  UNIQUE (id, cycle_id, employee_id),
  UNIQUE (id, employee_id),
  UNIQUE (id, goal_template_version_id),
  UNIQUE (id, behavioral_template_version_id),
  FOREIGN KEY (cycle_id, company_id) REFERENCES review_cycles (id, company_id),
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (goal_template_version_id, company_id) REFERENCES goal_template_versions (id, company_id),
  FOREIGN KEY (behavioral_template_version_id, company_id) REFERENCES behavioral_template_versions (id, company_id),
  CHECK (released_at IS NULL OR (status = 'Completed' AND result_snapshot IS NOT NULL))
);
CREATE TABLE evaluator_assignments (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  evaluation_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  evaluator_id uuid NOT NULL,
  evaluator_type text NOT NULL CHECK (evaluator_type IN ('Self', 'Manager', 'Peer', 'Upward', 'HR')),
  status text NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'Submitted', 'Completed')),
  deadline date NOT NULL,
  anonymous boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  UNIQUE (evaluation_id, stage_id, evaluator_id),
  UNIQUE (id, evaluation_id, evaluator_id),
  FOREIGN KEY (evaluation_id, company_id) REFERENCES evaluations (id, company_id),
  FOREIGN KEY (evaluation_id, cycle_id, employee_id) REFERENCES evaluations (id, cycle_id, employee_id),
  CONSTRAINT evaluator_assignments_stage_type_fkey FOREIGN KEY (stage_id, cycle_id, evaluator_type) REFERENCES cycle_stages (id, cycle_id, evaluator_type),
  FOREIGN KEY (evaluator_id, company_id) REFERENCES employees (id, company_id),
  CONSTRAINT evaluator_assignments_self_check CHECK ((evaluator_type = 'Self' AND evaluator_id = employee_id) OR (evaluator_type <> 'Self' AND evaluator_id <> employee_id)),
  CHECK (NOT anonymous OR evaluator_type IN ('Peer', 'Upward'))
);
CREATE TABLE evaluation_history (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  evaluation_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (evaluation_id, company_id) REFERENCES evaluations (id, company_id),
  FOREIGN KEY (actor_id, company_id) REFERENCES employees (id, company_id)
);
CREATE TABLE indicator_results (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  evaluation_id uuid NOT NULL,
  template_version_id uuid NOT NULL,
  indicator_id uuid NOT NULL,
  goal_id uuid,
  target_snapshot numeric NOT NULL CHECK (target_snapshot >= 0),
  indicator_snapshot jsonb NOT NULL CHECK (jsonb_typeof(indicator_snapshot) = 'object'),
  actual numeric CHECK (actual >= 0),
  remarks text NOT NULL DEFAULT '',
  verification_status text NOT NULL CHECK (verification_status IN ('Draft', 'Submitted', 'Returned', 'Verified')),
  verified_by uuid,
  verified_at timestamptz,
  UNIQUE (evaluation_id, indicator_id),
  UNIQUE (id, evaluation_id),
  FOREIGN KEY (evaluation_id, company_id) REFERENCES evaluations (id, company_id),
  FOREIGN KEY (evaluation_id, template_version_id) REFERENCES evaluations (id, goal_template_version_id),
  FOREIGN KEY (indicator_id, template_version_id) REFERENCES indicators (id, template_version_id),
  FOREIGN KEY (goal_id, company_id) REFERENCES goals (id, company_id),
  FOREIGN KEY (verified_by, company_id) REFERENCES employees (id, company_id),
  CHECK (verification_status <> 'Verified' OR (actual IS NOT NULL AND verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE accomplishment_submissions (
  id uuid PRIMARY KEY,
  evaluation_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  values_snapshot jsonb NOT NULL CHECK (jsonb_typeof(values_snapshot) = 'array'),
  correction_reason text,
  submitted_at timestamptz NOT NULL,
  UNIQUE (evaluation_id, revision),
  FOREIGN KEY (evaluation_id, submitted_by) REFERENCES evaluations (id, employee_id)
);
CREATE TABLE behavioral_assessments (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL,
  evaluation_id uuid NOT NULL,
  evaluator_id uuid NOT NULL,
  template_version_id uuid NOT NULL REFERENCES behavioral_template_versions,
  assessment jsonb NOT NULL CHECK (jsonb_typeof(assessment) = 'object'),
  feedback text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  UNIQUE (assignment_id),
  UNIQUE (id, template_version_id),
  FOREIGN KEY (assignment_id, evaluation_id, evaluator_id) REFERENCES evaluator_assignments (id, evaluation_id, evaluator_id),
  CONSTRAINT behavioral_assessments_evaluation_template_fkey FOREIGN KEY (evaluation_id, template_version_id) REFERENCES evaluations (id, behavioral_template_version_id)
);
CREATE TABLE behavioral_responses (
  id uuid PRIMARY KEY,
  assessment_id uuid NOT NULL,
  template_version_id uuid NOT NULL,
  question_id uuid NOT NULL,
  score numeric CHECK (score BETWEEN 1 AND 5),
  written_answer text,
  not_observed boolean NOT NULL DEFAULT false,
  UNIQUE (assessment_id, question_id),
  FOREIGN KEY (assessment_id, template_version_id) REFERENCES behavioral_assessments (id, template_version_id),
  FOREIGN KEY (question_id, template_version_id) REFERENCES behavioral_questions (id, template_version_id),
  CHECK (NOT not_observed OR (score IS NULL AND written_answer IS NULL)),
  CHECK (score IS NULL OR written_answer IS NULL)
);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  employee_id uuid NOT NULL,
  author_id uuid NOT NULL,
  category text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  incident_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (author_id, company_id) REFERENCES employees (id, company_id)
);
-- Metadata only. Storage access and upload scanning belong to a future backend.
CREATE TABLE evidence_files (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  uploaded_by uuid NOT NULL,
  journal_entry_id uuid,
  storage_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  description text NOT NULL DEFAULT '',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (uploaded_by, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (journal_entry_id, company_id) REFERENCES journal_entries (id, company_id)
);
CREATE TABLE nte_notices (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  employee_id uuid NOT NULL,
  created_by uuid NOT NULL,
  issued_by uuid,
  category text NOT NULL CHECK (category IN ('Attendance', 'Conduct', 'Performance', 'Policy Compliance', 'Other')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  incident_on date,
  reference text,
  deadline timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft', 'Issued', 'Responded', 'Closed', 'Cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz,
  read_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  closure_note text,
  early_closure_reason text,
  cancelled_at timestamptz,
  cancellation_reason text,
  UNIQUE (id, company_id),
  UNIQUE (id, employee_id),
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (created_by, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (issued_by, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (closed_by, company_id) REFERENCES employees (id, company_id),
  CHECK ((status = 'Draft' AND issued_at IS NULL AND issued_by IS NULL) OR status = 'Cancelled' OR (issued_at IS NOT NULL AND issued_by IS NOT NULL)),
  CONSTRAINT nte_notices_closure_check CHECK (status <> 'Closed' OR (closed_at IS NOT NULL AND closed_by IS NOT NULL AND btrim(closure_note) <> '' AND closure_note IS NOT NULL)),
  CHECK (status <> 'Cancelled' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND btrim(cancellation_reason) <> '')),
  CHECK (early_closure_reason IS NULL OR (status = 'Closed' AND btrim(early_closure_reason) <> ''))
);
CREATE TABLE nte_evidence (
  notice_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES companies,
  PRIMARY KEY (notice_id, evidence_id),
  FOREIGN KEY (notice_id, company_id) REFERENCES nte_notices (id, company_id),
  FOREIGN KEY (evidence_id, company_id) REFERENCES evidence_files (id, company_id)
);
CREATE TABLE nte_responses (
  id uuid PRIMARY KEY,
  notice_id uuid NOT NULL UNIQUE,
  employee_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 20000),
  submitted_at timestamptz NOT NULL,
  FOREIGN KEY (notice_id, employee_id) REFERENCES nte_notices (id, employee_id)
);
CREATE TABLE nte_history (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  notice_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (notice_id, company_id) REFERENCES nte_notices (id, company_id),
  FOREIGN KEY (actor_id, company_id) REFERENCES employees (id, company_id)
);

CREATE TABLE improvement_plans (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  employee_id uuid NOT NULL,
  evaluation_id uuid,
  created_by uuid,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('Awaiting Planning', 'Draft', 'Active', 'Completed', 'Completed with Exclusions', 'Not Met', 'Cancelled')),
  origin text NOT NULL CHECK (origin IN ('Automatic', 'Manual')),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  acknowledged_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  closure_note text,
  cancellation_reason text,
  UNIQUE (id, company_id),
  UNIQUE (id, employee_id),
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (evaluation_id, employee_id) REFERENCES evaluations (id, employee_id),
  FOREIGN KEY (created_by, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (closed_by, company_id) REFERENCES employees (id, company_id),
  CONSTRAINT improvement_plans_closure_check CHECK (status NOT IN ('Completed', 'Completed with Exclusions', 'Not Met') OR (closed_at IS NOT NULL AND closed_by IS NOT NULL AND closure_note IS NOT NULL AND btrim(closure_note) <> '')),
  CHECK (status <> 'Cancelled' OR (closed_at IS NOT NULL AND cancellation_reason IS NOT NULL AND btrim(cancellation_reason) <> ''))
);
CREATE UNIQUE INDEX improvement_plans_one_open ON improvement_plans (employee_id) WHERE status IN ('Awaiting Planning', 'Draft', 'Active');
CREATE TABLE improvement_plan_sources (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL,
  evaluation_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  referral_rule text NOT NULL,
  source_snapshot jsonb NOT NULL CHECK (jsonb_typeof(source_snapshot) = 'object'),
  added_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  UNIQUE (plan_id, evaluation_id),
  UNIQUE (id, plan_id, evaluation_id),
  FOREIGN KEY (plan_id, employee_id) REFERENCES improvement_plans (id, employee_id),
  FOREIGN KEY (evaluation_id, employee_id) REFERENCES evaluations (id, employee_id)
);
CREATE TABLE improvement_plan_exclusions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  plan_id uuid NOT NULL,
  source_id uuid NOT NULL,
  evaluation_id uuid NOT NULL,
  indicator_result_id uuid NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  excluded_by uuid NOT NULL,
  excluded_at timestamptz NOT NULL,
  UNIQUE (plan_id, indicator_result_id),
  FOREIGN KEY (plan_id, company_id) REFERENCES improvement_plans (id, company_id),
  FOREIGN KEY (source_id, plan_id, evaluation_id) REFERENCES improvement_plan_sources (id, plan_id, evaluation_id),
  FOREIGN KEY (indicator_result_id, evaluation_id) REFERENCES indicator_results (id, evaluation_id),
  FOREIGN KEY (excluded_by, company_id) REFERENCES employees (id, company_id)
);
CREATE TABLE improvement_plan_weeks (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES improvement_plans,
  week_number integer NOT NULL CHECK (week_number > 0),
  source_id uuid,
  evaluation_id uuid,
  indicator_result_id uuid,
  follow_up_for uuid,
  title text NOT NULL,
  goal text NOT NULL,
  actions text NOT NULL,
  support text NOT NULL,
  target numeric NOT NULL CHECK (target >= 0),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  direction text NOT NULL CHECK (direction IN ('higher', 'lower')),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('Pending', 'Submitted', 'Assessed')),
  actual numeric CHECK (actual >= 0),
  employee_update text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '',
  correction_reason text,
  UNIQUE (plan_id, week_number),
  UNIQUE (id, plan_id),
  FOREIGN KEY (source_id, plan_id, evaluation_id) REFERENCES improvement_plan_sources (id, plan_id, evaluation_id),
  FOREIGN KEY (indicator_result_id, evaluation_id) REFERENCES indicator_results (id, evaluation_id),
  FOREIGN KEY (follow_up_for, plan_id) REFERENCES improvement_plan_weeks (id, plan_id),
  CONSTRAINT improvement_plan_weeks_period_check CHECK (ends_on = starts_on + 6),
  CONSTRAINT improvement_plan_weeks_follow_up_check CHECK (follow_up_for IS NULL OR follow_up_for <> id),
  CHECK ((source_id IS NULL AND evaluation_id IS NULL AND indicator_result_id IS NULL) OR (source_id IS NOT NULL AND evaluation_id IS NOT NULL AND indicator_result_id IS NOT NULL))
);
CREATE TABLE improvement_week_submissions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  plan_id uuid NOT NULL,
  week_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  actual numeric NOT NULL CHECK (actual >= 0),
  employee_update text NOT NULL CHECK (btrim(employee_update) <> ''),
  evidence text NOT NULL DEFAULT '',
  evidence_file_id uuid,
  submitted_at timestamptz NOT NULL,
  UNIQUE (week_id, revision),
  CONSTRAINT improvement_week_submissions_plan_company_fkey FOREIGN KEY (plan_id, company_id) REFERENCES improvement_plans (id, company_id),
  FOREIGN KEY (evidence_file_id, company_id) REFERENCES evidence_files (id, company_id),
  FOREIGN KEY (week_id, plan_id) REFERENCES improvement_plan_weeks (id, plan_id),
  FOREIGN KEY (plan_id, employee_id) REFERENCES improvement_plans (id, employee_id)
);
CREATE TABLE improvement_week_assessments (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  plan_id uuid NOT NULL,
  week_id uuid NOT NULL UNIQUE,
  assessed_by uuid NOT NULL,
  actual numeric NOT NULL CHECK (actual >= 0),
  result text NOT NULL CHECK (result IN ('Met', 'Needs Improvement')),
  remarks text NOT NULL CHECK (btrim(remarks) <> ''),
  employee_update_missing boolean NOT NULL DEFAULT false,
  missed_update_reason text,
  assessed_at timestamptz NOT NULL,
  FOREIGN KEY (plan_id, company_id) REFERENCES improvement_plans (id, company_id),
  FOREIGN KEY (week_id, plan_id) REFERENCES improvement_plan_weeks (id, plan_id),
  FOREIGN KEY (assessed_by, company_id) REFERENCES employees (id, company_id),
  CHECK (NOT employee_update_missing OR (missed_update_reason IS NOT NULL AND btrim(missed_update_reason) <> ''))
);
CREATE TABLE improvement_plan_history (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  plan_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plan_id, company_id) REFERENCES improvement_plans (id, company_id),
  FOREIGN KEY (actor_id, company_id) REFERENCES employees (id, company_id)
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies,
  employee_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('review', 'goal', 'nte', 'pip', 'system')),
  subject text NOT NULL,
  body text NOT NULL,
  evaluation_id uuid,
  notice_id uuid,
  plan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (employee_id, kind, evaluation_id, notice_id, plan_id),
  FOREIGN KEY (employee_id, company_id) REFERENCES employees (id, company_id),
  FOREIGN KEY (evaluation_id, company_id) REFERENCES evaluations (id, company_id),
  FOREIGN KEY (notice_id, company_id) REFERENCES nte_notices (id, company_id),
  FOREIGN KEY (plan_id, company_id) REFERENCES improvement_plans (id, company_id)
);
CREATE INDEX goals_employee_status ON goals (company_id, employee_id, status);
CREATE INDEX assignments_inbox ON evaluator_assignments (company_id, evaluator_id, status, deadline);
CREATE INDEX nte_employee_status ON nte_notices (company_id, employee_id, status);
CREATE INDEX plans_employee_status ON improvement_plans (company_id, employee_id, status);
CREATE INDEX notifications_unread ON notifications (company_id, employee_id, created_at) WHERE read_at IS NULL;
COMMIT;
