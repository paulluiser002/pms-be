-- Sample data only. Do not use in production.
BEGIN;
INSERT INTO companies(id,name) VALUES ('00000000-0000-0000-0000-000000000001','Mayon Consolidated Inc.') ON CONFLICT (id) DO NOTHING;
INSERT INTO departments(id,company_id,name) VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Engineering') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees(id,company_id,department_id,employee_number,full_name,job_title) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','EMP-001','Sample Employee','Software Engineer') ON CONFLICT (id) DO NOTHING;
INSERT INTO goal_templates(id,company_id,name) VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Sample KPI goals') ON CONFLICT (id) DO NOTHING;
INSERT INTO indicators(id,template_id,name,target,unit,direction,position) VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004','Completed milestones',4,'milestones','higher',1) ON CONFLICT (id) DO NOTHING;
COMMIT;
