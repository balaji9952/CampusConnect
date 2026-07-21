# ══════════════════════════════════════════════════════════════
#  Phase 1B — Runtime Verification Script
#  Run this ON THE SERVER MACHINE where SQL Server is reachable
#  Requirements: PowerShell 5+, server running on port 5000
# ══════════════════════════════════════════════════════════════

# ── CONFIG ────────────────────────────────────────────────────
$BASE = "http://localhost:5000"
$PASS = "SEPARATOR"

function Sep($title) {
    Write-Host "`n$PASS" -ForegroundColor DarkGray
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host $PASS -ForegroundColor DarkGray
}

function Show($label, $val) {
    Write-Host "  $label" -ForegroundColor Yellow -NoNewline
    Write-Host ": $val"
}

function OK($msg)   { Write-Host "  ✅ $msg" -ForegroundColor Green }
function FAIL($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }

# ────────────────────────────────────────────────────────────────
# STEP 0 — Get Admin JWT
# ────────────────────────────────────────────────────────────────
Sep "STEP 0: Get Admin JWT Token"

$loginBody = '{"identifier":"rbalaji0220@gmail.com","role":3,"password":"campus@3908"}'
try {
    $login = Invoke-RestMethod -Method POST `
        -Uri "$BASE/api/auth/login" `
        -ContentType "application/json" `
        -Body $loginBody
    $TOKEN = $login.token
    Show "Token (first 40 chars)" $TOKEN.Substring(0,40)
    OK "Login succeeded — role: $($login.user.roleLabel)"
} catch {
    FAIL "Login failed: $_"
    FAIL "Possible fix: check role value. Try role:1 or role:0 if admin is not role 3."
    exit 1
}

$headers = @{ Authorization = "Bearer $TOKEN" }

# ────────────────────────────────────────────────────────────────
# STEP 1 — GET /api/departments (list all)
# ────────────────────────────────────────────────────────────────
Sep "STEP 1: GET /api/departments (list all)"

$r1 = Invoke-RestMethod -Method GET -Uri "$BASE/api/departments" -Headers $headers
Show "HTTP"        "200 (if you see this, it passed)"
Show "Total depts" $r1.total
Show "Page"        "$($r1.page) of $($r1.totalPages)"
Write-Host "  First 3 departments:" -ForegroundColor Yellow
$r1.data | Select-Object -First 3 | ForEach-Object {
    Write-Host "    id=$($_.id) name=$($_.name) code=$($_.code) hod=$($_.hodName) students=$($_.studentCount) staff=$($_.staffCount) active=$($_.isActive)"
}
if ($r1.success -eq $true) { OK "GET /api/departments → success:true" }
else { FAIL "Response did not have success:true" }

# ────────────────────────────────────────────────────────────────
# STEP 2 — GET /api/departments?search=CSE
# ────────────────────────────────────────────────────────────────
Sep "STEP 2: GET /api/departments?search=CSE"

$r2 = Invoke-RestMethod -Method GET -Uri "$BASE/api/departments?search=CSE" -Headers $headers
Show "Total matching" $r2.total
$r2.data | ForEach-Object {
    Write-Host "    → id=$($_.id) name=$($_.name) code=$($_.code)"
}
if ($r2.total -ge 0) { OK "Search endpoint responded correctly" }

# ────────────────────────────────────────────────────────────────
# STEP 3 — POST /api/departments (create)
# ────────────────────────────────────────────────────────────────
Sep "STEP 3: POST /api/departments (create)"

$createBody = @{
    name     = "TEST_DEPT_VERIFY_$(Get-Random -Maximum 9999)"
    code     = "TST$(Get-Random -Maximum 999)"
    isActive = $true
} | ConvertTo-Json

try {
    $r3 = Invoke-RestMethod -Method POST `
        -Uri "$BASE/api/departments" `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $createBody

    $newId = $r3.data.id
    Show "Created dept id"   $newId
    Show "Name"              $r3.data.name
    Show "Code"              $r3.data.code
    Show "studentCount"      $r3.data.studentCount
    Show "staffCount"        $r3.data.staffCount
    Show "isActive"          $r3.data.isActive
    if ($r3.success -eq $true -and $newId) { OK "POST /api/departments → department created, id=$newId" }
    else { FAIL "Create response missing success or id" }
} catch {
    FAIL "POST failed: $_"
    $newId = $null
}

# ────────────────────────────────────────────────────────────────
# STEP 4 — PUT /api/departments/:id (update — rename + toggle active)
# ────────────────────────────────────────────────────────────────
if ($newId) {
    Sep "STEP 4: PUT /api/departments/$newId (update name + isActive)"

    $updateBody = @{
        name     = "TEST_DEPT_UPDATED"
        isActive = $false
    } | ConvertTo-Json

    try {
        $r4 = Invoke-RestMethod -Method PUT `
            -Uri "$BASE/api/departments/$newId" `
            -ContentType "application/json" `
            -Headers $headers `
            -Body $updateBody

        Show "Updated name"     $r4.data.name
        Show "Updated isActive" $r4.data.isActive
        if ($r4.data.name -eq "TEST_DEPT_UPDATED") { OK "Name updated correctly" }
        else { FAIL "Name was NOT updated" }
        if ($r4.data.isActive -eq $false) { OK "isActive set to false" }
        else { FAIL "isActive was NOT changed" }
    } catch {
        FAIL "PUT failed: $_"
    }

    # ────────────────────────────────────────────────────────────
    # STEP 5 — DELETE /api/departments/:id (soft delete)
    # ────────────────────────────────────────────────────────────
    Sep "STEP 5: DELETE /api/departments/$newId (soft delete)"

    try {
        $r5 = Invoke-RestMethod -Method DELETE `
            -Uri "$BASE/api/departments/$newId" `
            -Headers $headers

        if ($r5.success -eq $true) { OK "DELETE responded success:true" }
        else { FAIL "DELETE response missing success:true" }
        Show "Message" $r5.message

        # Verify dept still exists by fetching it (soft deleted = isActive:false, not gone)
        $r5check = Invoke-RestMethod -Method GET `
            -Uri "$BASE/api/departments/$newId" `
            -Headers $headers

        Show "After delete — isActive" $r5check.data.isActive
        if ($r5check.data.isActive -eq $false) { OK "SOFT DELETE VERIFIED: row exists with isActive=false" }
        else { FAIL "Row appears to still be active — soft delete may have failed" }
    } catch {
        FAIL "DELETE or verification failed: $_"
    }
}

# ────────────────────────────────────────────────────────────────
# STEP 6 — Authorization check (no token → must be blocked)
# ────────────────────────────────────────────────────────────────
Sep "STEP 6: Authorization — no token (should be 401)"

try {
    $r6 = Invoke-RestMethod -Method GET -Uri "$BASE/api/departments"
    FAIL "No-token request succeeded — auth is NOT enforced!"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) { OK "No-token → 401 Unauthorized (correct)" }
    elseif ($statusCode -eq 403) { OK "No-token → 403 Forbidden (also acceptable)" }
    else { FAIL "Unexpected status $statusCode for no-token request" }
}

# ────────────────────────────────────────────────────────────────
# STEP 7 — Duplicate name conflict (409)
# ────────────────────────────────────────────────────────────────
Sep "STEP 7: Duplicate name conflict → should be 409"

$firstDeptName = $r1.data[0].name  # use existing dept name
if ($firstDeptName) {
    $dupBody = @{ name = $firstDeptName; code = "DUPTEST" } | ConvertTo-Json
    try {
        $r7 = Invoke-RestMethod -Method POST `
            -Uri "$BASE/api/departments" `
            -ContentType "application/json" `
            -Headers $headers `
            -Body $dupBody
        FAIL "Duplicate name was accepted — uniqueness NOT enforced!"
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($sc -eq 409) { OK "Duplicate name → 409 Conflict (correct)" }
        else { FAIL "Unexpected status $sc for duplicate name" }
    }
} else {
    Write-Host "  (skipped — no existing department to test against)" -ForegroundColor DarkGray
}

# ────────────────────────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────────────────────────
Sep "VERIFICATION COMPLETE"
Write-Host "  Run the following SQL queries in SQL Server Management Studio" -ForegroundColor Cyan
Write-Host "  to cross-verify the results above:" -ForegroundColor Cyan
Write-Host @"

-- 1. See all departments (including soft-deleted)
SELECT id, name, code, hod_user_id, is_active, created_at, updated_at
FROM departments ORDER BY id DESC;

-- 2. Verify HOD name resolves
SELECT d.id, d.name, d.code, d.hod_user_id, u.name AS hod_name, u.email AS hod_email
FROM departments d
LEFT JOIN users u ON d.hod_user_id = u.id
ORDER BY d.id;

-- 3. Dynamic counts per department (compare with API studentCount/staffCount)
SELECT
    d.id,
    d.name,
    SUM(CASE WHEN u.role = 0 AND u.is_active = 1 THEN 1 ELSE 0 END) AS student_count,
    SUM(CASE WHEN u.role = 1 AND u.is_active = 1 THEN 1 ELSE 0 END) AS staff_count
FROM departments d
LEFT JOIN users u ON u.department_id = d.id
GROUP BY d.id, d.name
ORDER BY d.id;

-- 4. Audit trail for department actions
SELECT action, entity_type, entity_id, user_name, description, created_at
FROM audit_logs
WHERE entity_type = 'department'
ORDER BY created_at DESC;

-- 5. Verify soft-delete (should show is_active=0, row still present)
SELECT id, name, is_active FROM departments WHERE name LIKE 'TEST_DEPT%';

"@ -ForegroundColor Gray
