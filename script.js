// ===== Medication Knowledge & Safety Dashboard =====
// ต้องโหลด data.js (DB) และ guide.js (GUIDE) ก่อนไฟล์นี้

const items = DB.items;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count = (arr, key) => arr.reduce((o, x) => (o[x[key]] = (o[x[key]] || 0) + 1, o), {});
const uniq = key => new Set(items.map(x => x[key])).size;

const thaiForms = {'tablet':'ยาเม็ด','capsule':'แคปซูล','syrup':'ยาน้ำเชื่อม','suspension':'ยาน้ำแขวนตะกอน','dry syrup':'ยาผงสำหรับเตรียมยาน้ำ','cream':'ครีม','gel':'เจล','inhaler':'ยาสูดพ่น','eye drops':'ยาหยอดตา','ear drops':'ยาหยอดหู','ointment':'ขี้ผึ้ง','solution':'สารละลาย','oral solution':'ยาน้ำรับประทาน','oral suspension':'ยาน้ำแขวนตะกอนชนิดรับประทาน','sublingual tablet':'ยาเม็ดอมใต้ลิ้น','chewable tablet':'ยาเม็ดเคี้ยว','powder for oral solution':'ผงสำหรับเตรียมสารละลายรับประทาน','nasal spray':'ยาพ่นจมูก'};
const formTh = f => thaiForms[f] || f;
const colors = ['#238f87','#6caeb8','#e6a45b','#7894c5','#9a83b8','#78aa8d','#d17f79','#7e9b9d','#c3a66d','#87a4c2','#a5b9a0','#bd91a5','#8d9ac0','#b4a18c','#5daba3','#d2a17c','#8bafc4','#b8a6c9'];

// ----- ความสัมพันธ์ ยา ↔ อาการ -----
const symptomById = Object.fromEntries(GUIDE.symptoms.map(s => [s.id, s]));
const inSymptom = (x, s) => s.skus ? s.skus.includes(x.sku) : x.category === s.category;
const symptomsOf = x => GUIDE.symptoms.filter(s => inSymptom(x, s));
const catInfo = c => GUIDE.categories[c] || { icon:'💊', desc:'', consult:false };
// ยาที่ควรปรึกษาก่อนใช้ = อยู่ในกลุ่มที่ต้องปรึกษา, เป็นยาโรคประจำตัว หรือไม่ได้จัดไว้ตามอาการใดเลย
const needsConsult = x => {
  const syms = symptomsOf(x);
  return catInfo(x.category).consult || syms.length === 0 || syms.some(s => s.group === 'chronic');
};

// ----- สถานะตัวกรอง: ใช้ได้ทีละวิธี (อาการ / กลุ่มยา / ชื่อยา) -----
const state = { sym:'', cat:'', q:'', form:'' };
let selectedSku = '';

function setFilter(patch){
  Object.assign(state, { sym:'', cat:'', q:'', form:'' }, patch);
  $('q').value = state.q; $('form').value = state.form;
  render();
}

function filtered(){
  const q = state.q.trim().toLowerCase();
  return items.filter(x => {
    if (state.sym && !inSymptom(x, symptomById[state.sym])) return false;
    if (state.cat && x.category !== state.cat) return false;
    if (state.form && x.dosage_form !== state.form) return false;
    if (!q) return true;
    const syms = symptomsOf(x);
    const hay = [x.sku, x.generic_name, x.strength, x.dosage_form, formTh(x.dosage_form), x.category, x.atc_code,
                 ...syms.map(s => s.label), ...syms.flatMap(s => s.keywords || [])];
    return hay.some(v => String(v).toLowerCase().includes(q));
  });
}

// ----- แท็บ -----
function initTabs(){
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    ['symptom','category','name'].forEach(t => $('tab-' + t).hidden = (t !== btn.dataset.tab));
    if (btn.dataset.tab === 'name') $('q').focus();
  }));
}

// ----- ปุ่มอาการ -----
function renderChips(){
  const chip = s => {
    const n = items.filter(x => inSymptom(x, s)).length;
    return `<button class="chip ${s.group === 'chronic' ? 'chronic' : ''} ${state.sym === s.id ? 'active' : ''}" data-sym="${s.id}"><span class="c-ico">${s.icon}</span><span>${esc(s.label)}</span><span class="c-n">${n}</span></button>`;
  };
  $('chipsSelf').innerHTML = GUIDE.symptoms.filter(s => s.group === 'self').map(chip).join('');
  $('chipsChronic').innerHTML = GUIDE.symptoms.filter(s => s.group === 'chronic').map(chip).join('');
  document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.sym;
    setFilter(state.sym === id ? {} : { sym:id });
    if (state.sym) scrollToGuide();
  }));
}

