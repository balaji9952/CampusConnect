import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '..', 'escalation-routing.html');
let html = fs.readFileSync(filePath, 'utf8');

// 1. In loadAssignmentsByKey
html = html.replace(
  `            const key = a.routing_key;`,
  `            const key = a.routing_group_id;`
);

// 2. In renderRoutingTable
html = html.replace(
  `      tbody.innerHTML = routingKeys.map(k => {
        const l1 = assignmentsByKey[k.key]?.[1];
        const l2 = assignmentsByKey[k.key]?.[2];
        const l3 = assignmentsByKey[k.key]?.[3];`,
  `      tbody.innerHTML = routingKeys.map(k => {
        const l1 = assignmentsByKey[k.id]?.[1];
        const l2 = assignmentsByKey[k.id]?.[2];
        const l3 = assignmentsByKey[k.id]?.[3];`
);

html = html.replace(
  `          <td>
            <span style="font-weight:600;font-size:13px">\${escHtml(k.label || k.key)}</span>
            <div style="font-size:11px;color:var(--text-hint);margin-top:2px">\${escHtml(k.key)}</div>
          </td>`,
  `          <td>
            <span style="font-weight:600;font-size:13px">\${escHtml(k.display_name || k.key)}</span>
            <div style="font-size:11px;color:var(--text-hint);margin-top:2px">\${escHtml(k.key)}</div>
          </td>`
);

html = html.replace(
  `              <button class="btn btn-outline btn-icon btn-sm" onclick="openAssignModal('\${escAttr(k.key)}', 1)" title="Set L1">L1</button>
              <button class="btn btn-outline btn-icon btn-sm" onclick="openAssignModal('\${escAttr(k.key)}', 2)" title="Set L2">L2</button>
              <button class="btn btn-outline btn-icon btn-sm" onclick="openAssignModal('\${escAttr(k.key)}', 3)" title="Set L3">L3</button>`,
  `              <button class="btn btn-outline btn-icon btn-sm" onclick="openAssignModal('\${escAttr(k.id)}', 1)" title="Set L1">L1</button>
              <button class="btn btn-outline btn-icon btn-sm" onclick="openAssignModal('\${escAttr(k.id)}', 2)" title="Set L2">L2</button>
              <button class="btn btn-outline btn-icon btn-sm" onclick="openAssignModal('\${escAttr(k.id)}', 3)" title="Set L3">L3</button>`
);

// 3. In confirmAssign
html = html.replace(
  `      const payload = {
        routingKey: key,`,
  `      const payload = {
        routingKey: key, // Keep naming for backend API compatibility`
);

fs.writeFileSync(filePath, html);
console.log('Done escalation-routing.html');
