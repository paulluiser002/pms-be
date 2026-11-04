# PMS React frontend

Run from this directory:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4181
```

Run `npm test` and `npm run build` to verify the frontend.

The React and shadcn/ui application retains the Classic and Workspace themes and the legacy navigation, layout, logo, and workflow guide. The sidebar opens as a drawer on mobile. The original prototype under `legacy` provides the comparison reference.

The workspace uses browser storage and simulated roles. HR can set the workflow date and import or export a workspace from Employees. Same-origin migration reads the original PMS data. Workspace backup files transfer data between browser origins. A restore saves the previous workspace under `pms-workspace-before-import-v1` in browser storage.

PostgreSQL setup, the sample seed, and database verification commands are in [database/README.md](../database/README.md). The React prototype uses its own browser data. Connecting the frontend to NestJS authentication and PostgreSQL requires backend integration.
