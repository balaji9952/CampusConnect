with open('admin-portal/user-management.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''onclick="selectRoleAndContinue('Staff')"><i class="ti ti-briefcase"></i> Staff</button>
            </select>'''

replacement = '''onclick="selectRoleAndContinue('Staff')"><i class="ti ti-briefcase"></i> Staff</button>
          <button class="btn btn-primary"
            style="background: var(--text-secondary); border-color: var(--text-secondary);"
            onclick="selectRoleAndContinue('Parent')"><i class="ti ti-users"></i> Parent</button>
          <button class="btn btn-primary" style="background: var(--danger); border-color: var(--danger);"
            onclick="selectRoleAndContinue('Admin')"><i class="ti ti-shield"></i> Admin</button>
        </div>
      </div>

      <div id="user-form-content">
        <input type="hidden" id="um-id">
        <input type="hidden" id="um-role">

        <div class="grid-2" id="group-status-wrap">
          <div class="form-group" id="group-status" style="grid-column: span 2;">
            <label class="form-label">Status</label>
            <select class="form-control" id="um-status">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div class="form-group" id="group-name">
          <label class="form-label" id="label-name">Full Name</label>
          <input type="text" class="form-control" id="um-name">
        </div>

        <div class="grid-2">
          <div class="form-group" id="group-email">
            <label class="form-label" id="label-email">Email Address</label>
            <input type="email" class="form-control" id="um-email">
          </div>
        </div>

        <!-- Specific IDs -->
        <div class="grid-2" id="group-id-fields">
          <div class="form-group" id="group-staff-id">
            <label class="form-label">Staff ID</label>
            <input type="text" class="form-control" id="um-staff-id">
          </div>
          <div class="form-group" id="group-admin-id">
            <label class="form-label">Admin ID</label>
            <input type="text" class="form-control" id="um-admin-id">
          </div>
          <div class="form-group" id="group-register-number">
            <label class="form-label">Register Number</label>
            <input type="text" class="form-control" id="um-register-number">
          </div>
        </div>

        <!-- Student Fields -->
        <div class="grid-2" id="group-student-fields">
          <div class="form-group">
            <label class="form-label">Program Type</label>
            <select class="form-control" id="um-program-type" onchange="handleProgramTypeChange()">
              <option value="">Select Program Type</option>
              <option value="UG">UG</option>
              <option value="PG">PG</option>
            </select>'''

if target in content:
    content = content.replace(target, replacement)
    with open('admin-portal/user-management.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed user-management.html")
else:
    print("Target not found")
