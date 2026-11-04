import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
const processes: Record<string, string[]> = {
  "KPI Goal Templates": [
    "HR defines position template",
    "Define measurable indicators",
    "Add reference or scoring matrices",
    "Validate weights and publish",
    "Assign goals to employee",
  ],
  "Behavioral Assessment Templates": [
    "HR defines assessment",
    "Add required questions and sections",
    "Publish version",
    "Snapshot into review cycle",
  ],
  "Employee goals": [
    "Choose applicable goal",
    "Set milestones",
    "Record progress and evidence",
    "Submit accomplishments",
    "Manager verifies or returns",
  ],
  "Review cycles": [
    "Select participants",
    "Choose published templates",
    "Assign evaluators and deadlines",
    "Review cycle snapshots",
    "Launch cycle",
  ],
  Assessments: [
    "Employee submits self assessment",
    "Assigned evaluators assess",
    "Manager verifies KPI actuals",
    "HR completes review",
  ],
  "Evaluation results": [
    "Finish required assessments",
    "Calculate weighted scores",
    "Finalize evaluation",
    "Release results",
    "Refer failed verified indicators to PIP",
  ],
  "Journal Entries": ["Select employee in scope", "Record dated journal entry", "Review employee history"],
  "NTE Files": [
    "HR issues notice",
    "Employee receives notice",
    "Employee submits explanation",
    "HR reviews response",
    "HR closes with outcome",
  ],
  "Performance Improvement Plan": [
    "Automatic referral or manual enrollment",
    "Manager or HR plans weekly indicators",
    "Employee records weekly evidence",
    "Manager assesses week",
    "Complete or extend improvement plan",
  ],
  Reports: ["Select authorized scope", "Review summary", "Export report"],
};
export function WorkflowGuide() {
  const [process, setProcess] = useState(Object.keys(processes)[0]),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  const steps = processes[process];
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((n) => {
          if (n >= steps.length - 1) {
            setPlaying(false);
            return n;
          }
          return n + 1;
        }),
      1800,
    );
    return () => clearInterval(timer);
  }, [playing, steps]);
  return (
    <>
      <label>
        Process
        <select
          aria-label="Process"
          value={process}
          onChange={(e) => {
            setProcess(e.target.value);
            setStep(0);
            setPlaying(false);
          }}
        >
          {Object.keys(processes).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <ol className="workflow-steps">
        {steps.map((text, index) => (
          <li key={text}>
            <button
              className={index === step ? "active-step" : ""}
              aria-current={index === step ? "step" : undefined}
              onClick={() => {
                setStep(index);
                setPlaying(false);
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" />
                <path d="m7 12 3 3 7-7" fill="none" stroke="currentColor" />
              </svg>
              {text}
            </button>
          </li>
        ))}
      </ol>
      <p role="status">
        Step {step + 1} of {steps.length}: {steps[step]}
      </p>
      <Button
        variant="outline"
        onClick={() => {
          setPlaying(false);
          setStep(Math.max(0, step - 1));
        }}
        disabled={step === 0}
      >
        Previous step
      </Button>
      <Button
        onClick={() => {
          setPlaying(false);
          setStep(Math.min(steps.length - 1, step + 1));
        }}
        disabled={step === steps.length - 1}
      >
        Next step
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          if (step === steps.length - 1) setStep(0);
          setPlaying(!playing);
        }}
      >
        {playing ? "Pause" : "Play walkthrough"}
      </Button>
    </>
  );
}