// ----- การ์ดกลุ่มยา -----
function renderCatCards(){
  const counts = count(items, 'category');
  $('catCards').innerHTML = DB.meta.categories.map(c => {
    const info = catInfo(c);
    return `<button class="cat-card ${state.cat === c ? 'active' : ''}" data-cat="${esc(c)}">
      <span class="cat-top"><span class="c-ico">${info.icon}</span><b>${esc(c)}</b><span class="c-n">${counts[c] || 0}</span></span>
      <span class="cat-desc">${esc(info.desc)}</span>
      ${info.consult ? '<span class="badge-rx">ปรึกษาแพทย์/เภสัชกร</span>' : ''}
    </button>`;
  }).join('');
  document.querySelectorAll('.cat-card').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.cat;
    setFilter(state.cat === c ? {} : { cat:c });
    if (state.cat) scrollToGuide();
  }));
}

function scrollToGuide(){
  // เลื่อนลงไปที่ผลลัพธ์ เฉพาะจอเล็กที่ผลลัพธ์อยู่นอกจอ
  if (window.innerWidth < 900) $('guideBox').scrollIntoView({ behavior:'smooth', block:'start' });
}

// ----- กล่องอธิบายตัวกรองที่เลือก -----
function renderGuideBox(n){
  let html = '';
  if (state.sym){
    const s = symptomById[state.sym], chronic = s.group === 'chronic';
    const lines = [];
    if (chronic) lines.push(`<div class="g-line"><span class="k">🧾</span><span>${esc(GUIDE.chronicNote)}</span></div>`);
    if (s.note) lines.push(`<div class="g-line"><span class="k">💡</span><span>${esc(s.note)}</span></div>`);
    if (s.warn) lines.push(`<div class="g-line g-warn"><span class="k">🚩</span><span><b>ควรไปพบแพทย์เมื่อ:</b> ${esc(s.warn)}</span></div>`);
    html = `<div class="guide-box ${chronic ? 'chronic' : ''}"><div class="guide-head"><span class="g-ico">${s.icon}</span><div><h3>${esc(s.label)}</h3><span class="g-count">พบยาที่เกี่ยวข้อง ${n} รายการ</span></div><button class="btn reset clear" id="clearFilter">✕ ล้างการเลือก</button></div><div class="guide-lines">${lines.join('')}</div></div>`;
  } else if (state.cat){
    const info = catInfo(state.cat);
    const lines = [`<div class="g-line"><span class="k">💡</span><span>${esc(info.desc)}</span></div>`];
    if (info.consult) lines.push(`<div class="g-line g-warn"><span class="k">🧑‍⚕️</span><span>ยากลุ่มนี้ควรให้แพทย์หรือเภสัชกรประเมินก่อนใช้ ไม่ควรซื้อใช้เอง</span></div>`);
    if (state.cat === 'ยาปฏิชีวนะ') lines.push(`<div class="g-line"><span class="k">ℹ️</span><span>${esc(GUIDE.notMappedNote)}</span></div>`);
    html = `<div class="guide-box ${info.consult ? 'chronic' : ''}"><div class="guide-head"><span class="g-ico">${info.icon}</span><div><h3>${esc(state.cat)}</h3><span class="g-count">${n} รายการ</span></div><button class="btn reset clear" id="clearFilter">✕ ล้างการเลือก</button></div><div class="guide-lines">${lines.join('')}</div></div>`;
  }
  $('guideBox').innerHTML = html;
  if (html) $('clearFilter').addEventListener('click', () => setFilter({}));
}

// ----- ตาราง -----
function renderTable(rows){
  $('tbody').innerHTML = rows.map(x => `<tr data-sku="${esc(x.sku)}" class="${x.sku === selectedSku ? 'selected' : ''}">
      <td class="sku">${esc(x.sku)}</td><td>${esc(x.generic_name)}</td><td>${esc(x.strength)}</td><td>${esc(formTh(x.dosage_form))}</td>
      <td><span class="pill ${needsConsult(x) ? 'rx' : ''}">${esc(x.category)}</span></td></tr>`).join('')
    || '<tr><td colspan="5" class="empty">ไม่พบรายการยาที่ตรงกับคำค้นหา ลองเลือกจากแท็บ “เลือกตามอาการ” หรือ “เลือกตามกลุ่มยา”</td></tr>';
  $('countline').textContent = `แสดง ${rows.length} จาก ${items.length} รายการ`;
  $('tableHint').textContent = state.sym ? `ยาที่เกี่ยวข้องกับ “${symptomById[state.sym].label}”`
    : state.cat ? `ยาในกลุ่ม “${state.cat}”`
    : (state.q || state.form) ? 'ผลการค้นหา' : 'แสดงยาทั้งหมด · ป้ายสีส้ม = ควรปรึกษาแพทย์/เภสัชกร';
  document.querySelectorAll('#tbody tr[data-sku]').forEach(tr => tr.addEventListener('click', () => {
    selectedSku = tr.dataset.sku;
    document.querySelectorAll('#tbody tr').forEach(r => r.classList.toggle('selected', r === tr));
    showDetail(items.find(x => x.sku === selectedSku));
  }));
}

