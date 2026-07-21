# ══════════════════════════════════════════════════════════════
#  Phase 1C — Runtime Verification Script
#  Run this ON THE SERVER MACHINE where SQL Server is reachable
#  Requirements: PowerShell 5+, server running on port 5000
# ══════════════════════════════════════════════════════════════

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
    OK "Login succeeded"
} catch {
    FAIL "Login failed: $_"
    exit 1
}

$headers = @{ Authorization = "Bearer $TOKEN" }

# ────────────────────────────────────────────────────────────────
# STEP 1 — POST /api/locations (create with auto-QR)
# ────────────────────────────────────────────────────────────────
Sep "STEP 1: POST /api/locations (create with auto-QR)"

$createBody = @{
    name         = "LIBRARY_$(Get-Random -Maximum 9999)"
    block        = "Main Block"
    floor        = "First Floor"
    isActive     = $true
} | ConvertTo-Json

try {
    $r1 = Invoke-RestMethod -Method POST `
        -Uri "$BASE/api/locations" `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $createBody

    $newId = $r1.data.id
    Show "Created Location ID" $newId
    Show "Name"                $r1.data.name
    Show "QR Token"            $r1.data.qr.token
    Show "QR Image URL"        $r1.data.qr.imageUrl
    
    if ($r1.success -eq $true -and $r1.data.qr.token) { OK "Location created with QR auto-generated" }
    else { FAIL "Create response missing success or QR data" }
} catch {
    FAIL "POST failed: $_"
    $newId = $null
}

# ────────────────────────────────────────────────────────────────
# STEP 2 — GET /api/locations/:id (fetch with QR)
# ────────────────────────────────────────────────────────────────
if ($newId) {
    Sep "STEP 2: GET /api/locations/$newId"

    try {
        $r2 = Invoke-RestMethod -Method GET `
            -Uri "$BASE/api/locations/$newId" `
            -Headers $headers

        if ($r2.data.qr.token) { OK "Location successfully fetched with QR data" }
        else { FAIL "GET location failed to include QR data" }
    } catch {
        FAIL "GET failed: $_"
    }

    # ────────────────────────────────────────────────────────────
    # STEP 3 — PUT /api/locations/:id (update name)
    # ────────────────────────────────────────────────────────────
    Sep "STEP 3: PUT /api/locations/$newId (update)"

    $updateBody = @{
        name = "UPDATED_LIBRARY_$(Get-Random -Maximum 9999)"
    } | ConvertTo-Json

    try {
        $r3 = Invoke-RestMethod -Method PUT `
            -Uri "$BASE/api/locations/$newId" `
            -ContentType "application/json" `
            -Headers $headers `
            -Body $updateBody

        if ($r3.data.name -like "UPDATED_*") { OK "Location updated successfully" }
        else { FAIL "Location update failed" }
    } catch {
        FAIL "PUT failed: $_"
    }

    # ────────────────────────────────────────────────────────────
    # STEP 4 — GET /api/locations/:id/qr (fetch/generate QR)
    # ────────────────────────────────────────────────────────────
    Sep "STEP 4: GET /api/locations/$newId/qr (direct QR fetch)"

    try {
        $r4 = Invoke-RestMethod -Method GET `
            -Uri "$BASE/api/locations/$newId/qr" `
            -Headers $headers

        Show "QR Token via direct endpoint" $r4.data.token
        if ($r4.success -eq $true -and $r4.data.token) { OK "Direct QR endpoint works" }
        else { FAIL "Direct QR endpoint failed" }
    } catch {
        FAIL "QR GET failed: $_"
    }
}

# ────────────────────────────────────────────────────────────────
# STEP 5 — GET /api/locations (list all)
# ────────────────────────────────────────────────────────────────
Sep "STEP 5: GET /api/locations (list paginated)"

try {
    $r5 = Invoke-RestMethod -Method GET -Uri "$BASE/api/locations?limit=5" -Headers $headers
    Show "Total locations" $r5.total
    if ($r5.success -eq $true) { OK "List endpoint works" }
    else { FAIL "List endpoint failed" }
} catch {
    FAIL "List GET failed: $_"
}

# ────────────────────────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────────────────────────
Sep "VERIFICATION COMPLETE"
Write-Host "  Run the following SQL queries in SQL Server Management Studio" -ForegroundColor Cyan
Write-Host "  to cross-verify the results above:" -ForegroundColor Cyan
Write-Host @"

-- 1. See all locations
SELECT id, name, block, floor, department_id, is_active FROM locations ORDER BY id DESC;

-- 2. Verify QR codes generated mapping to locations
SELECT l.id AS loc_id, l.name AS loc_name, q.id AS qr_id, q.qr_token, q.qr_image_url
FROM locations l
LEFT JOIN qr_codes q ON q.location_id = l.id
ORDER BY l.id DESC;

-- 3. Audit trail for location actions
SELECT action, entity_type, entity_id, user_name, description, created_at
FROM audit_logs
WHERE entity_type = 'location'
ORDER BY created_at DESC;

"@ -ForegroundColor Gray
