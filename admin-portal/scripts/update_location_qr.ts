import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '..', 'location-qr.html');
let html = fs.readFileSync(filePath, 'utf8');

// 1. Remove hardcoded categories and routing-type dropdown
html = html.replace(
  `          <select class="form-control" id="lm-category" onchange="onCategoryChange()">
            <option value="General">General</option>
            <option value="Academic">Academic</option>
            <option value="Library">Library</option>
            <option value="Hostel">Hostel</option>
            <option value="Transport">Transport</option>
            <option value="Canteen">Canteen</option>
            <option value="Sports">Sports</option>
            <option value="Mess">Mess</option>
            <option value="Toilet">Toilet</option>
            <option value="Main gate">Main gate</option>
            <option value="Labs">Labs</option>
          </select>`,
  `          <select class="form-control" id="lm-category" onchange="onCategoryChange()">
            <option value="">-- Select Category --</option>
          </select>`
);

html = html.replace(
  `      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Routing Type</label>
          <select class="form-control" id="lm-routing-type" onchange="toggleRoutingKey()">
            <option value="DEPARTMENT_ROUTED">Department Routed</option>
            <option value="GLOBAL_ROUTED">Global Routed</option>
          </select>
        </div>
        <div>`,
  `      <div class="grid-2">
        <div class="form-group" style="display:none">
          <label class="form-label">Routing Type</label>
          <input type="hidden" id="lm-routing-type" value="">
        </div>
        <div>`
);

html = html.replace(
  `<label class="form-label">Routing Key</label>`,
  `<label class="form-label">Routing Group</label>`
);

// 2. onCategoryChange function
html = html.replace(
  `    function onCategoryChange() {
      const cat = document.getElementById('lm-category').value;
      const typeSel = document.getElementById('lm-routing-type');
      const keySel = document.getElementById('lm-routing-key');

      if (['Academic', 'Labs'].includes(cat)) {
        typeSel.value = 'DEPARTMENT_ROUTED';
        keySel.value = '';
      } else if (['Library', 'Hostel', 'Canteen', 'Transport', 'Mess', 'Toilet', 'Main gate'].includes(cat)) {
        typeSel.value = 'GLOBAL_ROUTED';
        if (cat === 'Library') keySel.value = 'LIBRARY_HEAD';
        else if (cat === 'Canteen') keySel.value = 'CANTEEN_HEAD';
        else if (cat === 'Transport') keySel.value = 'TRANSPORT_MANAGER';
        else if (cat === 'Toilet') keySel.value = 'SANITATION_HEAD';
        else if (cat === 'Mess') {
          if (!['BOYS_MESS_MANAGER', 'GIRLS_MESS_MANAGER'].includes(keySel.value)) {
            keySel.value = 'BOYS_MESS_MANAGER';
          }
        } else if (cat === 'Hostel') {
          if (!['BOYS_HOSTEL_WARDEN', 'GIRLS_HOSTEL_WARDEN'].includes(keySel.value)) {
            keySel.value = '';
          }
        } else if (cat === 'Main gate') {
          keySel.value = '';
        }
      }
      toggleRoutingKey();
    }`,
  `    function onCategoryChange() {
      const catId = document.getElementById('lm-category').value;
      const typeSel = document.getElementById('lm-routing-type');
      const keySel = document.getElementById('lm-routing-key');

      const selectedCat = catStats.find(c => String(c.categoryId) === catId);
      if (selectedCat) {
        typeSel.value = selectedCat.routingType === 'GLOBAL' ? 'GLOBAL_ROUTED' : 'DEPARTMENT_ROUTED';
      } else {
        typeSel.value = 'DEPARTMENT_ROUTED';
      }
      keySel.value = ''; // Reset routing group on category change
      toggleRoutingKey();
    }`
);

// 3. updateAssigneeDisplay function (match by routing_group_id)
html = html.replace(
  `      const assign = activeAssignments.find(a => a.routing_key === key && (a.escalation_level === null || a.escalation_level === 1));`,
  `      const assign = activeAssignments.find(a => String(a.routing_group_id) === key && (a.escalation_level === null || a.escalation_level === 1));`
);