// ----- รายละเอียดยา -----
function showDetail(x){
  const syms = symptomsOf(x);
  const uses = syms.length
    ? `<div class="use-tags">${syms.map(s => `<span class="use-tag" data-sym="${s.id}">${s.icon} ${esc(s.label)}</span>`).join('')}</div>`
    : '<b>— ไม่ได้จัดไว้ตามอาการ ควรให้แพทย์หรือเภสัชกรประเมิน</b>';
  $('detail').innerHTML = `<span class="pill">${esc(x.sku)}</span><h3>${esc(x.generic_name)}</h3><div class="generic">${esc(x.strength)}</div>
   <div class="detail-grid">
     <div class="detail-cell"><small>Dosage Form · รูปแบบยา</small><b>${esc(formTh(x.dosage_form))}</b></div>
     <div class="detail-cell"><small>Unit · หน่วยนับ</small><b>${esc(x.unit)}</b></div>
     <div class="detail-cell"><small>Category · กลุ่มยา</small><b>${esc(x.category)}</b></div>
     <div class="detail-cell"><small>ATC Code</small><b>${esc(x.atc_code)}</b></div>
     <div class="detail-cell wide"><small>เกี่ยวข้องกับอาการ / โรค</small>${uses}</div>
   </div>
   ${needsConsult(x) ? '<div class="rx-alert">🧑‍⚕️ <b>ยานี้ควรใช้ตามคำแนะนำของแพทย์หรือเภสัชกร</b> ไม่ควรเริ่ม หยุด หรือปรับขนาดยาเอง</div>' : ''}
   <div class="notice"><b>โปรดทราบ:</b> ข้อมูลนี้ไม่ระบุขนาดยาที่เหมาะกับแต่ละบุคคล ควรอ่านฉลากและเอกสารกำกับยา และสอบถามเภสัชกรก่อนใช้ โดยเฉพาะเด็ก หญิงตั้งครรภ์ ผู้สูงอายุ และผู้มีโรคประจำตัว</div>`;
  document.querySelectorAll('#detail .use-tag').forEach(t => t.addEventListener('click', () => {
    document.querySelector('.tab[data-tab="symptom"]').click();
    setFilter({ sym:t.dataset.sym });
  }));
}

// ----- KPI และกราฟ (คำนวณจากข้อมูลทั้งหมด) -----
function renderKpis(){
  const k = [['💊',items.length,'Drug Records','รายการยาทั้งหมด'],['🧪',uniq('generic_name'),'Generic Names','ชื่อสามัญที่ไม่ซ้ำ'],['▦',uniq('category'),'Drug Categories','หมวดหมู่ยา'],['◈',uniq('dosage_form'),'Dosage Forms','รูปแบบยาที่ไม่ซ้ำ'],['⌗',uniq('atc_code'),'Unique ATC Codes','รหัส ATC ที่ไม่ซ้ำ']];
  $('kpis').innerHTML = k.map(x => `<div class="kpi"><div class="kpi-icon">${x[0]}</div><div class="kpi-value">${x[1]}</div><div class="kpi-label">${x[2]}</div><div class="kpi-sub">${x[3]}</div></div>`).join('');
}

function renderCharts(){
  const cats = count(items, 'category'), max = Math.max(...Object.values(cats));
  $('categoryBars').innerHTML = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([name, n]) =>
    `<div class="bar-row"><div class="bar-label" title="${esc(name)}">${esc(name)}</div><div class="track"><div class="fill" style="width:${n / max * 100}%"></div></div><div class="bar-num">${n}</div></div>`).join('');

  const forms = count(items, 'dosage_form'), sorted = Object.entries(forms).sort((a, b) => b[1] - a[1]);
  let acc = 0;
  const stops = sorted.map(([, n], i) => { const start = acc; acc += n / items.length * 100; return `${colors[i % colors.length]} ${start}% ${acc}%`; });
  $('donut').style.background = `conic-gradient(${stops.join(',')})`;
  $('donutTotal').textContent = items.length;
  $('formHint').textContent = `สัดส่วนรูปแบบยาทั้ง ${sorted.length} ประเภท`;
  $('legend').innerHTML = sorted.map(([name, n], i) =>
    `<div class="legend-item"><span class="dot" style="background:${colors[i % colors.length]}"></span><span>${esc(formTh(name))} <b>${n}</b></span></div>`).join('');
}

// ----- รวมการแสดงผล -----
function render(){
  const rows = filtered();
  renderChips(); renderCatCards(); renderGuideBox(rows.length); renderTable(rows);
}

function init(){
  $('chronicNote').textContent = GUIDE.chronicNote;
  $('notMappedNote').textContent = 'ℹ️ ' + GUIDE.notMappedNote;
  const forms = [...new Set(items.map(x => x.dosage_form))].sort();
  $('form').innerHTML += forms.map(x => `<option value="${esc(x)}">${esc(formTh(x))} (${esc(x)})</option>`).join('');

  $('q').addEventListener('input', () => { Object.assign(state, { sym:'', cat:'', q:$('q').value }); render(); });
  $('form').addEventListener('change', () => { Object.assign(state, { sym:'', cat:'', form:$('form').value }); render(); });
  $('reset').addEventListener('click', () => setFilter({}));

  initTabs(); renderKpis(); renderCharts(); render();
}

init();
