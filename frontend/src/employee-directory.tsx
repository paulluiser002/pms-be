import { useState } from "react";
import { Button } from "./components/ui/button";

export type Employee = {
  companyId?: string;
  id: string;
  name: string;
  title: string;
  department: string;
  manager: string;
};
export function EmployeeDirectory({
  employees,
  onEdit,
}: {
  employees: Employee[];
  onEdit?: (employee: Employee) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = employees.filter((employee) =>
    Object.values(employee).some((value) => value.toLowerCase().includes(query.trim().toLowerCase())),
  );
  return (
    <section className="panel">
      <div className="panelhead">
        <div>
          <h2>Employee directory</h2>
          <p>Maintain employee profiles and reporting lines.</p>
        </div>
      </div>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Search employees"
          placeholder="Search name, role, or employee ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="outline" onClick={() => setQuery("")}>
          Clear search
        </Button>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Reports to</th>
              <th>Employee ID</th>
              {onEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((employee) => (
              <tr key={employee.id}>
                <td>
                  {employee.name}
                  <small>{employee.title}</small>
                </td>
                <td>{employee.department}</td>
                <td>{employee.manager}</td>
                <td>{employee.id}</td>
                {onEdit && (
                  <td>
                    <Button variant="outline" aria-label={`Edit ${employee.name}`} onClick={() => onEdit(employee)}>
                      Edit
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p>No employees found.</p>}
      </div>
    </section>
  );
}