// 4. loadCategories to populate dropdown
html = html.replace(
  `        const total = catStats.reduce((s, c) => s + c.count, 0);
        renderCatPills(catStats, total);
      } catch (e) {`,
  `        const total = catStats.reduce((s, c) => s + c.count, 0);
        renderCatPills(catStats, total);

        const modalCatSel = document.getElementById('lm-category');
        modalCatSel.innerHTML = '<option value="">-- Select Category --</option>' +
          catStats.map(c => \`<option value="\${c.categoryId}">\${c.category}</option>\`).join('');
      } catch (e) {`
);

// 5. loadRoutingKeys to use routing_group_id
html = html.replace(
  `        sel.innerHTML = '<option value="">-- Select --</option>' +
          json.data.map(k => \`<option value="\${k.key}">\${k.label}</option>\`).join('');`,
  `        sel.innerHTML = '<option value="">-- Select --</option>' +
          json.data.map(k => \`<option value="\${k.id}">\${k.display_name}</option>\`).join('');`
);

// 6. setCategory to use categoryId
html = html.replace(
  `    let activeCategory = 'All';`,
  `    let activeCategory = 'All';
    let activeCategoryId = 'All';`
);

html = html.replace(
  `    function setCategory(cat) {
      activeCategory = cat;
      currentPage = 1;
      renderCatPills(catStats, catStats.reduce((s, c) => s + c.count, 0));
      fetchLocations();
    }`,
  `    function setCategory(cat, id) {
      activeCategory = cat;
      activeCategoryId = id || 'All';
      currentPage = 1;
      renderCatPills(catStats, catStats.reduce((s, c) => s + c.count, 0));
      fetchLocations();
    }`
);

html = html.replace(
  `        <button class="cat-pill\${activeCategory === s.category ? ' active' : ''}"
                onclick="setCategory('\${s.category}')">`,
  `        <button class="cat-pill\${activeCategory === s.category ? ' active' : ''}"
                onclick="setCategory('\${s.category}', '\${s.categoryId || 'All'}')">`
);

html = html.replace(
  `if (activeCategory !== 'All') url += \`&category=\${encodeURIComponent(activeCategory)}\`;`,
  `if (activeCategoryId !== 'All') url += \`&categoryId=\${encodeURIComponent(activeCategoryId)}\`;`
);

// 7. saveLoc and edit location populator
html = html.replace(
  `function editLocation(id) {
      currentLocId = id;
      document.getElementById('modal-title').textContent = 'Edit Location';
      const l = locs.find(x => x.id === id);
      if (!l) return;

      document.getElementById('lm-name').value          = l.name;
      document.getElementById('lm-code').value          = l.internalCode || '';
      document.getElementById('lm-block').value         = l.block || '';
      document.getElementById('lm-floor').value         = l.floor || '';
      document.getElementById('lm-dept').value          = l.departmentId || '';
      document.getElementById('lm-status').value        = l.isActive ? 'true' : 'false';
      document.getElementById('lm-category').value        = l.category || 'General';

      // Safe updates to routing type and key
      document.getElementById('lm-routing-type').value   = l.routingType || 'DEPARTMENT_ROUTED';
      document.getElementById('lm-routing-key').value    = l.routingKey || '';
      
      toggleRoutingKey();
      openModal('loc-modal');
    }`,
  `function editLocation(id) {
      currentLocId = id;
      document.getElementById('modal-title').textContent = 'Edit Location';
      const l = locs.find(x => x.id === id);
      if (!l) return;

      document.getElementById('lm-name').value          = l.name;
      document.getElementById('lm-code').value          = l.internalCode || '';
      document.getElementById('lm-block').value         = l.block || '';
      document.getElementById('lm-floor').value         = l.floor || '';
      document.getElementById('lm-dept').value          = l.departmentId || '';
      document.getElementById('lm-status').value        = l.isActive ? 'true' : 'false';
      document.getElementById('lm-category').value      = l.categoryId || '';

      document.getElementById('lm-routing-type').value   = l.routingType === 'GLOBAL' ? 'GLOBAL_ROUTED' : 'DEPARTMENT_ROUTED';
      document.getElementById('lm-routing-key').value    = l.routingGroupId || '';
      
      toggleRoutingKey();
      openModal('loc-modal');
    }`
);

html = html.replace(
  `function openAddLocation() {
      currentLocId = null;
      document.getElementById('modal-title').textContent = 'Add Location';
      document.getElementById('lm-name').value        = '';
      document.getElementById('lm-code').value        = '';
      document.getElementById('lm-block').value       = '';
      document.getElementById('lm-floor').value       = '';
      document.getElementById('lm-dept').value        = '';
      document.getElementById('lm-status').value      = 'true';
      document.getElementById('lm-category').value    = 'General';
      
      document.getElementById('lm-routing-type').value = 'DEPARTMENT_ROUTED';
      document.getElementById('lm-routing-key').value  = '';
      
      toggleRoutingKey();
      openModal('loc-modal');
    }`,
  `function openAddLocation() {
      currentLocId = null;
      document.getElementById('modal-title').textContent = 'Add Location';
      document.getElementById('lm-name').value        = '';
      document.getElementById('lm-code').value        = '';
      document.getElementById('lm-block').value       = '';
      document.getElementById('lm-floor').value       = '';
      document.getElementById('lm-dept').value        = '';
      document.getElementById('lm-status').value      = 'true';
      document.getElementById('lm-category').value    = '';
      
      document.getElementById('lm-routing-type').value = 'DEPARTMENT_ROUTED';
      document.getElementById('lm-routing-key').value  = '';
      
      toggleRoutingKey();
      openModal('loc-modal');
    }`
);

html = html.replace(
  `      const name        = document.getElementById('lm-name').value.trim();
      const internalCode = document.getElementById('lm-code').value.trim();
      const block       = document.getElementById('lm-block').value.trim();
      const floor       = document.getElementById('lm-floor').value.trim();
      const departmentId= document.getElementById('lm-dept').value;
      const isActive    = document.getElementById('lm-status').value === 'true';
      const category    = document.getElementById('lm-category').value;
      const routingType = document.getElementById('lm-routing-type').value;
      const routingKey  = document.getElementById('lm-routing-key').value;

      if (!name) return alert('Name is required');
      if (routingType === 'GLOBAL_ROUTED' && !routingKey) {
        return alert('Please select a Routing Key for global routing.');
      }

      const payload = {
        name, internalCode, block, floor,
        departmentId: departmentId ? parseInt(departmentId, 10) : null,
        isActive,
        category,
        routingType,
        routingKey: routingType === 'GLOBAL_ROUTED' ? routingKey : null,
      };`,
  `      const name        = document.getElementById('lm-name').value.trim();
      const internalCode = document.getElementById('lm-code').value.trim();
      const block       = document.getElementById('lm-block').value.trim();
      const floor       = document.getElementById('lm-floor').value.trim();
      const departmentId= document.getElementById('lm-dept').value;
      const isActive    = document.getElementById('lm-status').value === 'true';
      const categoryId  = document.getElementById('lm-category').value;
      const routingType = document.getElementById('lm-routing-type').value;
      const routingGroupId = document.getElementById('lm-routing-key').value;

      if (!name) return alert('Name is required');
      if (!categoryId) return alert('Category is required');
      if (routingType === 'GLOBAL_ROUTED' && !routingGroupId) {
        return alert('Please select a Routing Group.');
      }
      if (routingType === 'DEPARTMENT_ROUTED' && !departmentId) {
        return alert('Please select a Department.');
      }

      const payload = {
        name, internalCode, block, floor,
        departmentId: departmentId ? parseInt(departmentId, 10) : null,
        isActive,
        categoryId: parseInt(categoryId, 10),
        routingGroupId: routingType === 'GLOBAL_ROUTED' ? parseInt(routingGroupId, 10) : null,
      };`
);

fs.writeFileSync(filePath, html);
console.log('Done');
